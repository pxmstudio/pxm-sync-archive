/**
 * Backfill Inventory Item IDs Task
 *
 * One-time task to populate externalInventoryItemId for existing synced products.
 * This enables the inventory fast-path optimization for products that were
 * synced before the fast-path feature was deployed.
 */

import { task } from "@trigger.dev/sdk";
import { eq, isNull, and, isNotNull, inArray } from "drizzle-orm";
import {
  createDb,
  feedSyncedProducts,
  feedSubscriptionSyncSettings,
  integrations,
} from "@workspace/db";
import { ShopifyAdapter } from "@workspace/adapters/ecommerce";
import { getShopifyAccessToken } from "../../lib/credentials.js";

export interface BackfillInventoryIdsPayload {
  /** Optional: Only backfill for a specific integration */
  integrationId?: string;
  /** Optional: Only backfill for a specific sync settings */
  syncSettingsId?: string;
  /** Batch size for processing (default: 50) */
  batchSize?: number;
  /** Maximum number of records to process (for testing) */
  maxRecords?: number;
}

export interface BackfillInventoryIdsResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
  duration: number;
}

export const backfillInventoryItemIds = task({
  id: "backfill-inventory-item-ids",
  retry: {
    maxAttempts: 1, // Don't retry - this is a manual maintenance task
  },
  // Allow long runtime for large datasets
  maxDuration: 3600, // 1 hour
  run: async (payload: BackfillInventoryIdsPayload): Promise<BackfillInventoryIdsResult> => {
    const startTime = Date.now();
    const batchSize = payload.batchSize || 50;
    const maxRecords = payload.maxRecords || Infinity;

    const db = createDb(process.env.DATABASE_URL!);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log(
      `[Backfill] Starting inventory item ID backfill` +
        (payload.integrationId ? ` for integration ${payload.integrationId}` : "") +
        (payload.syncSettingsId ? ` for sync settings ${payload.syncSettingsId}` : "") +
        ` (batch size: ${batchSize})`
    );

    // Get all sync settings that need backfill, grouped by integration
    const syncSettingsQuery = db
      .select({
        syncSettingsId: feedSubscriptionSyncSettings.id,
        integrationId: feedSubscriptionSyncSettings.integrationId,
      })
      .from(feedSubscriptionSyncSettings)
      .where(
        and(
          payload.syncSettingsId
            ? eq(feedSubscriptionSyncSettings.id, payload.syncSettingsId)
            : undefined,
          payload.integrationId
            ? eq(feedSubscriptionSyncSettings.integrationId, payload.integrationId)
            : undefined
        )
      );

    const syncSettingsList = await syncSettingsQuery;

    // Group by integration
    const integrationMap = new Map<string, string[]>();
    for (const settings of syncSettingsList) {
      const existing = integrationMap.get(settings.integrationId) || [];
      existing.push(settings.syncSettingsId);
      integrationMap.set(settings.integrationId, existing);
    }

    console.log(
      `[Backfill] Found ${integrationMap.size} integrations with ${syncSettingsList.length} sync settings`
    );

    // Process each integration
    for (const [integrationId, syncSettingsIds] of integrationMap) {
      if (processed >= maxRecords) break;

      try {
        // Fetch integration details
        const integration = await db.query.integrations.findFirst({
          where: eq(integrations.id, integrationId),
        });

        if (!integration || !integration.externalIdentifier) {
          console.warn(`[Backfill] Skipping integration ${integrationId}: not found or no external identifier`);
          continue;
        }

        // Get Shopify access token
        const accessToken = await getShopifyAccessToken({
          credentialsRef: integration.credentialsRef,
        });

        if (!accessToken) {
          console.warn(`[Backfill] Skipping integration ${integrationId}: no access token`);
          continue;
        }

        // Initialize Shopify adapter
        const shopifyAdapter = new ShopifyAdapter({
          shopDomain: integration.externalIdentifier,
          accessToken,
        });

        console.log(
          `[Backfill] Processing integration ${integrationId} (${integration.name})`
        );

        // Process synced products for this integration in batches
        let hasMore = true;

        while (hasMore && processed < maxRecords) {
          // Fetch synced products that need inventory item IDs
          // No offset needed - processed products no longer match isNull(externalInventoryItemId)
          const recordsToProcess = await db
            .select({
              id: feedSyncedProducts.id,
              externalVariantId: feedSyncedProducts.externalVariantId,
              externalProductId: feedSyncedProducts.externalProductId,
            })
            .from(feedSyncedProducts)
            .where(
              and(
                inArray(feedSyncedProducts.syncSettingsId, syncSettingsIds),
                isNotNull(feedSyncedProducts.externalVariantId),
                isNull(feedSyncedProducts.externalInventoryItemId)
              )
            )
            .limit(Math.min(batchSize, maxRecords - processed));

          if (recordsToProcess.length === 0) {
            hasMore = false;
            break;
          }

          // Get unique variant IDs to fetch from Shopify
          const variantIds = recordsToProcess
            .map((r) => r.externalVariantId)
            .filter((id): id is string => id !== null);

          if (variantIds.length === 0) {
            // All records in batch already processed or have no variant IDs
            // This shouldn't happen given the query filters, but exit to prevent infinite loop
            hasMore = false;
            break;
          }

          // Fetch inventory item IDs from Shopify using the adapter method
          let variantInventoryMap = new Map<string, string>();

          try {
            variantInventoryMap = await shopifyAdapter.getVariantInventoryItemIds(variantIds);
          } catch (fetchError) {
            console.error(
              `[Backfill] Error fetching variants from Shopify:`,
              fetchError
            );
            errors++;
          }

          // Update records with inventory item IDs
          for (const record of recordsToProcess) {
            processed++;

            if (!record.externalVariantId) {
              skipped++;
              continue;
            }

            const inventoryItemId = variantInventoryMap.get(record.externalVariantId);

            if (!inventoryItemId) {
              skipped++;
              continue;
            }

            try {
              await db
                .update(feedSyncedProducts)
                .set({
                  externalInventoryItemId: inventoryItemId,
                  updatedAt: new Date(),
                })
                .where(eq(feedSyncedProducts.id, record.id));

              updated++;
            } catch (updateError) {
              console.error(
                `[Backfill] Error updating record ${record.id}:`,
                updateError
              );
              errors++;
            }
          }

          // Progress logging
          console.log(
            `[Backfill] Progress: ${processed} processed, ${updated} updated, ${skipped} skipped, ${errors} errors`
          );

          // Small delay between batches
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (integrationError) {
        console.error(
          `[Backfill] Error processing integration ${integrationId}:`,
          integrationError
        );
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    const result: BackfillInventoryIdsResult = {
      processed,
      updated,
      skipped,
      errors,
      duration,
    };

    console.log(
      `[Backfill] Completed in ${Math.round(duration / 1000)}s: ` +
        `${processed} processed, ${updated} updated, ${skipped} skipped, ${errors} errors`
    );

    return result;
  },
});
