import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { products, apiKeys, feedSubscriptions } from "@workspace/db";
import { Errors } from "../../lib/errors.js";
import { toCSV, toXML, type CatalogProduct } from "../../lib/catalog-serializers.js";
import type { Env, Variables, ApiKeyContext } from "../../types.js";
import {
  createOpenAPIApp,
  createRoute,
  z,
  commonErrorResponses,
} from "./openapi.js";

const app = createOpenAPIApp();

// Hash API key for comparison
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Custom API key auth middleware that also accepts api_key query parameter
const catalogApiKeyAuth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  // Try to get API key from query param first, then fall back to Authorization header
  let key = c.req.query("apiKey");

  if (!key) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      key = authHeader.slice(7);
    }
  }

  if (!key) {
    throw Errors.invalidApiKey();
  }

  // Validate key format (pxm_live_xxx or pxm_test_xxx)
  if (!key.startsWith("pxm_")) {
    throw Errors.invalidApiKey();
  }

  const db = c.get("db");
  const keyHash = await hashApiKey(key);

  // Find API key by hash
  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyHash, keyHash),
      isNull(apiKeys.revokedAt)
    ),
  });

  if (!apiKey) {
    throw Errors.invalidApiKey();
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw Errors.invalidApiKey();
  }

  // Check for catalog:read scope
  if (!apiKey.scopes || !apiKey.scopes.includes("catalog:read")) {
    throw Errors.insufficientScopes(["catalog:read"]);
  }

  // Update last used timestamp (fire and forget)
  const clientIp = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For");
  db.update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      lastUsedIp: clientIp || null,
    })
    .where(eq(apiKeys.id, apiKey.id))
    .execute()
    .catch(console.error);

  const apiKeyContext: ApiKeyContext = {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    scopes: apiKey.scopes || [],
  };

  c.set("apiKey", apiKeyContext);

  await next();
});

// Determine format from query param or Accept header
function getFormat(formatParam: string | undefined, acceptHeader: string | undefined): "csv" | "xml" {
  // Query param takes precedence
  if (formatParam === "xml") return "xml";
  if (formatParam === "csv") return "csv";

  // Check Accept header
  if (acceptHeader) {
    if (acceptHeader.includes("application/xml") || acceptHeader.includes("text/xml")) {
      return "xml";
    }
    if (acceptHeader.includes("text/csv")) {
      return "csv";
    }
  }

  // Default to CSV
  return "csv";
}

// GET /v1/catalog - Get full product catalog in XML or CSV format
const getCatalogRoute = createRoute({
  operationId: "getCatalog",
  method: "get",
  path: "/",
  tags: ["Catalog"],
  summary: "Get full product catalog",
  description: "Get the complete product catalog from your subscribed feeds in XML or CSV format. Requires the catalog:read scope. Supports authentication via Bearer token header OR apiKey query parameter.",
  security: [{ bearerAuth: [] }],
  middleware: [catalogApiKeyAuth] as const,
  request: {
    query: z.object({
      feedId: z.string().optional().openapi({
        description: "Optional feed ID to filter products by a specific feed",
        example: "feed_01234567890abcdefghijklmno",
      }),
      format: z.enum(["xml", "csv"]).optional().openapi({
        description: "Response format. Can also be specified via Accept header (text/csv or application/xml). Defaults to CSV.",
        example: "csv",
      }),
      apiKey: z.string().optional().openapi({
        description: "API key for authentication. Alternative to using Authorization header. Useful for direct URL access (e.g., importing into spreadsheets).",
        example: "pxm_live_xxxxxxxxxxxx",
      }),
    }),
  },
  responses: {
    200: {
      description: "Product catalog in requested format",
      content: {
        "text/csv": {
          schema: z.string().openapi({
            description: "CSV formatted catalog data",
          }),
        },
        "application/xml": {
          schema: z.string().openapi({
            description: "XML formatted catalog data",
          }),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(getCatalogRoute, async (c) => {
  const apiKeyContext = c.get("apiKey")!;
  const db = c.get("db");
  const { format: formatParam, feedId } = c.req.valid("query");
  const acceptHeader = c.req.header("Accept");

  const format = getFormat(formatParam, acceptHeader);

  // Get the organization's feed subscriptions
  const subscriptions = await db.query.feedSubscriptions.findMany({
    where: and(
      eq(feedSubscriptions.retailerId, apiKeyContext.organizationId),
      eq(feedSubscriptions.isActive, true)
    ),
    columns: {
      feedId: true,
    },
  });

  const subscribedFeedIds = subscriptions.map((s) => s.feedId);

  if (subscribedFeedIds.length === 0) {
    // No subscriptions - return empty catalog
    if (format === "xml") {
      return new Response(toXML([]), {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="catalog.xml"`,
        },
      });
    }
    return new Response(toCSV([]), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="catalog.csv"`,
      },
    });
  }

  // Build query conditions
  const conditions = [
    inArray(products.feedId, subscribedFeedIds),
    eq(products.isActive, "true"),
  ];

  // If feedId is provided, filter to that specific feed
  if (feedId) {
    if (!subscribedFeedIds.includes(feedId)) {
      throw Errors.forbidden("Not subscribed to this feed");
    }
    conditions.push(eq(products.feedId, feedId));
  }

  // Fetch all active products from subscribed feeds
  const allProducts = await db.query.products.findMany({
    where: and(...conditions),
    with: {
      variants: {
        with: {
          inventory: {
            columns: {
              quantity: true,
              reserved: true,
            },
          },
        },
      },
      feed: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [desc(products.updatedAt)],
  });

  // Transform to catalog format
  const catalogProducts: CatalogProduct[] = allProducts.map((p) => ({
    id: p.id,
    externalId: p.externalId,
    sku: p.sku,
    name: p.name,
    description: p.description,
    brand: p.brand,
    productType: p.productType,
    tags: p.tags,
    images: p.images,
    variants: p.variants.map((v: any) => ({
      id: v.id,
      externalId: v.externalId,
      sku: v.sku,
      name: v.name,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      currency: v.currency,
      attributes: v.attributes,
      available: v.inventory
        ? Number(v.inventory.quantity) - Number(v.inventory.reserved)
        : 0,
    })),
    supplier: p.feed ? {
      id: p.feed.id,
      name: p.feed.name,
      slug: p.feed.slug,
    } : { id: "", name: "Unknown", slug: null },
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  }));

  // Generate response in requested format
  if (format === "xml") {
    const xml = toXML(catalogProducts);
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="catalog.xml"`,
      },
    });
  }

  // Default: CSV
  const csv = toCSV(catalogProducts);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="catalog.csv"`,
    },
  });
});

export default app;
