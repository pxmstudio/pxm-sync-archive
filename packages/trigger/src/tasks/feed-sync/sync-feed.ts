/**
 * Feed sync task (Feed Library)
 *
 * This task fetches feed content, parses it, and syncs products to the database
 */

import { task } from "@trigger.dev/sdk";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  createDb,
  feedSources,
  feedSyncLogs,
  feedSubscriptions,
  feedSubscriptionSyncSettings,
  feeds,
  products,
  variants,
  inventory,
} from "@workspace/db";
import type { ProductImage, FeedMapping, FeedLogError } from "@workspace/db";
import type { FeedSyncPayload, FeedSyncResult, ParsedProduct, FeedCredentials, ChangeSummary, ChangeType } from "./types.js";
import { parseXmlFeed, parseCsvFeed, parseJsonFeed } from "./parsers.js";
import { sendSyncNotification } from "../notifications/sync-notifications.js";
import {
  computeProductHashes,
  computeInventoryHash,
  detectChanges,
  type ExistingHashes,
} from "../../lib/change-detection/index.js";
import { storePushProducts } from "../store-sync/push-products.js";

export const feedSync = task({
  id: "feed-sync",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: FeedSyncPayload): Promise<FeedSyncResult> => {
    const startTime = Date.now();
    const db = createDb(process.env.DATABASE_URL!);

    // Get feed source configuration
    const feedSource = await db.query.feedSources.findFirst({
      where: eq(feedSources.id, payload.feedId),
      with: {
        feed: true,
      },
    });

    if (!feedSource) {
      throw new Error(`Feed source not found: ${payload.feedId}`);
    }

    if (!feedSource.isActive) {
      console.log(`Feed source ${payload.feedId} is not active, skipping sync`);
      return {
        success: false,
        productsProcessed: 0,
        productsCreated: 0,
        productsUpdated: 0,
        productsFailed: 0,
        errors: [{ message: "Feed source is not active" }],
        durationMs: Date.now() - startTime,
      };
    }

    console.log(`Starting feed sync for feed: ${feedSource.feed.name}`);

    // Create sync log entry
    const syncLogResult = await db
      .insert(feedSyncLogs)
      .values({
        feedSourceId: feedSource.id,
        status: "running",
        startedAt: new Date(),
        triggeredBy: payload.triggeredBy,
        triggeredByUserId: payload.triggeredByUserId,
      })
      .returning();

    const syncLog = syncLogResult[0];
    if (!syncLog) {
      throw new Error("Failed to create sync log entry");
    }

    const errors: FeedLogError[] = [];
    let productsCreated = 0;
    let productsUpdated = 0;
    let productsFailed = 0;
    const newProductIds: string[] = []; // Track IDs of newly created products

    // Track changes by type for incremental sync
    const changeSummary: ChangeSummary = {
      new: [],
      full: [],
      price: [],
      inventory: [],
      unchanged: 0,
    };

    try {
      // Fetch feed content
      const content = await fetchFeedContent(feedSource);

      // Parse feed based on type
      const mapping = (feedSource.mapping || {}) as FeedMapping;
      let parseResult;

      switch (feedSource.feedType) {
        case "xml":
          parseResult = await parseXmlFeed(content, mapping);
          break;
        case "csv":
          parseResult = await parseCsvFeed(content, mapping);
          break;
        case "json":
          parseResult = await parseJsonFeed(content, mapping);
          break;
        default:
          throw new Error(`Unsupported feed type: ${feedSource.feedType}`);
      }

      errors.push(...parseResult.errors);

      console.log(`Parsed ${parseResult.products.length} products from feed`);

      // ============================================
      // OPTIMIZED: Batch process all products
      // ============================================
      const batchResult = await batchUpsertProducts(
        db,
        feedSource.feedId,
        parseResult.products,
        errors
      );

      productsCreated = batchResult.created;
      productsUpdated = batchResult.updated;
      productsFailed = batchResult.failed;
      newProductIds.push(...batchResult.newProductIds);
      changeSummary.new.push(...batchResult.changeSummary.new);
      changeSummary.full.push(...batchResult.changeSummary.full);
      changeSummary.price.push(...batchResult.changeSummary.price);
      changeSummary.inventory.push(...batchResult.changeSummary.inventory);
      changeSummary.unchanged = batchResult.changeSummary.unchanged;

      // ============================================
      // OPTIMIZED: Detect stale products (single query)
      // ============================================
      const feedSkus = new Set(parseResult.products.map((p) => p.sku));
      let staleProductsMarked = 0;

      // Single query to get all active products with their SKUs
      const productsWithSkus = await db
        .select({
          productId: products.id,
          sku: variants.sku,
        })
        .from(products)
        .innerJoin(variants, eq(variants.productId, products.id))
        .where(
          and(
            eq(products.feedId, feedSource.feedId),
            eq(products.isActive, "true"),
            sql`${products.deletedAt} IS NULL`
          )
        );

      // Find products where ALL their variants have SKUs not in the feed
      const productSkuMap = new Map<string, Set<string>>();
      for (const row of productsWithSkus) {
        if (!productSkuMap.has(row.productId)) {
          productSkuMap.set(row.productId, new Set());
        }
        if (row.sku) {
          productSkuMap.get(row.productId)!.add(row.sku);
        }
      }

      // Mark products as deleted if none of their SKUs are in the feed
      const staleProductIds: string[] = [];
      for (const [productId, skus] of productSkuMap) {
        const hasAnySkuInFeed = Array.from(skus).some((sku) => feedSkus.has(sku));
        if (!hasAnySkuInFeed && skus.size > 0) {
          staleProductIds.push(productId);
        }
      }

      if (staleProductIds.length > 0) {
        console.log(`[Feed Sync] Marking ${staleProductIds.length} stale products as deleted`);

        // Soft delete stale products in batches to avoid query size limits
        const BATCH_SIZE = 500;
        for (let i = 0; i < staleProductIds.length; i += BATCH_SIZE) {
          const batch = staleProductIds.slice(i, i + BATCH_SIZE);
          await db
            .update(products)
            .set({
              deletedAt: new Date(),
              changeType: "full",
              changedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(inArray(products.id, batch));
        }

        staleProductsMarked = staleProductIds.length;
        changeSummary.full.push(...staleProductIds);
      }

      // Log change summary
      console.log(
        `[Feed Sync] Change summary: ` +
        `${changeSummary.new.length} new, ` +
        `${changeSummary.full.length} full changes, ` +
        `${changeSummary.price.length} price changes, ` +
        `${changeSummary.inventory.length} inventory changes, ` +
        `${changeSummary.unchanged} unchanged` +
        (staleProductsMarked > 0 ? `, ${staleProductsMarked} marked deleted` : "")
      );

      const durationMs = Date.now() - startTime;

      // Update sync log
      await db
        .update(feedSyncLogs)
        .set({
          status: productsFailed > 0 && productsCreated + productsUpdated === 0 ? "failed" : "success",
          completedAt: new Date(),
          productsProcessed: parseResult.products.length,
          productsCreated,
          productsUpdated,
          productsFailed,
          errors,
        })
        .where(eq(feedSyncLogs.id, syncLog.id));

      // Update feed source status
      await db
        .update(feedSources)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: productsFailed > 0 && productsCreated + productsUpdated === 0 ? "failed" : "success",
          lastSyncError: errors.length > 0 ? errors[0]?.message : null,
          lastSyncProductCount: productsCreated + productsUpdated,
          lastSyncDurationMs: durationMs,
          updatedAt: new Date(),
        })
        .where(eq(feedSources.id, feedSource.id));

      // Update feed metadata
      const totalProducts = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(eq(products.feedId, feedSource.feedId));

      await db
        .update(feeds)
        .set({
          metadata: sql`${feeds.metadata} || ${JSON.stringify({
            totalProducts: totalProducts[0]?.count || 0,
            lastFullSync: new Date().toISOString(),
          })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(feeds.id, feedSource.feedId));

      console.log(
        `Feed sync completed: ${productsCreated} created, ${productsUpdated} updated, ${productsFailed} failed`
      );

      // Trigger notifications for subscribed retailers
      await triggerSyncNotifications(db, {
        feedId: feedSource.feedId,
        feedName: feedSource.feed.name,
        syncRunId: syncLog.id,
        status: productsFailed > 0 && productsCreated + productsUpdated === 0 ? "failed" : "completed",
        stats: {
          processed: parseResult.products.length,
          created: productsCreated,
          updated: productsUpdated,
          skipped: 0,
          failed: productsFailed,
        },
        topErrors: errors.slice(0, 5).map(e => ({ message: e.message, count: 1 })),
        duration: formatDuration(durationMs),
        syncedAt: new Date().toISOString(),
        newProductIds: newProductIds.slice(0, 50), // Limit to 50 for email
      });

      // Trigger store syncs for all subscribed stores (event-driven incremental sync)
      const changedProductIds = [
        ...changeSummary.new,
        ...changeSummary.full,
        ...changeSummary.price,
        ...changeSummary.inventory,
      ];

      if (changedProductIds.length > 0) {
        await triggerSubscribedStoreSyncs(db, feedSource.feedId, changedProductIds, changeSummary);
      } else {
        console.log(`[Feed Sync] No changes detected, skipping store sync triggers`);
      }

      return {
        success: true,
        productsProcessed: parseResult.products.length,
        productsCreated,
        productsUpdated,
        productsFailed,
        errors,
        durationMs,
        changeSummary,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      console.error(`Feed sync failed: ${errorMessage}`);

      // Update sync log with failure
      await db
        .update(feedSyncLogs)
        .set({
          status: "failed",
          completedAt: new Date(),
          productsProcessed: 0,
          productsCreated,
          productsUpdated,
          productsFailed,
          errors: [...errors, { message: errorMessage }],
        })
        .where(eq(feedSyncLogs.id, syncLog.id));

      // Update feed source status
      await db
        .update(feedSources)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: "failed",
          lastSyncError: errorMessage,
          lastSyncDurationMs: durationMs,
          updatedAt: new Date(),
        })
        .where(eq(feedSources.id, feedSource.id));

      // Trigger failure notifications for subscribed retailers
      await triggerSyncNotifications(db, {
        feedId: feedSource.feedId,
        feedName: feedSource.feed.name,
        syncRunId: syncLog.id,
        status: "failed",
        stats: {
          processed: 0,
          created: productsCreated,
          updated: productsUpdated,
          skipped: 0,
          failed: productsFailed,
        },
        errorMessage,
        topErrors: [...errors, { message: errorMessage }].slice(0, 5).map(e => ({ message: e.message, count: 1 })),
        duration: formatDuration(durationMs),
        syncedAt: new Date().toISOString(),
      });

      return {
        success: false,
        productsProcessed: 0,
        productsCreated,
        productsUpdated,
        productsFailed,
        errors: [...errors, { message: errorMessage }],
        durationMs,
      };
    }
  },
});

/**
 * Retrieve raw feed content from a configured feed source.
 *
 * @param feedSource - Object describing the feed location and auth requirements. Must include either `feedUrl` (HTTP(S) URL) or `feedFileKey` (remote storage key). If `requiresAuth` is `true`, `credentialsRef` should reference stored credentials to authenticate the request.
 * @returns The feed payload as a string.
 * @throws If neither `feedUrl` nor `feedFileKey` is configured.
 * @throws If `feedFileKey` is present (R2/file fetching not implemented).
 * @throws If the HTTP fetch returns a non-OK response (includes HTTP status and statusText).
 */
async function fetchFeedContent(feedSource: {
  feedUrl: string | null;
  feedFileKey: string | null;
  requiresAuth: boolean;
  credentialsRef: string | null;
}): Promise<string> {
  if (!feedSource.feedUrl && !feedSource.feedFileKey) {
    throw new Error("Feed source has no URL or file key configured");
  }

  // If file key is set, fetch from R2 (TODO: implement R2 fetching)
  if (feedSource.feedFileKey) {
    throw new Error("R2 file fetching not yet implemented");
  }

  const url = feedSource.feedUrl!;
  const headers: Record<string, string> = {
    "User-Agent": "PXM-Sync-FeedSync/1.0",
  };

  // Apply authentication if needed
  if (feedSource.requiresAuth && feedSource.credentialsRef) {
    // TODO: Implement feed authentication with KMS decryption
    // Use getCredentials from ../../lib/credentials.js to decrypt
    // Then apply appropriate auth headers (Basic, Bearer, API Key, etc.)
    console.log("Authenticated feed - credentials would be applied here");
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

// ============================================
// OPTIMIZED BATCH PROCESSING
// ============================================

interface BatchUpsertResult {
  created: number;
  updated: number;
  failed: number;
  newProductIds: string[];
  changeSummary: ChangeSummary;
}

/**
 * Batch process all products with optimized database operations.
 *
 * Instead of N queries per product, this:
 * 1. Pre-fetches all existing products in ONE query
 * 2. Computes hashes in memory
 * 3. Batch inserts new products
 * 4. Batch updates existing products
 * 5. Handles variants and inventory efficiently
 */
async function batchUpsertProducts(
  db: ReturnType<typeof createDb>,
  feedId: string,
  parsedProducts: ParsedProduct[],
  errors: FeedLogError[]
): Promise<BatchUpsertResult> {
  const BATCH_SIZE = 100; // Process in batches to avoid memory issues

  const result: BatchUpsertResult = {
    created: 0,
    updated: 0,
    failed: 0,
    newProductIds: [],
    changeSummary: {
      new: [],
      full: [],
      price: [],
      inventory: [],
      unchanged: 0,
    },
  };

  if (parsedProducts.length === 0) {
    return result;
  }

  // ============================================
  // Step 1: Pre-fetch ALL existing products in one query
  // ============================================
  console.log(`[Feed Sync] Pre-fetching existing products...`);
  const allSkus = parsedProducts.map((p) => p.sku);

  // Fetch in batches to avoid query size limits
  const existingProductsMap = new Map<string, {
    id: string;
    contentHash: string | null;
    coreHash: string | null;
    imagesHash: string | null;
    variantsHash: string | null;
    variantId: string | null;
    inventoryHash: string | null;
  }>();

  for (let i = 0; i < allSkus.length; i += 1000) {
    const skuBatch = allSkus.slice(i, i + 1000);
    const existingBatch = await db
      .select({
        id: products.id,
        sku: products.sku,
        contentHash: products.contentHash,
        coreHash: products.coreHash,
        imagesHash: products.imagesHash,
        variantsHash: products.variantsHash,
        variantId: variants.id,
        inventoryHash: inventory.inventoryHash,
      })
      .from(products)
      .leftJoin(variants, eq(variants.productId, products.id))
      .leftJoin(inventory, eq(inventory.variantId, variants.id))
      .where(
        and(
          eq(products.feedId, feedId),
          inArray(products.sku, skuBatch)
        )
      );

    for (const row of existingBatch) {
      if (row.sku) {
        existingProductsMap.set(row.sku, {
          id: row.id,
          contentHash: row.contentHash,
          coreHash: row.coreHash,
          imagesHash: row.imagesHash,
          variantsHash: row.variantsHash,
          variantId: row.variantId,
          inventoryHash: row.inventoryHash,
        });
      }
    }
  }

  console.log(`[Feed Sync] Found ${existingProductsMap.size} existing products`);

  // ============================================
  // Step 2: Categorize and prepare products
  // ============================================
  type ExistingProductData = {
    id: string;
    contentHash: string | null;
    coreHash: string | null;
    imagesHash: string | null;
    variantsHash: string | null;
    variantId: string | null;
    inventoryHash: string | null;
  };

  interface PreparedProduct {
    parsed: ParsedProduct;
    images: ProductImage[];
    hashes: ReturnType<typeof computeProductHashes>;
    inventoryHash: string;
    existing: ExistingProductData | null;
    changeType: ChangeType;
  }

  const newProducts: PreparedProduct[] = [];
  const updatedProducts: PreparedProduct[] = [];
  const unchangedProductIds: string[] = [];

  for (const parsed of parsedProducts) {
    try {
      const images: ProductImage[] = (parsed.images || []).map((url, index) => ({
        url,
        position: index,
      }));

      const hashInput = {
        name: parsed.name,
        description: parsed.description || null,
        brand: parsed.brand || null,
        productType: parsed.productType || null,
        tags: parsed.tags || null,
        images: images.map((img) => ({ url: img.url, altText: undefined })),
        variants: [{
          sku: parsed.sku || null,
          barcode: parsed.barcode || null,
          price: parsed.price?.toString() || null,
          compareAtPrice: parsed.compareAtPrice?.toString() || null,
          costPrice: parsed.costPrice?.toString() || null,
          weight: null,
          weightUnit: null,
          attributes: null,
        }],
      };

      const inventoryHashInput = {
        quantities: parsed.quantity !== undefined
          ? [{ variantId: "default", quantity: parsed.quantity }]
          : [],
      };

      const hashes = computeProductHashes(hashInput);
      const inventoryHash = computeInventoryHash(inventoryHashInput);

      const existing = existingProductsMap.get(parsed.sku) || null;

      if (existing) {
        // Detect changes
        const existingHashes: ExistingHashes = {
          contentHash: existing.contentHash,
          coreHash: existing.coreHash,
          imagesHash: existing.imagesHash,
          variantsHash: existing.variantsHash,
          inventoryHash: existing.inventoryHash,
        };

        let changeResult = detectChanges(hashInput, inventoryHashInput, existingHashes);

        // If quantity not provided in feed, ignore inventory-only changes
        if (parsed.quantity === undefined && changeResult.changeType === "inventory") {
          changeResult = { ...changeResult, changeType: "none" };
        }

        if (changeResult.changeType === "none") {
          unchangedProductIds.push(existing.id);
          result.changeSummary.unchanged++;
        } else {
          updatedProducts.push({
            parsed,
            images,
            hashes,
            inventoryHash,
            existing,
            changeType: changeResult.changeType,
          });
        }
      } else {
        newProducts.push({
          parsed,
          images,
          hashes,
          inventoryHash,
          existing: null,
          changeType: "new",
        });
      }
    } catch (error) {
      result.failed++;
      errors.push({
        sku: parsed.sku,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  console.log(`[Feed Sync] Categorized: ${newProducts.length} new, ${updatedProducts.length} to update, ${unchangedProductIds.length} unchanged`);

  // ============================================
  // Step 3: Batch update unchanged products (just syncedAt)
  // ============================================
  if (unchangedProductIds.length > 0) {
    for (let i = 0; i < unchangedProductIds.length; i += 500) {
      const batch = unchangedProductIds.slice(i, i + 500);
      await db
        .update(products)
        .set({ syncedAt: new Date() })
        .where(inArray(products.id, batch));
    }
  }

  // ============================================
  // Step 4: Batch insert NEW products
  // ============================================
  for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
    const batch = newProducts.slice(i, i + BATCH_SIZE);

    try {
      // Insert products
      const productValues = batch.map((p) => ({
        feedId,
        sku: p.parsed.sku,
        name: p.parsed.name,
        description: p.parsed.description,
        brand: p.parsed.brand,
        productType: p.parsed.productType,
        tags: p.parsed.tags,
        images: p.images,
        contentHash: p.hashes.contentHash,
        coreHash: p.hashes.coreHash,
        imagesHash: p.hashes.imagesHash,
        variantsHash: p.hashes.variantsHash,
        changedAt: new Date(),
        changeType: "new" as const,
        syncedAt: new Date(),
      }));

      const insertedProducts = await db
        .insert(products)
        .values(productValues)
        .returning({ id: products.id, sku: products.sku });

      // Create SKU -> product ID map
      const skuToProductId = new Map(insertedProducts.map((p) => [p.sku, p.id]));

      // Insert variants
      const variantValues = batch.map((p) => {
        const productId = skuToProductId.get(p.parsed.sku);
        if (!productId) throw new Error(`No product ID for SKU ${p.parsed.sku}`);
        return {
          productId,
          sku: p.parsed.sku,
          name: p.parsed.name,
          price: p.parsed.price.toString(),
          compareAtPrice: p.parsed.compareAtPrice?.toString(),
          costPrice: p.parsed.costPrice?.toString(),
          barcode: p.parsed.barcode,
          currency: p.parsed.currency,
        };
      });

      const insertedVariants = await db
        .insert(variants)
        .values(variantValues)
        .returning({ id: variants.id, productId: variants.productId });

      // Create product ID -> variant ID map
      const productIdToVariantId = new Map(insertedVariants.map((v) => [v.productId, v.id]));

      // Insert inventory for products with quantity
      const inventoryValues = batch
        .filter((p) => p.parsed.quantity !== undefined)
        .map((p) => {
          const productId = skuToProductId.get(p.parsed.sku);
          const variantId = productId ? productIdToVariantId.get(productId) : null;
          if (!variantId) return null;
          return {
            variantId,
            quantity: p.parsed.quantity!,
            inventoryHash: p.inventoryHash,
            changedAt: new Date(),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      if (inventoryValues.length > 0) {
        await db.insert(inventory).values(inventoryValues);
      }

      // Track results
      for (const product of insertedProducts) {
        result.created++;
        result.newProductIds.push(product.id);
        result.changeSummary.new.push(product.id);
      }
    } catch (error) {
      // Fall back to individual inserts on batch failure
      console.error(`[Feed Sync] Batch insert failed, falling back to individual inserts:`, error);
      for (const p of batch) {
        try {
          const singleResult = await upsertProduct(db, feedId, p.parsed);
          result.created++;
          result.newProductIds.push(singleResult.productId);
          result.changeSummary.new.push(singleResult.productId);
        } catch (singleError) {
          result.failed++;
          errors.push({
            sku: p.parsed.sku,
            message: singleError instanceof Error ? singleError.message : "Unknown error",
          });
        }
      }
    }
  }

  // ============================================
  // Step 5: Batch update EXISTING products
  // ============================================
  for (let i = 0; i < updatedProducts.length; i += BATCH_SIZE) {
    const batch = updatedProducts.slice(i, i + BATCH_SIZE);

    // Process updates in parallel within batch
    const updatePromises = batch.map(async (p) => {
      try {
        const existing = p.existing!;

        // Update product
        // Note: changeType here is never "none" as those are filtered to unchangedProductIds
        const dbChangeType = p.changeType === "none" ? "full" : p.changeType;
        await db
          .update(products)
          .set({
            name: p.parsed.name,
            description: p.parsed.description,
            brand: p.parsed.brand,
            productType: p.parsed.productType,
            tags: p.parsed.tags,
            images: p.images,
            contentHash: p.hashes.contentHash,
            coreHash: p.hashes.coreHash,
            imagesHash: p.hashes.imagesHash,
            variantsHash: p.hashes.variantsHash,
            changedAt: new Date(),
            changeType: dbChangeType,
            syncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(products.id, existing.id));

        // Update variant
        if (existing.variantId) {
          await db
            .update(variants)
            .set({
              sku: p.parsed.sku,
              name: p.parsed.name,
              price: p.parsed.price.toString(),
              compareAtPrice: p.parsed.compareAtPrice?.toString(),
              costPrice: p.parsed.costPrice?.toString(),
              barcode: p.parsed.barcode,
              currency: p.parsed.currency,
              updatedAt: new Date(),
            })
            .where(eq(variants.id, existing.variantId));

          // Update inventory if quantity provided
          if (p.parsed.quantity !== undefined) {
            await upsertInventoryWithHash(db, existing.variantId, p.parsed.quantity, p.inventoryHash);
          }
        }

        return { success: true, productId: existing.id, changeType: p.changeType };
      } catch (error) {
        return {
          success: false,
          sku: p.parsed.sku,
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    });

    const updateResults = await Promise.all(updatePromises);

    for (const updateResult of updateResults) {
      if (updateResult.success && 'productId' in updateResult) {
        result.updated++;
        switch (updateResult.changeType) {
          case "full":
            result.changeSummary.full.push(updateResult.productId);
            break;
          case "price":
            result.changeSummary.price.push(updateResult.productId);
            break;
          case "inventory":
            result.changeSummary.inventory.push(updateResult.productId);
            break;
        }
      } else if (!updateResult.success && 'sku' in updateResult) {
        result.failed++;
        errors.push({
          sku: updateResult.sku,
          message: updateResult.error || "Unknown error",
        });
      }
    }
  }

  console.log(`[Feed Sync] Batch processing complete: ${result.created} created, ${result.updated} updated, ${result.failed} failed`);

  return result;
}

/**
 * Create or update a product (and its default variant/inventory) from parsed feed data using hash-based change detection.
 *
 * @param feedId - Identifier of the feed used to scope the product lookup and inserts
 * @param parsedProduct - Parsed feed item containing product fields (e.g., sku, name, price, compareAtPrice, costPrice, currency, barcode, images, quantity, tags, brand, productType, description)
 * @returns An object describing the performed action: `action` is `"created"` for newly inserted products or `"updated"` for existing ones; `productId` is the product record id; `changeType` describes the detected category of change (for example `"new"`, `"full"`, `"price"`, `"inventory"`, or `"none"`).
 * @throws Error when inserting a product or variant fails (e.g., "Failed to create product" or "Failed to create variant")
 */
async function upsertProduct(
  db: ReturnType<typeof createDb>,
  feedId: string,
  parsedProduct: ParsedProduct
): Promise<{ action: "created" | "updated"; productId: string; changeType: ChangeType }> {
  // Check if product exists by SKU for this feed
  const existingProduct = await db.query.products.findFirst({
    where: and(
      eq(products.feedId, feedId),
      eq(products.sku, parsedProduct.sku)
    ),
    columns: {
      id: true,
      contentHash: true,
      coreHash: true,
      imagesHash: true,
      variantsHash: true,
    },
  });

  // Prepare images for storage
  const images: ProductImage[] = (parsedProduct.images || []).map((url, index) => ({
    url,
    position: index,
  }));

  // Build hash input for change detection
  const hashInput = {
    name: parsedProduct.name,
    description: parsedProduct.description || null,
    brand: parsedProduct.brand || null,
    productType: parsedProduct.productType || null,
    tags: parsedProduct.tags || null,
    images: images.map(img => ({ url: img.url, altText: undefined })),
    variants: [{
      sku: parsedProduct.sku || null,
      barcode: parsedProduct.barcode || null,
      price: parsedProduct.price?.toString() || null,
      compareAtPrice: parsedProduct.compareAtPrice?.toString() || null,
      costPrice: parsedProduct.costPrice?.toString() || null,
      weight: null,
      weightUnit: null,
      attributes: null,
    }],
  };

  // Build inventory hash input
  const inventoryHashInput = {
    quantities: parsedProduct.quantity !== undefined
      ? [{ variantId: "default", quantity: parsedProduct.quantity }]
      : [],
  };

  if (existingProduct) {
    // Get existing inventory for hash comparison
    const existingVariant = await db.query.variants.findFirst({
      where: eq(variants.productId, existingProduct.id),
      columns: { id: true },
    });

    let existingInventoryHash: string | null = null;
    if (existingVariant) {
      const existingInv = await db.query.inventory.findFirst({
        where: eq(inventory.variantId, existingVariant.id),
        columns: { inventoryHash: true },
      });
      existingInventoryHash = existingInv?.inventoryHash || null;
    }

    // Build existing hashes for comparison
    const existingHashes: ExistingHashes = {
      contentHash: existingProduct.contentHash,
      coreHash: existingProduct.coreHash,
      imagesHash: existingProduct.imagesHash,
      variantsHash: existingProduct.variantsHash,
      inventoryHash: existingInventoryHash,
    };

    // Detect changes
    let changeResult = detectChanges(hashInput, inventoryHashInput, existingHashes);

    // If quantity not provided in feed, ignore inventory-only changes
    // (can't update inventory without a quantity value)
    if (parsedProduct.quantity === undefined && changeResult.changeType === "inventory") {
      changeResult = { ...changeResult, changeType: "none" };
    }

    // Skip update if no changes detected
    if (changeResult.changeType === "none") {
      // Just update syncedAt to track that we processed it
      await db
        .update(products)
        .set({ syncedAt: new Date() })
        .where(eq(products.id, existingProduct.id));
      return { action: "updated", productId: existingProduct.id, changeType: "none" };
    }

    // Update existing product with new hashes
    await db
      .update(products)
      .set({
        name: parsedProduct.name,
        description: parsedProduct.description,
        brand: parsedProduct.brand,
        productType: parsedProduct.productType,
        tags: parsedProduct.tags,
        images,
        // Store computed hashes
        contentHash: changeResult.hashes.contentHash,
        coreHash: changeResult.hashes.coreHash,
        imagesHash: changeResult.hashes.imagesHash,
        variantsHash: changeResult.hashes.variantsHash,
        // Track when content changed
        changedAt: new Date(),
        changeType: changeResult.changeType,
        syncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(products.id, existingProduct.id));

    // Update or create the default variant
    const variantToUpdate = await db.query.variants.findFirst({
      where: eq(variants.productId, existingProduct.id),
    });

    if (variantToUpdate) {
      await db
        .update(variants)
        .set({
          sku: parsedProduct.sku,
          name: parsedProduct.name,
          price: parsedProduct.price.toString(),
          compareAtPrice: parsedProduct.compareAtPrice?.toString(),
          costPrice: parsedProduct.costPrice?.toString(),
          barcode: parsedProduct.barcode,
          currency: parsedProduct.currency,
          updatedAt: new Date(),
        })
        .where(eq(variants.id, variantToUpdate.id));

      // Update inventory if quantity provided
      if (parsedProduct.quantity !== undefined) {
        await upsertInventoryWithHash(db, variantToUpdate.id, parsedProduct.quantity, changeResult.inventoryHash);
      }
    } else {
      // Create variant if missing
      const newVariantResult = await db
        .insert(variants)
        .values({
          productId: existingProduct.id,
          sku: parsedProduct.sku,
          name: parsedProduct.name,
          price: parsedProduct.price.toString(),
          compareAtPrice: parsedProduct.compareAtPrice?.toString(),
          costPrice: parsedProduct.costPrice?.toString(),
          barcode: parsedProduct.barcode,
          currency: parsedProduct.currency,
        })
        .returning();

      const newVariant = newVariantResult[0];
      if (newVariant && parsedProduct.quantity !== undefined) {
        await upsertInventoryWithHash(db, newVariant.id, parsedProduct.quantity, changeResult.inventoryHash);
      }
    }

    return { action: "updated", productId: existingProduct.id, changeType: changeResult.changeType };
  } else {
    // Compute hashes for new product
    const hashes = computeProductHashes(hashInput);
    const inventoryHash = computeInventoryHash(inventoryHashInput);

    // Create new product with hashes
    const newProductResult = await db
      .insert(products)
      .values({
        feedId,
        sku: parsedProduct.sku,
        name: parsedProduct.name,
        description: parsedProduct.description,
        brand: parsedProduct.brand,
        productType: parsedProduct.productType,
        tags: parsedProduct.tags,
        images,
        // Store computed hashes
        contentHash: hashes.contentHash,
        coreHash: hashes.coreHash,
        imagesHash: hashes.imagesHash,
        variantsHash: hashes.variantsHash,
        // New products have changedAt set to creation time
        changedAt: new Date(),
        changeType: "new",
        syncedAt: new Date(),
      })
      .returning();

    const newProduct = newProductResult[0];
    if (!newProduct) {
      throw new Error("Failed to create product");
    }

    // Create default variant
    const newVariantResult = await db
      .insert(variants)
      .values({
        productId: newProduct.id,
        sku: parsedProduct.sku,
        name: parsedProduct.name,
        price: parsedProduct.price.toString(),
        compareAtPrice: parsedProduct.compareAtPrice?.toString(),
        costPrice: parsedProduct.costPrice?.toString(),
        barcode: parsedProduct.barcode,
        currency: parsedProduct.currency,
      })
      .returning();

    const newVariant = newVariantResult[0];
    if (!newVariant) {
      throw new Error("Failed to create variant");
    }

    // Create inventory if quantity provided
    if (parsedProduct.quantity !== undefined) {
      await db.insert(inventory).values({
        variantId: newVariant.id,
        quantity: parsedProduct.quantity,
        inventoryHash,
        changedAt: new Date(),
      });
    }

    return { action: "created", productId: newProduct.id, changeType: "new" };
  }
}

/**
 * Create or update a variant's inventory row and record an inventory hash for change detection.
 *
 * If an inventory row exists for the variant, updates quantity, previousQuantity, inventoryHash,
 * and timestamps; otherwise inserts a new inventory row with quantity, inventoryHash, and changedAt.
 *
 * @param variantId - The ID of the variant whose inventory is being upserted
 * @param quantity - The current inventory quantity to store
 * @param inventoryHash - A hash representing the inventory state used to detect inventory changes
 */
async function upsertInventoryWithHash(
  db: ReturnType<typeof createDb>,
  variantId: string,
  quantity: number,
  inventoryHash: string
): Promise<void> {
  const existingInventory = await db.query.inventory.findFirst({
    where: eq(inventory.variantId, variantId),
    columns: { id: true, quantity: true },
  });

  if (existingInventory) {
    await db
      .update(inventory)
      .set({
        previousQuantity: existingInventory.quantity,
        quantity,
        inventoryHash,
        changedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, existingInventory.id));
  } else {
    await db.insert(inventory).values({
      variantId,
      quantity,
      inventoryHash,
      changedAt: new Date(),
    });
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

interface SyncNotificationData {
  feedId: string;
  feedName: string;
  syncRunId: string;
  status: "completed" | "failed";
  stats: {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  errorMessage?: string;
  topErrors?: Array<{ message: string; count: number }>;
  duration: string;
  syncedAt: string;
  newProductIds?: string[];
}

/**
 * Notify all active subscriptions for a feed about a sync run.
 *
 * Invokes the sync notification trigger for each active subscription associated with the feed in `data`. Per-subscription failures are logged and do not prevent other notifications; unexpected errors during the operation are caught and logged and the function does not throw.
 *
 * @param data - Payload containing sync metadata and statistics to include in each notification
 */
async function triggerSyncNotifications(
  db: ReturnType<typeof createDb>,
  data: SyncNotificationData
): Promise<void> {
  try {
    // Get all active subscriptions for this feed
    const subscriptions = await db.query.feedSubscriptions.findMany({
      where: and(
        eq(feedSubscriptions.feedId, data.feedId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (subscriptions.length === 0) {
      console.log(`No active subscriptions for feed ${data.feedId}, skipping notifications`);
      return;
    }

    console.log(`Triggering notifications for ${subscriptions.length} subscribed retailers`);

    // Trigger notification for each subscribed retailer
    for (const subscription of subscriptions) {
      try {
        await sendSyncNotification.trigger({
          organizationId: subscription.retailerId,
          feedId: data.feedId,
          feedName: data.feedName,
          syncRunId: data.syncRunId,
          status: data.status,
          stats: data.stats,
          errorMessage: data.errorMessage,
          topErrors: data.topErrors,
          duration: data.duration,
          syncedAt: data.syncedAt,
          newProductIds: data.newProductIds,
        });
      } catch (error) {
        console.error(
          `Failed to trigger notification for retailer ${subscription.retailerId}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("Failed to trigger sync notifications:", error);
  }
}

/**
 * Trigger incremental store syncs for all active subscriptions of a feed using the aggregated changes.
 *
 * For each active subscription with enabled sync settings, invokes a store push with the provided
 * changed product IDs and a breakdown of change counts. Per-subscription failures are logged and
 * skipped; the function captures and logs unexpected errors and does not throw.
 *
 * @param feedId - The ID of the feed whose subscriptions should be triggered
 * @param changedProductIds - Array of product IDs that changed during the feed sync
 * @param changeSummary - Breakdown of changes categorized as `new`, `full`, `price`, and `inventory`
 */
async function triggerSubscribedStoreSyncs(
  db: ReturnType<typeof createDb>,
  feedId: string,
  changedProductIds: string[],
  changeSummary: ChangeSummary
): Promise<void> {
  try {
    // Get all active subscriptions for this feed
    const subscriptions = await db.query.feedSubscriptions.findMany({
      where: and(
        eq(feedSubscriptions.feedId, feedId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (subscriptions.length === 0) {
      console.log(`[Feed Sync] No active subscriptions for feed ${feedId}, skipping store syncs`);
      return;
    }

    console.log(`[Feed Sync] Triggering store syncs for ${subscriptions.length} subscribed stores`);

    // For each subscription, get the sync settings and trigger a sync
    for (const subscription of subscriptions) {
      try {
        // Get sync settings for this subscription
        const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
          where: eq(feedSubscriptionSyncSettings.subscriptionId, subscription.id),
        });

        if (!syncSettings) {
          console.log(`[Feed Sync] No sync settings for subscription ${subscription.id}, skipping`);
          continue;
        }

        if (syncSettings.syncEnabled !== "true") {
          console.log(`[Feed Sync] Sync disabled for subscription ${subscription.id}, skipping`);
          continue;
        }

        // Trigger incremental sync with changed product IDs
        console.log(
          `[Feed Sync] Triggering store sync for subscription ${subscription.id} ` +
          `with ${changedProductIds.length} changed products`
        );

        await storePushProducts.trigger({
          syncSettingsId: syncSettings.id,
          syncType: "incremental",
          productIds: changedProductIds,
          triggeredBy: "feed_import",
          integrationId: syncSettings.integrationId, // For concurrency control
          changeBreakdown: {
            new: changeSummary.new.length,
            inventory: changeSummary.inventory.length,
            price: changeSummary.price.length,
            full: changeSummary.full.length,
          },
        });

        console.log(`[Feed Sync] Store sync triggered for subscription ${subscription.id}`);
      } catch (error) {
        console.error(
          `[Feed Sync] Failed to trigger store sync for subscription ${subscription.id}:`,
          error
        );
      }
    }

    console.log(
      `[Feed Sync] Finished triggering store syncs. ` +
      `Summary: ${changeSummary.new.length} new, ${changeSummary.full.length} full, ` +
      `${changeSummary.price.length} price, ${changeSummary.inventory.length} inventory`
    );
  } catch (error) {
    console.error("[Feed Sync] Failed to trigger subscribed store syncs:", error);
  }
}