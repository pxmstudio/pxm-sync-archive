/**
 * Change Detection Logic
 *
 * Compares content hashes to detect what changed in a product.
 * Returns a change type that determines the sync strategy.
 */

import {
  computeProductHashes,
  computeInventoryHash,
  type ProductHashInput,
  type InventoryHashInput,
  type ProductHashes,
} from "./hashing.js";

// ============================================
// Types
// ============================================

/**
 * Type of change detected in a product.
 * Determines the sync strategy:
 * - new: Product doesn't exist in target, needs full creation
 * - full: Core fields or images changed, needs full product update
 * - price: Only pricing fields changed, can update variants only
 * - inventory: Only inventory changed, can use fast inventory API
 * - none: No changes detected, skip sync
 */
export type ChangeType = "new" | "full" | "price" | "inventory" | "none";

/**
 * Result of change detection for a single product.
 */
export interface ChangeDetectionResult {
  /** Type of change detected */
  changeType: ChangeType;

  /** Computed hashes for the new content */
  hashes: ProductHashes;

  /** Inventory hash (separate from content hash) */
  inventoryHash: string;

  /** Which fields changed (for debugging/logging) */
  changedFields?: string[];
}

/**
 * Existing hashes to compare against.
 */
export interface ExistingHashes {
  contentHash: string | null;
  coreHash: string | null;
  imagesHash: string | null;
  variantsHash: string | null;
  inventoryHash: string | null;
}

// ============================================
// Change Detection
// ============================================

/**
 * Determine the required sync action by comparing hashes computed from the new product and inventory against existing hashes.
 *
 * @param newProduct - Product data used to compute content hashes
 * @param newInventory - Inventory data used to compute the inventory hash
 * @param existingHashes - Prior hashes to compare against, or `null` if the product is new
 * @returns A ChangeDetectionResult containing the detected `changeType`, newly computed content `hashes`, `inventoryHash`, and an optional `changedFields` array listing which components changed
 */
export function detectChanges(
  newProduct: ProductHashInput,
  newInventory: InventoryHashInput,
  existingHashes: ExistingHashes | null
): ChangeDetectionResult {
  // Compute all hashes for the new data
  const hashes = computeProductHashes(newProduct);
  const inventoryHash = computeInventoryHash(newInventory);

  // New product - no existing hashes to compare
  if (!existingHashes || !existingHashes.contentHash) {
    return {
      changeType: "new",
      hashes,
      inventoryHash,
      changedFields: ["all"],
    };
  }

  // Compare individual hash components
  const coreChanged = hashes.coreHash !== existingHashes.coreHash;
  const imagesChanged = hashes.imagesHash !== existingHashes.imagesHash;
  const variantsChanged = hashes.variantsHash !== existingHashes.variantsHash;
  const inventoryChanged = inventoryHash !== existingHashes.inventoryHash;

  // Collect changed fields for logging
  const changedFields: string[] = [];
  if (coreChanged) changedFields.push("core");
  if (imagesChanged) changedFields.push("images");
  if (variantsChanged) changedFields.push("variants");
  if (inventoryChanged) changedFields.push("inventory");

  // Determine change type based on what changed
  let changeType: ChangeType = "none";

  if (coreChanged || imagesChanged) {
    // Core fields or images changed = full sync needed
    // This includes name, description, brand, productType, tags, images
    changeType = "full";
  } else if (variantsChanged) {
    // Only variant pricing/attributes changed = price sync
    // This includes price, compareAtPrice, costPrice, barcode, attributes
    changeType = "price";
  } else if (inventoryChanged) {
    // Only inventory changed = can use inventory fast path
    changeType = "inventory";
  }

  return {
    changeType,
    hashes,
    inventoryHash,
    changedFields: changedFields.length > 0 ? changedFields : undefined,
  };
}