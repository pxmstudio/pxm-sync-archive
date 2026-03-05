import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import { integrations, syncCursors, storeSyncRuns, shopifyStoreMetadata } from "@workspace/db";
import {
  updateIntegration,
  triggerSync,
} from "@workspace/validators/integrations";
import { success } from "../../lib/response.js";
import { Errors, ApiException } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";
import { z } from "zod";
import { ShopifyAdapter } from "@workspace/adapters/ecommerce";
import type { EcommerceWebhookTopic } from "@workspace/adapters/ecommerce";
import {
  encryptCredentials,
  getCredentials,
} from "../../lib/credentials.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Helper: Get Shopify access token from integration credentials (async for KMS decryption)
async function getShopifyAccessToken(
  env: Env,
  integration: {
    credentialsRef: string | null;
  }
): Promise<string> {
  if (!integration.credentialsRef) {
    throw new Error("Integration missing credentials");
  }

  const creds = await getCredentials<{ accessToken: string }>(
    env,
    integration.credentialsRef
  );

  if (!creds?.accessToken) {
    throw new Error("Integration credentials missing access token");
  }

  return creds.accessToken;
}

// GET /internal/integrations - List integrations
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const items = await db.query.integrations.findMany({
    where: eq(integrations.organizationId, auth.organizationId),
  });

  return success(c, items);
});

// GET /internal/integrations/:id - Get integration details
app.get("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId)
    ),
  });

  if (!integration) {
    throw Errors.notFound("Integration");
  }

  return success(c, integration);
});

// GET /internal/integrations/:id/publications - Fetch available Shopify publications/sales channels
app.get("/:id/publications", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.isActive, "true")
    ),
  });

  if (!integration) {
    throw Errors.notFound("Active integration");
  }

  if (integration.provider !== "shopify") {
    throw Errors.badRequest("Publications only available for Shopify integrations");
  }

  const shopDomain = integration.externalIdentifier;
  if (!shopDomain) {
    throw Errors.badRequest("Integration missing shop domain");
  }

  // Get access token
  const accessToken = await getShopifyAccessToken(c.env, integration);

  // Fetch publications from Shopify GraphQL API
  const query = `
    query {
      publications(first: 20) {
        edges {
          node {
            id
            name
            app {
              title
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    `https://${shopDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    throw Errors.badRequest("Failed to fetch publications from Shopify");
  }

  const data = (await response.json()) as {
    data?: {
      publications?: {
        edges: Array<{
          node: {
            id: string;
            name: string;
            app?: { title: string };
          };
        }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (data.errors?.length) {
    throw Errors.badRequest(`Shopify API error: ${data.errors[0].message}`);
  }

  const publications = (data.data?.publications?.edges || []).map((edge) => ({
    id: edge.node.id,
    name: edge.node.name,
    appTitle: edge.node.app?.title,
  }));

  return success(c, {
    publications,
    integrationId: id,
  });
});

// GET /internal/integrations/:id/metafield-definitions - Fetch product metafield definitions from Shopify
app.get("/:id/metafield-definitions", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");
  const namespace = c.req.query("namespace"); // Optional namespace filter

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.isActive, "true")
    ),
  });

  if (!integration) {
    throw Errors.notFound("Active integration");
  }

  if (integration.provider !== "shopify") {
    throw Errors.badRequest("Metafield definitions only available for Shopify integrations");
  }

  const shopDomain = integration.externalIdentifier;
  if (!shopDomain) {
    throw Errors.badRequest("Integration missing shop domain");
  }

  // Get access token
  const accessToken = await getShopifyAccessToken(c.env, integration);

  // Fetch product metafield definitions from Shopify GraphQL API
  const query = `
    query ProductMetafieldDefinitions($namespace: String) {
      metafieldDefinitions(ownerType: PRODUCT, namespace: $namespace, first: 100) {
        edges {
          node {
            id
            namespace
            key
            name
            type {
              name
            }
          }
        }
      }
    }
  `;

  const response = await fetch(
    `https://${shopDomain}/admin/api/2024-10/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { namespace: namespace || null },
      }),
    }
  );

  if (!response.ok) {
    throw Errors.badRequest("Failed to fetch metafield definitions from Shopify");
  }

  const data = (await response.json()) as {
    data?: {
      metafieldDefinitions?: {
        edges: Array<{
          node: {
            id: string;
            namespace: string;
            key: string;
            name: string;
            type: { name: string };
          };
        }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (data.errors?.length) {
    throw Errors.badRequest(`Shopify API error: ${data.errors[0].message}`);
  }

  const metafieldDefinitions = (data.data?.metafieldDefinitions?.edges || []).map((edge) => ({
    id: edge.node.id,
    namespace: edge.node.namespace,
    key: edge.node.key,
    name: edge.node.name,
    type: edge.node.type.name,
    // Full key for display: namespace.key
    fullKey: `${edge.node.namespace}.${edge.node.key}`,
  }));

  return success(c, {
    metafieldDefinitions,
    integrationId: id,
  });
});

// GET /internal/integrations/:id/store-metadata - Get cached Shopify store metadata (vendors, product types, tags)
app.get("/:id/store-metadata", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.isActive, "true")
    ),
  });

  if (!integration) {
    throw Errors.notFound("Active integration");
  }

  if (integration.provider !== "shopify") {
    throw Errors.badRequest("Store metadata only available for Shopify integrations");
  }

  // Lazy backfill: if currency is not set, fetch from Shopify and update
  let currency = integration.currency;
  if (!currency && integration.externalIdentifier) {
    try {
      const accessToken = await getShopifyAccessToken(c.env, integration);
      const shopify = new ShopifyAdapter({
        shopDomain: integration.externalIdentifier,
        accessToken,
      });
      currency = await shopify.getStoreCurrency();

      // Update the integration with the fetched currency
      if (currency) {
        await db
          .update(integrations)
          .set({ currency, updatedAt: new Date() })
          .where(eq(integrations.id, id));
      }
    } catch (err) {
      console.error("Failed to backfill store currency:", err);
    }
  }

  // Fetch cached metadata
  const metadata = await db.query.shopifyStoreMetadata.findFirst({
    where: eq(shopifyStoreMetadata.integrationId, id),
  });

  if (!metadata) {
    return success(c, {
      integrationId: id,
      vendors: [],
      productTypes: [],
      tags: [],
      productCount: null,
      lastRefreshedAt: null,
      refreshError: null,
      currency,
      message: "No cached metadata available. Metadata will be populated by the scheduled refresh task.",
    });
  }

  return success(c, {
    integrationId: id,
    vendors: metadata.vendors ?? [],
    productTypes: metadata.productTypes ?? [],
    tags: metadata.tags ?? [],
    productCount: metadata.productCount ? parseInt(metadata.productCount, 10) : null,
    lastRefreshedAt: metadata.lastRefreshedAt,
    refreshError: metadata.refreshError,
    currency,
  });
});

// POST /internal/integrations/shopify/connect - Connect using Admin API access token
// Works for both suppliers (import products) and retailers (export products)
app.post(
  "/shopify/connect",
  zValidator(
    "json",
    z.object({
      shopDomain: z.string().min(1, "Shop domain is required"),
      accessToken: z.string().min(1, "Access token is required"),
    })
  ),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const data = c.req.valid("json");

    // PXM Sync integrations are always for exporting products to stores
    const purpose: "import" | "export" = "export";

    // Normalize shop domain
    let shopDomain = data.shopDomain.trim().toLowerCase();
    if (!shopDomain.endsWith(".myshopify.com")) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }

    // Validate domain format
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
      throw Errors.badRequest("Invalid shop domain format");
    }

    // Verify the access token by fetching shop details
    const shopResponse = await fetch(
      `https://${shopDomain}/admin/api/2024-10/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": data.accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    if (!shopResponse.ok) {
      const error = await shopResponse.text();
      console.error("Shopify token verification error:", error);
      if (shopResponse.status === 401) {
        throw Errors.badRequest("Invalid access token");
      }
      throw Errors.badRequest("Failed to verify access token with Shopify");
    }

    const shopData = (await shopResponse.json()) as {
      shop: { name: string; currency: string };
    };
    const shopName = shopData.shop.name;
    const shopCurrency = shopData.shop.currency;

    // Check for existing integration
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.organizationId, auth.organizationId),
        eq(integrations.provider, "shopify"),
        eq(integrations.externalIdentifier, shopDomain)
      ),
    });

    let result;

    // Build settings for export integrations
    const settingsToUse = {
      shopifyApiVersion: "2024-10",
      purpose,
      exportEnabled: true,
      defaultSyncInterval: 24, // hours
    };

    if (existing) {
      // Encrypt credentials with KMS
      const encryptedCredentials = await encryptCredentials(
        c.env,
        { accessToken: data.accessToken },
        {
          organizationId: auth.organizationId,
          integrationId: existing.id,
          resourceType: "shopify",
        }
      );

      // Update existing integration
      const [updated] = await db
        .update(integrations)
        .set({
          name: `Shopify - ${shopName}`,
          credentialsRef: encryptedCredentials,
          settings: { ...(existing.settings || {}), ...settingsToUse },
          currency: shopCurrency,
          isActive: "true",
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id))
        .returning();
      result = updated;
    } else {
      // First create the integration without credentials to get the ID
      const [integration] = await db
        .insert(integrations)
        .values({
          organizationId: auth.organizationId,
          provider: "shopify",
          name: `Shopify - ${shopName}`,
          externalIdentifier: shopDomain,
          settings: settingsToUse,
          currency: shopCurrency,
          isActive: "true",
        })
        .returning();

      // Now encrypt credentials with the integration ID in context
      const encryptedCredentials = await encryptCredentials(
        c.env,
        { accessToken: data.accessToken },
        {
          organizationId: auth.organizationId,
          integrationId: integration.id,
          resourceType: "shopify",
        }
      );

      // Update with encrypted credentials
      await db
        .update(integrations)
        .set({ credentialsRef: encryptedCredentials })
        .where(eq(integrations.id, integration.id));
      result = integration;
    }

    // Register webhooks for order sync, inventory sync, etc.
    let webhooksRegistered = false;
    let webhooksError: string | undefined;

    try {
      const adapter = new ShopifyAdapter({
        shopDomain,
        accessToken: data.accessToken,
      });

      // WEBHOOK_BASE_URL allows overriding the webhook callback URL for different environments
      const webhookBaseUrl = c.env.WEBHOOK_BASE_URL || c.env.API_URL;
      if (!webhookBaseUrl) {
        throw new Error("WEBHOOK_BASE_URL or API_URL environment variable not set");
      }
      const callbackUrl = `${webhookBaseUrl}/webhooks/shopify`;

      // Webhook topics for export integrations
      const webhookTopics: EcommerceWebhookTopic[] = [
        "orders/create", // For auto-ordering from retailer's Shopify
      ];

      await adapter.registerWebhooks(webhookTopics, callbackUrl);
      console.log(`Registered ${webhookTopics.length} webhooks for ${shopDomain} (${purpose})`);
      webhooksRegistered = true;
    } catch (err) {
      webhooksError = err instanceof Error ? err.message : "Unknown error";
      console.error(`Failed to register webhooks for ${shopDomain}:`, webhooksError);
    }

    // Update settings with webhook registration status
    const currentSettings = (result?.settings as Record<string, unknown>) || {};
    await db
      .update(integrations)
      .set({
        settings: {
          ...currentSettings,
          webhooksRegistered,
          webhooksRegisteredAt: webhooksRegistered ? new Date().toISOString() : undefined,
          webhooksError: webhooksError,
        },
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, result!.id));

    // Store registration with platform (handled locally, no-op)
    console.log(`[Studio] Store registered locally: ${shopDomain}`);

    return success(c, {
      ...result,
      shopName,
      purpose,
      webhooksRegistered,
      webhooksError,
    }, existing ? 200 : 201);
  }
);

// POST /internal/integrations/:id/token - Get access token for integration
app.post("/:id/token", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.isActive, "true")
    ),
  });

  if (!integration) {
    throw Errors.notFound("Active integration");
  }

  if (integration.provider !== "shopify") {
    throw Errors.badRequest("Token retrieval only supported for Shopify");
  }

  try {
    const accessToken = await getShopifyAccessToken(c.env, integration);
    return success(c, { accessToken });
  } catch (error) {
    console.error("Token retrieval error:", error);
    throw Errors.badRequest("Failed to get access token");
  }
});

// PATCH /internal/integrations/:id - Update integration settings
app.patch("/:id", zValidator("json", updateIntegration), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId)
    ),
  });

  if (!integration) {
    throw Errors.notFound("Integration");
  }

  const [updated] = await db
    .update(integrations)
    .set({
      ...(data.name && { name: data.name }),
      ...(data.settings && {
        settings: { ...integration.settings, ...data.settings },
      }),
      ...(data.isActive !== undefined && { isActive: data.isActive.toString() }),
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, id))
    .returning();

  return success(c, updated);
});

// DELETE /internal/integrations/:id - Disconnect integration
app.delete("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId)
    ),
  });

  if (!integration) {
    throw Errors.notFound("Integration");
  }

  // Hard delete - cascades to related tables (syncCursors, fieldMappings, etc.)
  await db.delete(integrations).where(eq(integrations.id, id));

  return c.body(null, 204);
});

// POST /internal/integrations/:id/sync - Trigger sync
// NOTE: This endpoint is deprecated. Use POST /subscriptions/:subscriptionId/:integrationId/sync instead.
// Sync is now triggered at the subscription level, not the integration level.
app.post("/:id/sync", zValidator("json", triggerSync.omit({ integrationId: true })), async (c) => {
  // Return a helpful error pointing to the correct endpoint
  throw new ApiException(
    501,
    "NOT_IMPLEMENTED",
    "Integration-level sync is not supported. Use POST /internal/subscriptions/:subscriptionId/:integrationId/sync to trigger a sync for a specific feed subscription."
  );
});

// GET /internal/integrations/:id/status - Get sync status
// Returns the status of the most recent sync run for this integration
app.get("/:id/status", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId)
    ),
  });

  if (!integration) {
    throw Errors.notFound("Integration");
  }

  // Get the most recent sync run for this integration
  const latestRun = await db.query.storeSyncRuns.findFirst({
    where: eq(storeSyncRuns.integrationId, id),
    orderBy: (runs, { desc }) => [desc(runs.createdAt)],
    columns: {
      status: true,
      startedAt: true,
      completedAt: true,
    },
  });

  // Derive status from the latest run
  const status = latestRun?.status === "running" || latestRun?.status === "pending"
    ? latestRun.status
    : "idle";

  return success(c, {
    integrationId: id,
    status,
    lastSyncAt: latestRun?.completedAt ?? integration.lastSyncAt,
    lastSyncError: integration.lastSyncError,
  });
});

// POST /internal/integrations/:id/webhooks - Register webhooks for integration
// Works for both supplier (import) and retailer (export) integrations
app.post("/:id/webhooks", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, id),
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.isActive, "true")
    ),
  });

  if (!integration) {
    throw Errors.notFound("Active integration");
  }

  if (integration.provider !== "shopify") {
    throw Errors.badRequest("Webhook registration only supported for Shopify integrations");
  }

  // Get purpose from settings (defaults to export for PXM Sync)
  const integrationSettings = integration.settings as { purpose?: "import" | "export" } | null;
  const purpose = integrationSettings?.purpose || "export";

  // Get access token
  const accessToken = await getShopifyAccessToken(c.env, integration);

  const shopDomain = integration.externalIdentifier;
  if (!shopDomain) {
    throw Errors.badRequest("Integration missing shop domain");
  }

  // WEBHOOK_BASE_URL allows overriding the webhook callback URL for different environments
  const webhookBaseUrl = c.env.WEBHOOK_BASE_URL || c.env.API_URL;
  if (!webhookBaseUrl) {
    throw Errors.badRequest("WEBHOOK_BASE_URL or API_URL not configured - cannot register webhooks");
  }

  const callbackUrl = `${webhookBaseUrl}/webhooks/shopify`;

  try {
    const adapter = new ShopifyAdapter({
      shopDomain,
      accessToken,
    });

    // Webhook topics for export integrations
    const webhookTopics: EcommerceWebhookTopic[] = [
      "orders/create", // For auto-ordering from retailer's Shopify
    ];

    await adapter.registerWebhooks(webhookTopics, callbackUrl);
    console.log(`Registered ${webhookTopics.length} webhooks for ${shopDomain} (${purpose})`);

    // Update settings with webhook registration status
    const currentSettings = (integration.settings as Record<string, unknown>) || {};
    await db
      .update(integrations)
      .set({
        settings: {
          ...currentSettings,
          webhooksRegistered: true,
          webhooksRegisteredAt: new Date().toISOString(),
          webhooksError: undefined,
        },
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id));

    return success(c, {
      message: "Webhooks registered successfully",
      callbackUrl,
      topics: webhookTopics,
      purpose,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to register webhooks for ${shopDomain}:`, errorMessage);

    // Update settings with error
    const currentSettings = (integration.settings as Record<string, unknown>) || {};
    await db
      .update(integrations)
      .set({
        settings: {
          ...currentSettings,
          webhooksRegistered: false,
          webhooksError: errorMessage,
        },
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id));

    throw Errors.badRequest(`Failed to register webhooks: ${errorMessage}`);
  }
});

export default app;
export { getShopifyAccessToken };
