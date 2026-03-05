/**
 * Inventory Reconciliation Task
 *
 * Periodically compares feed inventory quantities with Shopify inventory
 * and fixes any discrepancies. This is a safety net to catch any inventory
 * sync failures that slip through the normal sync flow.
 *
 * Runs every 6 hours by default.
 */

import { schedules, task } from "@trigger.dev/sdk";
import { eq, and, isNotNull, inArray, sql } from "drizzle-orm";
import {
  createDb,
  feedSyncedProducts,
  feedSubscriptionSyncSettings,
  integrations,
  variants,
  inventory,
} from "@workspace/db";
import { ShopifyAdapter } from "@workspace/adapters/ecommerce";
import { getShopifyAccessToken } from "../../lib/credentials.js";

// ============================================
// Types
// ============================================

export interface ReconcileInventoryPayload {
  /** Optional: Only reconcile for a specific integration */
  integrationId?: string;
  /** Optional: Only reconcile for a specific sync settings */
  syncSettingsId?: string;
  /** Batch size for processing (default: 100) */
  batchSize?: number;
  /** Maximum discrepancies to fix per run (default: 500) */
  maxFixes?: number;
  /** Only report discrepancies, don't fix them */
  dryRun?: boolean;
}

export interface ReconcileInventoryResult {
  integrationsProcessed: number;
  variantsChecked: number;
  discrepanciesFound: number;
  discrepanciesFixed: number;
  errors: number;
  duration: number;
  discrepancies: Array<{
    sku: string;
    feedQuantity: number;
    shopifyQuantity: number;
    fixed: boolean;
    error?: string;
  }>;
}

interface DiscrepancyRecord {
  syncedProductId: string;
  sourceVariantId: string;
  externalInventoryItemId: string;
  sku: string | null;
  feedQuantity: number;
  integrationId: string;
}

// ============================================
// Manual/On-Demand Reconciliation Task
// ============================================

export const reconcileInventory = task({
  id: "reconcile-inventory",
  retry: {
    maxAttempts: 1, // Don't retry - run on next schedule instead
  },
  maxDuration: 3600, // 1 hour
  run: async (payload: ReconcileInventoryPayload): Promise<ReconcileInventoryResult> => {
    const startTime = Date.now();
    const batchSize = payload.batchSize || 100;
    const maxFixes = payload.maxFixes || 500;
    const dryRun = payload.dryRun || false;

    const db = createDb(process.env.DATABASE_URL!);

    let integrationsProcessed = 0;
    let variantsChecked = 0;
    let discrepanciesFound = 0;
    let discrepanciesFixed = 0;
    let errors = 0;
    const discrepancies: ReconcileInventoryResult["discrepancies"] = [];

    console.log(
      `[Reconcile] Starting inventory reconciliation` +
        (payload.integrationId ? ` for integration ${payload.integrationId}` : "") +
        (payload.syncSettingsId ? ` for sync settings ${payload.syncSettingsId}` : "") +
        (dryRun ? " (DRY RUN)" : "") +
        ` (batch size: ${batchSize}, max fixes: ${maxFixes})`
    );

    // Build query conditions
    const conditions = [
      isNotNull(feedSyncedProducts.externalInventoryItemId),
      isNotNull(feedSyncedProducts.externalVariantId),
      eq(feedSyncedProducts.syncStatus, "synced"),
    ];

    if (payload.syncSettingsId) {
      conditions.push(eq(feedSyncedProducts.syncSettingsId, payload.syncSettingsId));
    }

    if (payload.integrationId) {
      conditions.push(eq(feedSubscriptionSyncSettings.integrationId, payload.integrationId));
    }

    // Get all synced products with inventory, grouped by integration
    // We need to join through sync settings to get integration ID
    const syncedVariantsQuery = await db
      .select({
        syncedProductId: feedSyncedProducts.id,
        sourceVariantId: feedSyncedProducts.sourceVariantId,
        externalInventoryItemId: feedSyncedProducts.externalInventoryItemId,
        integrationId: feedSubscriptionSyncSettings.integrationId,
      })
      .from(feedSyncedProducts)
      .innerJoin(
        feedSubscriptionSyncSettings,
        eq(feedSyncedProducts.syncSettingsId, feedSubscriptionSyncSettings.id)
      )
      .where(and(...conditions));

    console.log(`[Reconcile] Found ${syncedVariantsQuery.length} synced variants to check`);

    if (syncedVariantsQuery.length === 0) {
      return {
        integrationsProcessed: 0,
        variantsChecked: 0,
        discrepanciesFound: 0,
        discrepanciesFixed: 0,
        errors: 0,
        duration: Date.now() - startTime,
        discrepancies: [],
      };
    }

    // Get feed inventory for these variants
    const sourceVariantIds = syncedVariantsQuery.map((v) => v.sourceVariantId);
    const feedInventoryMap = new Map<string, { quantity: number; sku: string | null }>();

    // Batch fetch feed inventory
    for (let i = 0; i < sourceVariantIds.length; i += 1000) {
      const batch = sourceVariantIds.slice(i, i + 1000);
      const inventoryData = await db
        .select({
          variantId: variants.id,
          sku: variants.sku,
          quantity: sql<number>`COALESCE(${inventory.quantity}, 0)::int`,
        })
        .from(variants)
        .leftJoin(inventory, eq(inventory.variantId, variants.id))
        .where(inArray(variants.id, batch));

      for (const row of inventoryData) {
        feedInventoryMap.set(row.variantId, {
          quantity: row.quantity,
          sku: row.sku,
        });
      }
    }

    // Build lookup with feed data
    const variantsWithFeedData: DiscrepancyRecord[] = syncedVariantsQuery
      .filter((v) => v.externalInventoryItemId !== null)
      .map((v) => {
        const feedData = feedInventoryMap.get(v.sourceVariantId);
        return {
          syncedProductId: v.syncedProductId,
          sourceVariantId: v.sourceVariantId,
          externalInventoryItemId: v.externalInventoryItemId!,
          sku: feedData?.sku || null,
          feedQuantity: feedData?.quantity ?? 0,
          integrationId: v.integrationId,
        };
      });

    // Group by integration for efficient Shopify API calls
    const byIntegration = new Map<string, DiscrepancyRecord[]>();
    for (const variant of variantsWithFeedData) {
      const existing = byIntegration.get(variant.integrationId) || [];
      existing.push(variant);
      byIntegration.set(variant.integrationId, existing);
    }

    console.log(`[Reconcile] Processing ${byIntegration.size} integrations`);

    // Process each integration
    for (const [integrationId, integrationVariants] of byIntegration) {
      if (discrepanciesFixed >= maxFixes) {
        console.log(`[Reconcile] Reached max fixes limit (${maxFixes}), stopping`);
        break;
      }

      try {
        // Fetch integration details
        const integration = await db.query.integrations.findFirst({
          where: eq(integrations.id, integrationId),
        });

        if (!integration || !integration.externalIdentifier) {
          console.warn(`[Reconcile] Skipping integration ${integrationId}: not found`);
          continue;
        }

        // Get Shopify access token
        const accessToken = await getShopifyAccessToken({
          credentialsRef: integration.credentialsRef,
        });

        if (!accessToken) {
          console.warn(`[Reconcile] Skipping integration ${integrationId}: no access token`);
          continue;
        }

        // Initialize Shopify adapter
        const shopifyAdapter = new ShopifyAdapter({
          shopDomain: integration.externalIdentifier,
          accessToken,
        });

        integrationsProcessed++;
        console.log(
          `[Reconcile] Processing integration ${integrationId} (${integration.name}): ${integrationVariants.length} variants`
        );

        // Process in batches
        for (let i = 0; i < integrationVariants.length; i += batchSize) {
          if (discrepanciesFixed >= maxFixes) break;

          const batch = integrationVariants.slice(i, i + batchSize);
          const inventoryItemIds = batch.map((v) => v.externalInventoryItemId);

          // Fetch current Shopify inventory levels
          let shopifyLevels = new Map<string, number>();
          try {
            const levels = await shopifyAdapter.getInventoryLevels(inventoryItemIds);
            for (const [id, level] of levels) {
              shopifyLevels.set(id, level.available);
            }
          } catch (fetchError) {
            console.error(`[Reconcile] Error fetching Shopify inventory:`, fetchError);
            errors++;
            continue;
          }

          // Compare and fix discrepancies
          for (const variant of batch) {
            variantsChecked++;
            const shopifyQuantity = shopifyLevels.get(variant.externalInventoryItemId) ?? 0;

            if (variant.feedQuantity !== shopifyQuantity) {
              discrepanciesFound++;
              const discrepancy = {
                sku: variant.sku || "unknown",
                feedQuantity: variant.feedQuantity,
                shopifyQuantity,
                fixed: false,
                error: undefined as string | undefined,
              };

              if (!dryRun && discrepanciesFixed < maxFixes) {
                try {
                  await shopifyAdapter.setInventory(
                    variant.externalInventoryItemId,
                    variant.feedQuantity
                  );
                  discrepancy.fixed = true;
                  discrepanciesFixed++;
                  console.log(
                    `[Reconcile] Fixed ${variant.sku}: ${shopifyQuantity} -> ${variant.feedQuantity}`
                  );
                } catch (fixError) {
                  discrepancy.error =
                    fixError instanceof Error ? fixError.message : String(fixError);
                  errors++;
                  console.error(
                    `[Reconcile] Failed to fix ${variant.sku}:`,
                    discrepancy.error
                  );
                }
              }

              // Only track first 100 discrepancies in detail
              if (discrepancies.length < 100) {
                discrepancies.push(discrepancy);
              }
            }
          }

          // Small delay between batches
          if (i + batchSize < integrationVariants.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      } catch (integrationError) {
        console.error(`[Reconcile] Error processing integration ${integrationId}:`, integrationError);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    const result: ReconcileInventoryResult = {
      integrationsProcessed,
      variantsChecked,
      discrepanciesFound,
      discrepanciesFixed,
      errors,
      duration,
      discrepancies,
    };

    console.log(
      `[Reconcile] Completed in ${Math.round(duration / 1000)}s: ` +
        `${integrationsProcessed} integrations, ${variantsChecked} variants checked, ` +
        `${discrepanciesFound} discrepancies found, ${discrepanciesFixed} fixed, ${errors} errors`
    );

    return result;
  },
});

// ============================================
// Scheduled Reconciliation (every 6 hours)
// ============================================

export const scheduledInventoryReconciliation = schedules.task({
  id: "scheduled-inventory-reconciliation",
  cron: "0 */6 * * *", // Every 6 hours at minute 0
  run: async () => {
    console.log("[Reconcile] Starting scheduled inventory reconciliation...");

    const handle = await reconcileInventory.triggerAndWait({
      batchSize: 100,
      maxFixes: 500,
      dryRun: false,
    });

    if (handle.ok) {
      const result = handle.output;
      console.log(
        `[Reconcile] Scheduled reconciliation complete: ` +
          `${result.discrepanciesFound} discrepancies found, ${result.discrepanciesFixed} fixed`
      );
      return {
        success: true,
        ...result,
      };
    } else {
      console.error("[Reconcile] Scheduled reconciliation failed");
      return {
        success: false,
        error: "Task failed",
      };
    }
  },
});
