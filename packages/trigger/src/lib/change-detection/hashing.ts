/**
 * Content Hashing for Change Detection
 *
 * Uses MD5 hashing to detect changes in product data.
 * MD5 is chosen for speed - this is not security-sensitive.
 */

import crypto from "crypto";

// ============================================
// Types
// ============================================

export interface ProductHashInput {
  name: string;
  description: string | null;
  brand: string | null;
  productType: string | null;
  tags: string[] | null;
  images: Array<{ url: string; altText?: string }> | null;
  variants: Array<{
    sku: string | null;
    barcode: string | null;
    price: string | null;
    compareAtPrice: string | null;
    costPrice: string | null;
    weight: string | null;
    weightUnit: string | null;
    attributes: Record<string, string> | null;
  }>;
}

export interface InventoryHashInput {
  quantities: Array<{ variantId: string; quantity: number }>;
}

export interface ProductHashes {
  contentHash: string;
  coreHash: string;
  imagesHash: string;
  variantsHash: string;
}

// ============================================
// Core Hashing Function
// ============================================

/**
 * Compute a deterministic content hash for a JSON-serializable value.
 *
 * Normalizes object key order recursively so structurally equivalent objects
 * produce the same result regardless of key insertion order.
 *
 * @param data - The value to hash; typically a JSON-serializable object, array, or primitive.
 * @returns The MD5 hex digest of the normalized input
 */
function computeHash(data: unknown): string {
  // Sort keys recursively for deterministic output
  const sortedJson = JSON.stringify(data, (_, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted: Record<string, unknown>, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {});
    }
    return value;
  });

  return crypto.createHash("md5").update(sortedJson).digest("hex");
}

// ============================================
// Product Hash Functions
// ============================================

/**
 * Compute a deterministic hash for a product's core metadata: name, description, brand, productType, and tags.
 *
 * Missing string fields are treated as empty strings and tags are sorted before hashing to ensure stability.
 *
 * @param product - The product whose core fields will be normalized and hashed
 * @returns The MD5 hash of the normalized core product fields
 */
export function computeCoreHash(product: ProductHashInput): string {
  return computeHash({
    name: product.name || "",
    description: product.description || "",
    brand: product.brand || "",
    productType: product.productType || "",
    tags: (product.tags || []).slice().sort(),
  });
}

/**
 * Produces a deterministic hash representing the product's normalized images.
 *
 * Normalization maps each image to an object with `url` and `altText` (defaults to an empty string)
 * and treats a missing `images` array as empty.
 *
 * @param product - The product whose images will be hashed
 * @returns The MD5 hash string of the normalized images array
 */
export function computeImagesHash(product: ProductHashInput): string {
  const images = (product.images || []).map((img) => ({
    url: img.url,
    altText: img.altText || "",
  }));
  return computeHash(images);
}

/**
 * Compute a deterministic hash of the product's variants for change detection (excludes inventory).
 *
 * Includes: sku, barcode, price, compareAtPrice, costPrice, attributes.
 * Note: weight/weightUnit excluded - not currently synced (see docs/plans/TECHNICAL_DEBT.md)
 *
 * @returns An MD5 hash string representing the normalized variant data
 */
export function computeVariantsHash(product: ProductHashInput): string {
  const variants = product.variants
    .map((v) => ({
      sku: v.sku || "",
      barcode: v.barcode || "",
      price: v.price || "",
      compareAtPrice: v.compareAtPrice || "",
      costPrice: v.costPrice || "",
      attributes: v.attributes || {},
    }))
    .sort((a, b) => (a.sku || "").localeCompare(b.sku || ""));

  return computeHash(variants);
}

/**
 * Produce a single hash that represents the product's combined non-inventory content.
 *
 * @param product - Product data used to compute the content hash
 * @returns A deterministic hash string representing the product's core fields, images, and variants
 */
export function computeContentHash(product: ProductHashInput): string {
  return computeHash({
    core: computeCoreHash(product),
    images: computeImagesHash(product),
    variants: computeVariantsHash(product),
  });
}

/**
 * Compute deterministic hashes for a product's core data, images, variants, and a combined content hash.
 *
 * @returns An object with `contentHash`, `coreHash`, `imagesHash`, and `variantsHash` — each a hash string representing the corresponding component of the product
 */
export function computeProductHashes(product: ProductHashInput): ProductHashes {
  const coreHash = computeCoreHash(product);
  const imagesHash = computeImagesHash(product);
  const variantsHash = computeVariantsHash(product);

  // Content hash combines the component hashes
  const contentHash = computeHash({
    core: coreHash,
    images: imagesHash,
    variants: variantsHash,
  });

  return {
    contentHash,
    coreHash,
    imagesHash,
    variantsHash,
  };
}

// ============================================
// Inventory Hash Functions
// ============================================

/**
 * Produces a deterministic hash representing the provided inventory quantities.
 *
 * Normalizes each quantity to a { variantId, quantity } shape and sorts entries by `variantId` before hashing.
 *
 * @param input - Inventory data containing the quantities to include in the hash
 * @returns A hash string representing the normalized and sorted inventory quantities
 */
export function computeInventoryHash(input: InventoryHashInput): string {
  const quantities = input.quantities
    .map((q) => ({
      variantId: q.variantId,
      quantity: q.quantity,
    }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId));

  return computeHash(quantities);
}

// ============================================
// Settings Hash Functions
// ============================================

// Re-export from shared package
export { computeSettingsHash, type SettingsHashInput } from "@workspace/db";