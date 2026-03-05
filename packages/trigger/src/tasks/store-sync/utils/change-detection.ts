/**
 * Change detection utilities for store sync
 *
 * Provides functions to query changed products when product IDs
 * are not provided directly (fallback for scheduled/manual syncs).
 */

import { eq, and, or, gt, ne, isNull, sql } from "drizzle-orm";
import type { createDb } from "@workspace/db";
import {
  products,
  feedSyncedProducts,
  feedSubscriptionSyncSettings,
} from "@workspace/db";
import { computeSettingsHash } from "../../../lib/change-detection/index.js";
import type { SyncChangeType } from "../types.js";

export interface ChangedProduct {
  id: string;
  changeType: SyncChangeType | null;
  contentHash: string | null;
}

/**
 * Determine which products for a feed and sync settings require syncing.
 *
 * Identifies products that have never been synced, whose content hash differs from the last synced hash, whose sync-settings hash differs from the last synced settings hash, or whose content changed after the last sync.
 *
 * @returns A list of ChangedProduct objects (each with `id`, `changeType`, and `contentHash`). Returns an empty array if the specified sync settings cannot be found.
 */
export async function queryChangedProducts(
  db: ReturnType<typeof createDb>,
  feedId: string,
  syncSettingsId: string,
  precomputedSettingsHash?: string
): Promise<ChangedProduct[]> {
  let currentSettingsHash: string;

  if (precomputedSettingsHash) {
    currentSettingsHash = precomputedSettingsHash;
  } else {
    // Get current settings to compute hash
    const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.id, syncSettingsId),
    });

    if (!syncSettings) {
      console.warn(`[Change Detection] Sync settings ${syncSettingsId} not found`);
      return [];
    }

    currentSettingsHash = computeSettingsHash({
      filterRules: syncSettings.filterRules,
      pricingMargin: syncSettings.pricingMargin,
      fieldMappings: syncSettings.fieldMappings,
      fieldLocks: syncSettings.fieldLocks,
      skuPrefix: syncSettings.skuPrefix,
    });
  }

  // Query products that need syncing
  const changedProducts = await db
    .select({
      id: products.id,
      changeType: products.changeType,
      contentHash: products.contentHash,
      lastSyncedContentHash: feedSyncedProducts.lastSyncedContentHash,
      lastSyncedSettingsHash: feedSyncedProducts.lastSyncedSettingsHash,
    })
    .from(products)
    .leftJoin(
      feedSyncedProducts,
      and(
        eq(feedSyncedProducts.syncSettingsId, syncSettingsId),
        eq(feedSyncedProducts.sourceProductId, products.id)
      )
    )
    .where(
      and(
        eq(products.feedId, feedId),
        eq(products.isActive, "true"),
        or(
          // Never synced (no record exists)
          isNull(feedSyncedProducts.id),
          // Content hash changed
          ne(products.contentHash, feedSyncedProducts.lastSyncedContentHash),
          // Settings hash changed (need to re-apply pricing/filters)
          sql`${feedSyncedProducts.lastSyncedSettingsHash} IS NULL OR ${feedSyncedProducts.lastSyncedSettingsHash} != ${currentSettingsHash}`,
          // Content changed since last sync
          gt(products.changedAt, feedSyncedProducts.lastSyncedAt)
        )
      )
    );

  console.log(
    `[Change Detection] Found ${changedProducts.length} products needing sync for settings ${syncSettingsId}`
  );

  return changedProducts.map((p) => ({
    id: p.id,
    changeType: p.changeType as SyncChangeType | null,
    contentHash: p.contentHash,
  }));
}

/**
 * Determine the effective sync change type for a product considering both content and subscription settings changes.
 *
 * @param productChangeType - The product's recorded change type (may be `null` if not set)
 * @param lastSyncedContentHash - Content hash from the last successful sync for this product, or `null` if never synced
 * @param lastSyncedSettingsHash - Settings hash used during the last sync for this product, or `null` if never synced with settings
 * @param currentContentHash - Current content hash for the product
 * @param currentSettingsHash - Current settings hash for the subscription
 * @returns The effective change type: `'new'` for newly added products; `'full'` when content requires a full update; `'price'` when only pricing-related settings changed; otherwise the recorded `productChangeType` or `'full'` as a fallback
 */
export function determineEffectiveChangeType(
  productChangeType: SyncChangeType | null,
  lastSyncedContentHash: string | null,
  lastSyncedSettingsHash: string | null,
  currentContentHash: string | null,
  currentSettingsHash: string
): SyncChangeType {
  // New product - needs full sync
  if (!lastSyncedContentHash) {
    return "new";
  }

  // Settings changed - need at least price recalculation
  const settingsChanged =
    !lastSyncedSettingsHash || lastSyncedSettingsHash !== currentSettingsHash;

  if (settingsChanged) {
    // If content also changed significantly, use that type
    if (productChangeType === "full") {
      return "full";
    }
    // Settings affect pricing, so treat as price change
    return "price";
  }

  // Use the product's recorded change type
  return productChangeType || "full";
}

/**
 * Group product IDs by their sync change type.
 *
 * Entries for the change types "new", "full", "price", and "inventory" are always present.
 * If a product's `changeType` is `null`, it defaults to `"full"`.
 *
 * @param changedProducts - The products to group
 * @returns A map from each `SyncChangeType` to an array of product IDs belonging to that group
 */
export function groupProductsByChangeType(
  changedProducts: ChangedProduct[]
): Map<SyncChangeType, string[]> {
  const groups = new Map<SyncChangeType, string[]>([
    ["new", []],
    ["full", []],
    ["price", []],
    ["inventory", []],
  ]);

  for (const product of changedProducts) {
    // Default to "full" if changeType is missing or unexpected (e.g., "none")
    const changeType: SyncChangeType =
      product.changeType && groups.has(product.changeType)
        ? product.changeType
        : "full";
    groups.get(changeType)!.push(product.id);
  }

  return groups;
}