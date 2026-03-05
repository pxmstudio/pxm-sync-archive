/**
 * Store sync - Bulk change product status in Shopify stores
 *
 * This task handles changing the status of all synced products for a given
 * sync settings configuration. It iterates through all synced products and
 * updates their Shopify status to Active, Draft, or Archived.
 *
 * IMPORTANT: This task respects the filter rules configured in sync settings,
 * only affecting products that match the current filter criteria.
 */

import { task } from "@trigger.dev/sdk";
import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";
import {
  createDb,
  integrations,
  feedSubscriptionSyncSettings,
  feedSyncedProducts,
  products,
  variants,
  inventory,
  retailerFieldMappings,
  type FilterRules,
  type SyncExclusionRule,
} from "@workspace/db";
import { ShopifyAdapter } from "@workspace/adapters/ecommerce";
import { getShopifyAccessToken } from "../../lib/credentials.js";
import { withThrottleRetry, publishToChannels, matchesFilters, shouldExcludeProduct } from "./utils/index.js";
import type { ProductWithVariants } from "./types.js";

export interface BulkChangeStatusPayload {
  syncSettingsId: string;
  targetStatus: "ACTIVE" | "DRAFT" | "ARCHIVED";
  triggeredBy?: "manual" | "api";
  triggeredByUserId?: string;
  /** Optional publication IDs to publish products to when setting to ACTIVE */
  publicationIds?: string[];
}

export interface BulkChangeStatusResult {
  updated: number;
  failed: number;
  total: number;
  errors?: Array<{ productId: string; error: string }>;
  completedAt: string;
}

/**
 * Bulk change status of all synced products in Shopify
 */
export const storeBulkChangeStatus = task({
  id: "store-bulk-change-status",
  retry: {
    maxAttempts: 3,
  },
  machine: "small-1x",
  maxDuration: 3600, // 1 hour max
  queue: {
    name: "store-sync",
    concurrencyLimit: 1,
  },
  run: async (payload: BulkChangeStatusPayload): Promise<BulkChangeStatusResult> => {
    console.log(`Starting bulk status change for sync settings ${payload.syncSettingsId} to ${payload.targetStatus}`);

    const db = createDb(process.env.DATABASE_URL!);

    // Fetch sync settings
    const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.id, payload.syncSettingsId),
    });

    if (!syncSettings) {
      throw new Error(`Sync settings not found: ${payload.syncSettingsId}`);
    }

    // Fetch the integration (store's Shopify)
    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, syncSettings.integrationId),
    });

    if (!integration) {
      throw new Error(`Integration not found: ${syncSettings.integrationId}`);
    }

    // Get Shopify access token
    const accessToken = await getShopifyAccessToken({ credentialsRef: integration.credentialsRef });

    if (!accessToken) {
      throw new Error("Failed to get Shopify access token");
    }

    // Initialize Shopify adapter
    const shopifyAdapter = new ShopifyAdapter({
      shopDomain: integration.externalIdentifier!,
      accessToken,
    });

    // Fetch global settings from retailerFieldMappings (per-integration settings from /sync page)
    const globalMappings = await db.query.retailerFieldMappings.findFirst({
      where: eq(retailerFieldMappings.integrationId, integration.id),
    });

    // Get filter rules from sync settings
    const filterRules: FilterRules = (syncSettings.filterRules || {}) as FilterRules;
    const hasFilters = Object.keys(filterRules).some(key => {
      const value = filterRules[key as keyof FilterRules];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return true;
      return false;
    });

    // Get exclusion rules - priority: per-feed override > global settings
    const exclusionRules: SyncExclusionRule[] =
      (syncSettings.exclusionRules as SyncExclusionRule[] | null) ??
      (globalMappings?.exclusionRules || []) as SyncExclusionRule[];
    const hasExclusionRules = exclusionRules.some(rule => rule.enabled);

    console.log(`[Bulk Status] Filter rules:`, hasFilters ? filterRules : 'none');
    console.log(`[Bulk Status] Exclusion rules:`, hasExclusionRules ? `${exclusionRules.filter(r => r.enabled).length} enabled` : 'none');

    // Query all synced products with externalProductId (only successfully synced)
    const syncedProducts = await db
      .select({
        sourceProductId: feedSyncedProducts.sourceProductId,
        externalProductId: feedSyncedProducts.externalProductId,
      })
      .from(feedSyncedProducts)
      .where(
        and(
          eq(feedSyncedProducts.syncSettingsId, payload.syncSettingsId),
          eq(feedSyncedProducts.syncStatus, "synced"),
          isNotNull(feedSyncedProducts.externalProductId)
        )
      );

    // Deduplicate by externalProductId (variants share the same product)
    // Map: externalProductId -> sourceProductId
    const uniqueProducts = new Map<string, string>();
    for (const synced of syncedProducts) {
      if (synced.externalProductId && !uniqueProducts.has(synced.externalProductId)) {
        uniqueProducts.set(synced.externalProductId, synced.sourceProductId);
      }
    }

    console.log(`[Bulk Status] Found ${uniqueProducts.size} unique synced products`);

    // If filters or exclusion rules are configured, fetch source products and apply them
    let filteredProductIds: string[] = [];

    if (hasFilters || hasExclusionRules) {
      // Get all unique source product IDs
      const sourceProductIds = Array.from(new Set(uniqueProducts.values()));

      // Fetch source products with their data
      const sourceProducts = await db
        .select({
          id: products.id,
          name: products.name,
          brand: products.brand,
          productType: products.productType,
          tags: products.tags,
        })
        .from(products)
        .where(inArray(products.id, sourceProductIds));

      // Create a map of source product data
      const sourceProductMap = new Map(sourceProducts.map(p => [p.id, p]));

      // Fetch variants for all source products with inventory
      const allVariants = await db
        .select({
          productId: variants.productId,
          sku: variants.sku,
          price: variants.price,
          inventoryQuantity: sql<number>`COALESCE(${inventory.quantity}, 0)::int`,
        })
        .from(variants)
        .leftJoin(inventory, eq(inventory.variantId, variants.id))
        .where(inArray(variants.productId, sourceProductIds));

      // Group variants by product
      const variantsByProduct = new Map<string, Array<{
        productId: string;
        sku: string | null;
        price: string;
        inventoryQuantity: number;
      }>>();
      for (const variant of allVariants) {
        const existing = variantsByProduct.get(variant.productId) || [];
        existing.push(variant);
        variantsByProduct.set(variant.productId, existing);
      }

      // Filter products based on filter rules
      for (const [externalProductId, sourceProductId] of uniqueProducts) {
        const sourceProduct = sourceProductMap.get(sourceProductId);
        if (!sourceProduct) {
          console.log(`[Bulk Status] Source product not found for ${sourceProductId}, skipping`);
          continue;
        }

        const productVariants = variantsByProduct.get(sourceProductId) || [];

        // Build a minimal ProductWithVariants for filter matching
        const productWithVariants = {
          id: sourceProduct.id,
          name: sourceProduct.name,
          brand: sourceProduct.brand,
          productType: sourceProduct.productType,
          tags: sourceProduct.tags || [],
          variants: productVariants.map(v => ({
            sku: v.sku,
            price: v.price,
            inventoryQuantity: v.inventoryQuantity,
          })),
        } as ProductWithVariants;

        // Check if product should be excluded by exclusion rules
        if (hasExclusionRules && shouldExcludeProduct(productWithVariants, exclusionRules)) {
          console.log(`[Bulk Status] Product ${sourceProduct.name} (${sourceProductId}) skipped - matched exclusion rule`);
          continue;
        }

        // Check if product matches filters
        if (hasFilters && !matchesFilters(productWithVariants, filterRules)) {
          console.log(`[Bulk Status] Product ${sourceProduct.name} (${sourceProductId}) skipped - doesn't match filters`);
          continue;
        }

        filteredProductIds.push(externalProductId);
      }

      console.log(`[Bulk Status] After filtering: ${filteredProductIds.length} products match filters/exclusion rules`);
    } else {
      // No filters, use all products
      filteredProductIds = Array.from(uniqueProducts.keys());
    }

    const total = filteredProductIds.length;

    console.log(`[Bulk Status] Found ${total} products to update (after filters)`);

    if (total === 0) {
      return {
        updated: 0,
        failed: 0,
        total: 0,
        completedAt: new Date().toISOString(),
      };
    }

    let updated = 0;
    let failed = 0;
    const errors: Array<{ productId: string; error: string }> = [];

    // Process in batches of 10 for parallel processing
    const BATCH_SIZE = 10;

    for (let i = 0; i < filteredProductIds.length; i += BATCH_SIZE) {
      const batch = filteredProductIds.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(filteredProductIds.length / BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (externalProductId) => {
          try {
            await withThrottleRetry(
              () => shopifyAdapter.productSet(externalProductId, { status: payload.targetStatus }),
              { label: `setStatus-${externalProductId}` }
            );

            // If setting to ACTIVE and publicationIds provided, publish to channels
            if (payload.targetStatus === "ACTIVE" && payload.publicationIds && payload.publicationIds.length > 0) {
              await withThrottleRetry(
                () => publishToChannels(
                  integration.externalIdentifier!,
                  accessToken,
                  externalProductId,
                  { mode: "override", publicationIds: payload.publicationIds! },
                  undefined
                ),
                { label: `publish-${externalProductId}` }
              );
            }

            return { success: true, productId: externalProductId };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, productId: externalProductId, error: errorMessage };
          }
        })
      );

      // Count results
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            updated++;
          } else {
            failed++;
            errors.push({
              productId: result.value.productId,
              error: result.value.error || "Unknown error",
            });
          }
        } else {
          failed++;
          errors.push({
            productId: "unknown",
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          });
        }
      }

      console.log(
        `[Bulk Status] Batch ${batchNumber}/${totalBatches} complete: ${updated} updated, ${failed} failed`
      );

      // Small delay between batches
      if (i + BATCH_SIZE < filteredProductIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.log(
      `Bulk status change completed: ${updated} updated, ${failed} failed out of ${total}`
    );

    return {
      updated,
      failed,
      total,
      errors: errors.length > 0 ? errors.slice(0, 50) : undefined, // Limit errors to 50
      completedAt: new Date().toISOString(),
    };
  },
});
