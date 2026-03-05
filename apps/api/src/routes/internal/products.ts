import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk";
import { products, integrations } from "@workspace/db";
import { updateProduct, productFilters } from "@workspace/validators/products";
import { paginationParams } from "@workspace/validators/common";
import { success, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { dispatchWebhooks } from "../../lib/webhooks.js";
import { getCredentials } from "../../lib/credentials.js";
import type { Env, Variables } from "../../types.js";
import { z } from "zod";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /internal/products - List products (supplier only)
app.get(
  "/",
  zValidator("query", paginationParams.merge(productFilters)),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const { page, limit, search, brand, productType, isActive } =
      c.req.valid("query");

    // Build where clause
    const conditions = [eq(products.supplierId, auth.organizationId)];

    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`)
        )!
      );
    }
    if (brand) {
      conditions.push(eq(products.brand, brand));
    }
    if (productType) {
      conditions.push(eq(products.productType, productType));
    }
    if (isActive !== undefined) {
      conditions.push(eq(products.isActive, isActive.toString()));
    }

    const whereClause = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.query.products.findMany({
        where: whereClause,
        with: {
          variants: {
            with: {
              inventory: true,
            },
          },
        },
        orderBy: [desc(products.updatedAt)],
        limit,
        offset: (page - 1) * limit,
      }),
      db.select({ count: products.id }).from(products).where(whereClause),
    ]);

    return paginated(c, items, {
      page,
      limit,
      total: countResult.length,
    });
  }
);

// GET /internal/products/stats - Get product statistics
// NOTE: This must be defined BEFORE /:id to avoid "stats" being treated as an ID
app.get("/stats", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const allProducts = await db.query.products.findMany({
    where: eq(products.supplierId, auth.organizationId),
    columns: {
      id: true,
      isActive: true,
    },
  });

  const stats = {
    total: allProducts.length,
    active: allProducts.filter((p) => p.isActive === "true").length,
    inactive: allProducts.filter((p) => p.isActive !== "true").length,
  };

  return success(c, stats);
});

// GET /internal/products/:id - Get product details (supplier only)
app.get("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, id),
      eq(products.supplierId, auth.organizationId)
    ),
    with: {
      variants: {
        with: {
          inventory: true,
        },
      },
    },
  });

  if (!product) {
    throw Errors.notFound("Product");
  }

  return success(c, product);
});

// PATCH /internal/products/:id - Update product (supplier only)
app.patch("/:id", zValidator("json", updateProduct), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, id),
      eq(products.supplierId, auth.organizationId)
    ),
  });

  if (!product) {
    throw Errors.notFound("Product");
  }

  const [updated] = await db
    .update(products)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(products.id, id))
    .returning();

  // Dispatch webhook to supplier organization
  // Include timestamp since product can be updated multiple times
  dispatchWebhooks(db, auth.organizationId, "product.updated", {
    product: {
      id: updated.id,
      name: updated.name,
      sku: updated.sku,
      brand: updated.brand,
      productType: updated.productType,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    },
    changes: Object.keys(data),
  }, { eventId: `product-updated-${updated.id}-${updated.updatedAt?.getTime()}` });

  return success(c, updated);
});

// POST /internal/products/:id/activate - Activate product
app.post("/:id/activate", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const [updated] = await db
    .update(products)
    .set({
      isActive: "true",
      updatedAt: new Date(),
    })
    .where(
      and(eq(products.id, id), eq(products.supplierId, auth.organizationId))
    )
    .returning();

  if (!updated) {
    throw Errors.notFound("Product");
  }

  // Dispatch webhook for product activation
  dispatchWebhooks(db, auth.organizationId, "product.updated", {
    product: {
      id: updated.id,
      name: updated.name,
      sku: updated.sku,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    },
    changes: ["isActive"],
    action: "activated",
  }, { eventId: `product-activated-${updated.id}` });

  return success(c, updated);
});

// POST /internal/products/:id/deactivate - Deactivate product
app.post("/:id/deactivate", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const [updated] = await db
    .update(products)
    .set({
      isActive: "false",
      updatedAt: new Date(),
    })
    .where(
      and(eq(products.id, id), eq(products.supplierId, auth.organizationId))
    )
    .returning();

  if (!updated) {
    throw Errors.notFound("Product");
  }

  // Dispatch webhook for product deactivation
  dispatchWebhooks(db, auth.organizationId, "product.updated", {
    product: {
      id: updated.id,
      name: updated.name,
      sku: updated.sku,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt,
    },
    changes: ["isActive"],
    action: "deactivated",
  }, { eventId: `product-deactivated-${updated.id}` });

  return success(c, updated);
});

// POST /internal/products/sync-metadata - Trigger metadata sync (brands, tags, product types)
app.post("/sync-metadata", zValidator("json", z.object({
  type: z.enum(["brands", "tags", "productTypes", "all"]),
})), async (c) => {
  const auth = c.get("auth")!;
  const { type } = c.req.valid("json");

  // Trigger the sync metadata task
  const handle = await tasks.trigger("sync-metadata", {
    organizationId: auth.organizationId,
    type,
  });

  console.log(`Triggered metadata sync job: ${handle.id}, type: ${type}`);

  return success(c, {
    message: `Sync initiated for ${type}`,
    jobId: handle.id,
  });
});

// POST /internal/products/sync-new - Trigger incremental sync for new products only
app.post("/sync-new", async (c) => {
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

  // Get access token
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

  // Trigger the incremental sync task
  const handle = await tasks.trigger("shopify-sync-new-products", {
    integrationId: shopifyIntegration.id,
    organizationId: auth.organizationId,
    shopDomain: shopifyIntegration.externalIdentifier,
    accessToken,
  });

  console.log(`Triggered incremental Shopify sync job: ${handle.id}`);

  return success(c, {
    message: "Incremental sync initiated",
    jobId: handle.id,
  });
});

// POST /internal/products/sync - Trigger product sync (supplier only)
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

  // Trigger the sync task
  const handle = await tasks.trigger("shopify-full-sync", {
    integrationId: shopifyIntegration.id,
    organizationId: auth.organizationId,
    shopDomain: shopifyIntegration.externalIdentifier,
    accessToken,
  });

  console.log(`Triggered Shopify sync job: ${handle.id}`);

  return success(c, {
    message: "Sync initiated",
    jobId: handle.id,
  });
});

export default app;
