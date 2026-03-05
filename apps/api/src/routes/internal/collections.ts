import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, ilike } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk/v3";
import { collections, collectionProducts, integrations } from "@workspace/db";
import { paginationParams } from "@workspace/validators/common";
import { success, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { getCredentials } from "../../lib/credentials.js";
import type { Env, Variables } from "../../types.js";
import { z } from "zod";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const collectionFilters = z.object({
  search: z.string().max(100).optional(),
});

// GET /internal/collections - List collections (supplier only)
app.get(
  "/",
  zValidator("query", paginationParams.merge(collectionFilters)),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const { page, limit, search } = c.req.valid("query");

    // Build where clause
    const conditions = [eq(collections.supplierId, auth.organizationId)];

    if (search) {
      conditions.push(ilike(collections.title, `%${search}%`));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.query.collections.findMany({
        where: whereClause,
        with: {
          collectionProducts: {
            with: {
              product: {
                columns: {
                  id: true,
                  name: true,
                  sku: true,
                  images: true,
                },
              },
            },
            orderBy: (cp, { asc }) => [asc(cp.position)],
          },
        },
        orderBy: [desc(collections.updatedAt)],
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ count: collections.id }).from(collections).where(whereClause),
    ]);

    // Transform to include products array directly
    const transformed = items.map((collection) => ({
      ...collection,
      products: collection.collectionProducts.map((cp) => cp.product),
      collectionProducts: undefined,
    }));

    return paginated(c, transformed, {
      page,
      limit,
      total: countResult.length,
    });
  }
);

// GET /internal/collections/:id - Get collection details (supplier only)
app.get("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const collection = await db.query.collections.findFirst({
    where: and(
      eq(collections.id, id),
      eq(collections.supplierId, auth.organizationId)
    ),
    with: {
      collectionProducts: {
        with: {
          product: {
            with: {
              variants: true,
            },
          },
        },
        orderBy: (cp, { asc }) => [asc(cp.position)],
      },
    },
  });

  if (!collection) {
    throw Errors.notFound("Collection");
  }

  // Transform to include products array directly
  const transformed = {
    ...collection,
    products: collection.collectionProducts.map((cp) => cp.product),
    collectionProducts: undefined,
  };

  return success(c, transformed);
});

// POST /internal/collections/sync - Trigger collections sync (supplier only)
app.post("/sync", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  // Find active Shopify integration
  const shopifyIntegration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.provider, "shopify"),
      eq(integrations.isActive, "true")
    ),
  });

  if (!shopifyIntegration) {
    throw Errors.badRequest("No active Shopify integration found");
  }

  if (!shopifyIntegration.credentialsRef || !shopifyIntegration.externalIdentifier) {
    throw Errors.badRequest("Shopify integration is not properly configured");
  }

  // Get access token (decrypts from KMS if encrypted)
  let accessToken: string;
  try {
    const credentials = await getCredentials<{ accessToken?: string }>(
      c.env,
      shopifyIntegration.credentialsRef
    );
    if (!credentials?.accessToken) {
      throw new Error("No access token");
    }
    accessToken = credentials.accessToken;
  } catch {
    throw Errors.badRequest("Invalid Shopify credentials");
  }

  // Trigger the collections sync task
  const handle = await tasks.trigger("shopify-sync-collections", {
    integrationId: shopifyIntegration.id,
    organizationId: auth.organizationId,
    shopDomain: shopifyIntegration.externalIdentifier,
    accessToken,
  });

  console.log(`Triggered Shopify collections sync job: ${handle.id}`);

  return success(c, {
    message: "Collections sync initiated",
    jobId: handle.id,
  });
});

export default app;
