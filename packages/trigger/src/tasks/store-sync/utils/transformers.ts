/**
 * Field transformation utilities for product sync
 */

/**
 * Prefixes an SKU with the provided prefix when both are present.
 *
 * @param sku - The SKU to transform; if `null` or empty, the function yields `undefined`.
 * @param prefix - The prefix to prepend; if `null` or empty, the original SKU is returned.
 * @returns The prefixed SKU when both inputs are present, the original SKU if `prefix` is `null` or empty, or `undefined` if `sku` is `null` or empty.
 */
export function applySkuPrefix(sku: string | null, prefix: string | null): string | undefined {
  if (!sku) return undefined;
  if (!prefix) return sku;
  return `${prefix}${sku}`;
}