/**
 * Settings Hash Utility
 *
 * Computes a deterministic hash of sync settings for change detection.
 * Used to detect when configuration changes require products to be re-synced.
 */

import crypto from "crypto";

export interface SettingsHashInput {
  filterRules: unknown;
  pricingMargin: unknown;
  fieldMappings: unknown;
  fieldLocks: unknown;
  skuPrefix: string | null;
  defaultProductStatus: string | null;
  exclusionRules: unknown;
}

/**
 * Produce a deterministic MD5 hash of a value.
 *
 * @param data - The input value to hash; when `data` is an object, its keys are sorted to ensure a deterministic JSON representation
 * @returns The MD5 hex digest of the deterministic JSON representation of `data`
 */
function computeHash(data: unknown): string {
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

/**
 * Compute a deterministic MD5 hash representing the provided sync settings.
 *
 * Missing fields are replaced with safe defaults before hashing:
 * - filterRules -> {}
 * - pricingMargin -> null
 * - fieldMappings -> []
 * - fieldLocks -> null
 * - skuPrefix -> ""
 * - defaultProductStatus -> null
 * - exclusionRules -> []
 *
 * @param settings - Sync settings to normalize and hash
 * @returns Hexadecimal MD5 digest of the deterministic JSON representation of `settings`
 */
export function computeSettingsHash(settings: SettingsHashInput): string {
  return computeHash({
    filterRules: settings.filterRules || {},
    pricingMargin: settings.pricingMargin || null,
    fieldMappings: settings.fieldMappings || [],
    fieldLocks: settings.fieldLocks || null,
    skuPrefix: settings.skuPrefix || "",
    defaultProductStatus: settings.defaultProductStatus || null,
    exclusionRules: settings.exclusionRules || [],
  });
}