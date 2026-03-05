/**
 * Backfill Product Hashes Task
 *
 * One-time task to compute content hashes for existing products.
 * Run this after deploying the incremental sync feature to populate
 * hash columns for products that were imported before the feature.
 */

import { task } from "@trigger.dev/sdk";
import { eq, isNull, and, inArray } from "drizzle-orm";
import { createDb, products, variants, inventory } from "@workspace/db";
import {
  computeProductHashes,
  computeInventoryHash,
} from "../../lib/change-detection/index.js";

export interface BackfillHashesPayload {
  /** Optional: Only backfill products for a specific feed */
  feedId?: string;
  /** Batch size for processing (default: 100) */
  batchSize?: number;
  /** Maximum number of products to process (for testing) */
  maxProducts?: number;
}

export interface BackfillHashesResult {
  processed: number;
  skipped: number;
  errors: number;
  duration: number;
}

export const backfillProductHashes = task({
  id: "backfill-product-hashes",
  retry: {
    maxAttempts: 1, // Don't retry - this is a manual maintenance task
  },
  // Allow long runtime for large datasets
  maxDuration: 3600, // 1 hour
  run: async (payload: BackfillHashesPayload): Promise<BackfillHashesResult> => {
    const startTime = Date.now();
    const batchSize = payload.batchSize || 100;
    const maxProducts = payload.maxProducts || Infinity;

    const db = createDb(process.env.DATABASE_URL!);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    console.log(
      `[Backfill] Starting hash backfill` +
        (payload.feedId ? ` for feed ${payload.feedId}` : "") +
        ` (batch size: ${batchSize})`
    );

    while (processed + skipped < maxProducts) {
      // Fetch products without content hash
      // No offset needed - processed products no longer match isNull(contentHash)
      const productsToProcess = await db.query.products.findMany({
        where: and(
          isNull(products.contentHash),
          payload.feedId ? eq(products.feedId, payload.feedId) : undefined
        ),
        limit: Math.min(batchSize, maxProducts - processed - skipped),
        columns: {
          id: true,
          name: true,
          description: true,
          brand: true,
          productType: true,
          tags: true,
          images: true,
        },
      });

      if (productsToProcess.length === 0) {
        console.log(`[Backfill] No more products to process`);
        break;
      }

      // Process each product
      for (const product of productsToProcess) {
        try {
          // Fetch variants for this product
          const productVariants = await db.query.variants.findMany({
            where: eq(variants.productId, product.id),
            columns: {
              id: true,
              sku: true,
              barcode: true,
              price: true,
              compareAtPrice: true,
              costPrice: true,
              weight: true,
              weightUnit: true,
              attributes: true,
            },
          });

          // Fetch inventory for variants
          const variantIds = productVariants.map((v) => v.id);
          const inventoryRecords =
            variantIds.length > 0
              ? await db.query.inventory.findMany({
                  where: inArray(inventory.variantId, variantIds),
                  columns: {
                    variantId: true,
                    quantity: true,
                  },
                })
              : [];

          // Build inventory map
          const inventoryMap = new Map(
            inventoryRecords.map((inv) => [inv.variantId, inv.quantity])
          );

          // Compute hashes
          const hashes = computeProductHashes({
            name: product.name,
            description: product.description,
            brand: product.brand,
            productType: product.productType,
            tags: product.tags,
            images: product.images,
            variants: productVariants.map((v) => ({
              sku: v.sku,
              barcode: v.barcode,
              price: v.price,
              compareAtPrice: v.compareAtPrice,
              costPrice: v.costPrice,
              weight: v.weight,
              weightUnit: v.weightUnit,
              attributes: v.attributes,
            })),
          });

          // Update product with hashes
          // Note: We don't set changedAt since these are existing products
          await db
            .update(products)
            .set({
              contentHash: hashes.contentHash,
              coreHash: hashes.coreHash,
              imagesHash: hashes.imagesHash,
              variantsHash: hashes.variantsHash,
              updatedAt: new Date(),
            })
            .where(eq(products.id, product.id));

          processed++;
        } catch (error) {
          console.error(
            `[Backfill] Error processing product ${product.id}:`,
            error
          );
          errors++;
        }
      }

      // Progress logging
      const total = processed + skipped + errors;
      console.log(
        `[Backfill] Progress: ${processed} processed, ${skipped} skipped, ${errors} errors (${total} total)`
      );

      // Small delay to avoid overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const duration = Date.now() - startTime;
    const result: BackfillHashesResult = {
      processed,
      skipped,
      errors,
      duration,
    };

    console.log(
      `[Backfill] Completed in ${Math.round(duration / 1000)}s: ` +
        `${processed} processed, ${skipped} skipped, ${errors} errors`
    );

    return result;
  },
});

/**
 * Backfill settings hashes for existing sync settings.
 * Run this after deploying to populate settings_hash column.
 */
export const backfillSettingsHashes = task({
  id: "backfill-settings-hashes",
  retry: {
    maxAttempts: 1,
  },
  run: async () => {
    const db = createDb(process.env.DATABASE_URL!);

    // Import here to avoid circular dependencies
    const { feedSubscriptionSyncSettings } = await import("@workspace/db");
    const { computeSettingsHash } = await import(
      "../../lib/change-detection/index.js"
    );

    // Fetch all sync settings without settings hash
    const settingsToProcess = await db.query.feedSubscriptionSyncSettings.findMany({
      where: isNull(feedSubscriptionSyncSettings.settingsHash),
    });

    console.log(
      `[Backfill] Processing ${settingsToProcess.length} sync settings`
    );

    let processed = 0;
    let errors = 0;

    for (const settings of settingsToProcess) {
      try {
        const hash = computeSettingsHash({
          filterRules: settings.filterRules,
          pricingMargin: settings.pricingMargin,
          fieldMappings: settings.fieldMappings,
          fieldLocks: settings.fieldLocks,
          skuPrefix: settings.skuPrefix,
        });

        await db
          .update(feedSubscriptionSyncSettings)
          .set({
            settingsHash: hash,
            updatedAt: new Date(),
          })
          .where(eq(feedSubscriptionSyncSettings.id, settings.id));

        processed++;
      } catch (error) {
        console.error(
          `[Backfill] Error processing settings ${settings.id}:`,
          error
        );
        errors++;
      }
    }

    console.log(
      `[Backfill] Settings hashes: ${processed} processed, ${errors} errors`
    );

    return { processed, errors };
  },
});
