/**
 * Refresh Shopify Store Metadata Cache
 *
 * This scheduled task periodically refreshes the cached metadata
 * (vendors, product types, tags) from Shopify stores for use in UI dropdowns.
 *
 * Runs every 6 hours to keep the cache fresh without overwhelming the API.
 */

import { schedules, task } from "@trigger.dev/sdk";
import { eq, and } from "drizzle-orm";
import {
  createDb,
  integrations,
  shopifyStoreMetadata,
} from "@workspace/db";
import { ShopifyAdapter } from "@workspace/adapters/ecommerce";
import { getShopifyAccessToken } from "../../lib/credentials.js";

// ============================================
// Metadata Refresh Task
// ============================================

interface RefreshMetadataPayload {
  integrationId: string;
}

/**
 * Refresh metadata for a single Shopify integration.
 * Uses a lightweight query to extract unique vendors, product types, and tags.
 */
export const refreshStoreMetadata = task({
  id: "refresh-store-metadata",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: RefreshMetadataPayload) => {
    const { integrationId } = payload;

    // Validate required parameter
    if (!integrationId) {
      console.error("[Metadata] Missing required integrationId parameter");
      return {
        success: false,
        error: "Missing required integrationId parameter. This task should be triggered by the scheduled-metadata-refresh task, not manually.",
      };
    }

    const db = createDb(process.env.DATABASE_URL!);

    console.log(`[Metadata] Refreshing metadata for integration ${integrationId}`);

    // Fetch the integration
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.id, integrationId),
        eq(integrations.isActive, "true"),
        eq(integrations.provider, "shopify")
      ),
    });

    if (!integration) {
      console.log(`[Metadata] Integration ${integrationId} not found or not active`);
      return { success: false, error: "Integration not found or not active" };
    }

    if (!integration.externalIdentifier) {
      console.log(`[Metadata] Integration ${integrationId} missing shop domain`);
      return { success: false, error: "Integration missing shop domain" };
    }

    try {
      // Get Shopify access token
      const accessToken = await getShopifyAccessToken(integration);

      // Initialize Shopify adapter
      const adapter = new ShopifyAdapter({
        shopDomain: integration.externalIdentifier,
        accessToken,
      });

      // Collect unique values using pagination
      const vendors = new Set<string>();
      const productTypes = new Set<string>();
      const tags = new Set<string>();
      let productCount = 0;

      // Iterate through all products
      for await (const product of adapter.iterateProducts()) {
        productCount++;

        if (product.vendor && product.vendor.trim()) {
          vendors.add(product.vendor.trim());
        }
        if (product.productType && product.productType.trim()) {
          productTypes.add(product.productType.trim());
        }
        for (const tag of product.tags) {
          if (tag && tag.trim()) {
            tags.add(tag.trim());
          }
        }

        // Log progress for large catalogs
        if (productCount % 1000 === 0) {
          console.log(`[Metadata] Processed ${productCount} products...`);
        }
      }

      console.log(
        `[Metadata] Completed: ${productCount} products, ${vendors.size} vendors, ${productTypes.size} types, ${tags.size} tags`
      );

      // Sort arrays for consistent ordering
      const sortedVendors = Array.from(vendors).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
      const sortedProductTypes = Array.from(productTypes).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );
      const sortedTags = Array.from(tags).sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase())
      );

      // Upsert the metadata cache
      const now = new Date();
      await db
        .insert(shopifyStoreMetadata)
        .values({
          integrationId,
          vendors: sortedVendors,
          productTypes: sortedProductTypes,
          tags: sortedTags,
          productCount: String(productCount),
          lastRefreshedAt: now,
          refreshError: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: shopifyStoreMetadata.integrationId,
          set: {
            vendors: sortedVendors,
            productTypes: sortedProductTypes,
            tags: sortedTags,
            productCount: String(productCount),
            lastRefreshedAt: now,
            refreshError: null,
            updatedAt: now,
          },
        });

      return {
        success: true,
        productCount,
        vendorCount: sortedVendors.length,
        productTypeCount: sortedProductTypes.length,
        tagCount: sortedTags.length,
      };
    } catch (error) {
      console.error(`[Metadata] Error refreshing metadata for ${integrationId}:`, error);

      // Record the error in the cache
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await db
        .insert(shopifyStoreMetadata)
        .values({
          integrationId,
          refreshError: errorMessage,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: shopifyStoreMetadata.integrationId,
          set: {
            refreshError: errorMessage,
            updatedAt: new Date(),
          },
        });

      return { success: false, error: errorMessage };
    }
  },
});

// ============================================
// Scheduled Refresh - Every 6 Hours
// ============================================

/**
 * Scheduled task to refresh all Shopify store metadata caches.
 * Runs every 6 hours to keep dropdown options fresh.
 */
export const scheduledMetadataRefresh = schedules.task({
  id: "scheduled-metadata-refresh",
  cron: "0 */6 * * *", // Every 6 hours (at minute 0)
  run: async () => {
    const db = createDb(process.env.DATABASE_URL!);

    console.log("[Metadata] Starting scheduled metadata refresh...");

    // Get all active Shopify integrations
    const activeIntegrations = await db
      .select({
        id: integrations.id,
        name: integrations.name,
        externalIdentifier: integrations.externalIdentifier,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.isActive, "true"),
          eq(integrations.provider, "shopify")
        )
      );

    console.log(`[Metadata] Found ${activeIntegrations.length} active Shopify integrations`);

    if (activeIntegrations.length === 0) {
      return {
        integrationsProcessed: 0,
        message: "No active Shopify integrations found",
      };
    }

    const results: Array<{
      integrationId: string;
      name: string;
      triggered: boolean;
      runId?: string;
      error?: string;
    }> = [];

    // Trigger refresh for each integration
    for (const integration of activeIntegrations) {
      try {
        const handle = await refreshStoreMetadata.trigger({
          integrationId: integration.id,
        });

        results.push({
          integrationId: integration.id,
          name: integration.name,
          triggered: true,
          runId: handle.id,
        });

        console.log(`[Metadata] Triggered refresh for ${integration.name} (${integration.id})`);
      } catch (error) {
        console.error(`[Metadata] Failed to trigger refresh for ${integration.name}:`, error);
        results.push({
          integrationId: integration.id,
          name: integration.name,
          triggered: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const triggered = results.filter((r) => r.triggered).length;
    const failed = results.filter((r) => !r.triggered).length;

    console.log(`[Metadata] Scheduled refresh complete: ${triggered} triggered, ${failed} failed`);

    return {
      integrationsProcessed: activeIntegrations.length,
      triggered,
      failed,
      results,
    };
  },
});
