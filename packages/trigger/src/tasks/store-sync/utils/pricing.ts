/**
 * Pricing margin utilities for product sync
 */

import type { PricingMargin, MarginCondition } from "@workspace/db";
import type { ProductWithVariants } from "../types.js";

/**
 * Determine whether a product variant satisfies a pricing margin condition.
 *
 * @param product - The product that contains variant-level context (brand, productType, tags, etc.)
 * @param variant - The specific variant to evaluate (sku, price, compareAtPrice, costPrice)
 * @param condition - The margin condition specifying `field`, `operator`, and `value` to check
 * @returns `true` if the variant (and its product context) meets the condition, `false` otherwise.
 */
function matchesMarginCondition(
  product: ProductWithVariants,
  variant: ProductWithVariants["variants"][0],
  condition: MarginCondition
): boolean {
  let value: string | number | null = null;

  switch (condition.field) {
    case "brand":
      value = product.brand;
      break;
    case "productType":
      value = product.productType;
      break;
    case "tag": {
      // For tags, check if any tag matches
      const productTags = product.tags || [];
      if (typeof condition.value === "string") {
        switch (condition.operator) {
          case "equals":
            return productTags.includes(condition.value);
          case "contains":
            return productTags.some((tag) =>
              tag.toLowerCase().includes(condition.value.toString().toLowerCase())
            );
        }
      }
      return false;
    }
    case "sku":
      value = variant.sku;
      break;
    case "price":
      value = variant.price ? parseFloat(variant.price) : null;
      break;
    case "compareAtPrice":
      value = variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null;
      break;
    case "costPrice":
      value = variant.costPrice ? parseFloat(variant.costPrice) : null;
      break;
  }

  if (value === null) return false;

  // Handle numeric comparisons
  if (typeof value === "number") {
    const conditionValue = typeof condition.value === "number" ? condition.value : parseFloat(String(condition.value));
    switch (condition.operator) {
      case "equals":
        return value === conditionValue;
      case "notEquals":
        return value !== conditionValue;
      case "greaterThan":
        return value > conditionValue;
      case "lessThan":
        return value < conditionValue;
      case "between":
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          return value >= condition.value[0] && value <= condition.value[1];
        }
        return false;
    }
  }

  // Handle string comparisons
  if (typeof value === "string" && typeof condition.value === "string") {
    const valueLower = value.toLowerCase();
    const conditionValueLower = condition.value.toLowerCase();
    switch (condition.operator) {
      case "equals":
        return valueLower === conditionValueLower;
      case "notEquals":
        return valueLower !== conditionValueLower;
      case "contains":
        return valueLower.includes(conditionValueLower);
      case "notContains":
        return !valueLower.includes(conditionValueLower);
      case "startsWith":
        return valueLower.startsWith(conditionValueLower);
      case "endsWith":
        return valueLower.endsWith(conditionValueLower);
    }
  }

  return false;
}

/**
 * Apply configured pricing margin rules to a product variant's base price.
 *
 * Evaluates margin rules in priority order and applies the first matching rule's margin (percentage or absolute).
 * If no rule matches, applies `defaultMargin` if present. Returns the original price when no margins apply.
 *
 * @param pricingMargin - Margin configuration to evaluate; when `null`, no margin is applied.
 * @returns The variant price adjusted by the applicable margin, the original variant price if no margin applies, or `null` if the variant has no price.
 */
export function applyPricingMargin(
  product: ProductWithVariants,
  variant: ProductWithVariants["variants"][0],
  pricingMargin: PricingMargin | null
): number | null {
  const price = variant.price ? parseFloat(variant.price) : null;
  if (price === null) return null;
  if (!pricingMargin) return price;

  let adjustedPrice = price;

  // Check conditional rules first (higher priority), apply first matching rule
  const sortedRules = [...pricingMargin.rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    const allConditionsMatch = rule.conditions.every((condition) =>
      matchesMarginCondition(product, variant, condition)
    );

    if (allConditionsMatch) {
      if (rule.marginType === "percentage") {
        adjustedPrice = adjustedPrice * (1 + rule.marginValue / 100);
      } else {
        adjustedPrice = adjustedPrice + rule.marginValue;
      }
      break;
    }
  }

  // Apply default margin on top (stacks with conditional rules)
  if (pricingMargin.defaultMargin) {
    if (pricingMargin.defaultMargin.type === "percentage") {
      adjustedPrice = adjustedPrice * (1 + pricingMargin.defaultMargin.value / 100);
    } else {
      adjustedPrice = adjustedPrice + pricingMargin.defaultMargin.value;
    }
  }

  return adjustedPrice;
}

/**
 * Adjusts a price by applying minimum bounds, configured rounding, and final two-decimal normalization.
 *
 * Rounds or clamps the provided price according to `bounds` and `rounding` in the following order: enforce `bounds.minPrice` if defined, apply the selected rounding `strategy` with the configured `precision` (or an `endWith` tail such as `.99`), then normalize the result to two decimal places.
 *
 * @param price - The base price to adjust.
 * @param rounding - Optional rounding settings that control whether rounding is applied, which strategy to use (`up`, `down`, `nearest`), the precision, and an optional `endWith` tail (e.g., 99 to produce .99).
 * @param bounds - Optional bounds containing `minPrice`; if `minPrice` is provided and the price is lower, the price is raised to `minPrice` before rounding.
 * @returns The adjusted price, rounded to two decimal places.
 */
export function applyRounding(
  price: number,
  rounding?: PricingMargin["rounding"],
  bounds?: PricingMargin["bounds"]
): number {
  let result = price;

  // Apply bounds first
  if (bounds?.minPrice !== undefined && result < bounds.minPrice) {
    result = bounds.minPrice;
  }

  // Apply rounding
  if (rounding?.enabled && rounding.strategy !== "none") {
    const hasEndWith = rounding.endWith !== undefined;
    const precision = hasEndWith ? 1 : Math.pow(10, rounding.precision ?? 0);

    switch (rounding.strategy) {
      case "up":
        result = Math.ceil(result / precision) * precision;
        break;
      case "down":
        result = Math.floor(result / precision) * precision;
        break;
      case "nearest":
        result = Math.round(result / precision) * precision;
        break;
    }

    // Apply endWith if configured (e.g., prices end with .99)
    if (hasEndWith) {
      const wholePart = Math.floor(result);
      result = wholePart + rounding.endWith! / 100;
    }
  }

  // Round to 2 decimal places
  return Math.round(result * 100) / 100;
}