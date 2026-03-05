/**
 * Field mapping utilities for product sync
 */

import type { FieldMappingRule } from "@workspace/db";
import type { ProductWithVariants } from "../types.js";

export interface MappingResult {
  productType?: string;
  tags?: string[];
  vendor?: string;
}

/**
 * Gets the source field value from a product
 */
function getFieldValue(
  product: ProductWithVariants,
  field: "brand" | "productType" | "tag"
): string | string[] | null {
  switch (field) {
    case "brand":
      return product.brand;
    case "productType":
      return product.productType;
    case "tag":
      return product.tags || [];
  }
}

/**
 * Checks if a product's field matches a rule's source value
 */
function matchesSource(
  product: ProductWithVariants,
  rule: FieldMappingRule
): boolean {
  const fieldValue = getFieldValue(product, rule.sourceField);

  if (fieldValue === null) return false;

  // For tags, check if any tag matches
  if (rule.sourceField === "tag") {
    const tags = fieldValue as string[];
    return tags.some(
      (tag) => tag.toLowerCase() === rule.sourceValue.toLowerCase()
    );
  }

  // For brand and productType, direct comparison
  return (
    (fieldValue as string).toLowerCase() === rule.sourceValue.toLowerCase()
  );
}

/**
 * Applies field mapping rules to a product.
 *
 * Each rule specifies: when sourceField equals sourceValue, set targetField to targetValue.
 * Multiple rules can match and their results are accumulated.
 *
 * @param product - The product to evaluate against mapping rules
 * @param rules - The set of field mapping rules to apply
 * @returns An object with mapped values: `productType`, `tags`, and `vendor`
 */
export function applyMappingRules(
  product: ProductWithVariants,
  rules: FieldMappingRule[]
): MappingResult {
  const result: MappingResult = {};
  const tagsToAdd: string[] = [];

  for (const rule of rules) {
    if (!matchesSource(product, rule)) {
      continue;
    }

    // Apply the target transformation
    switch (rule.targetField) {
      case "brand":
        // brand maps to vendor in Shopify
        result.vendor = rule.targetValue;
        break;
      case "productType":
        result.productType = rule.targetValue;
        break;
      case "tag":
        tagsToAdd.push(rule.targetValue);
        break;
    }
  }

  // Combine existing tags with new tags
  if (tagsToAdd.length > 0) {
    result.tags = tagsToAdd;
  }

  return result;
}
