/**
 * Filter and exclusion rule utilities for product sync
 */

import type { FilterRules, SyncExclusionRule } from "@workspace/db";
import type { ProductWithVariants } from "../types.js";

/**
 * Determines whether a product matches a synchronization exclusion rule.
 *
 * Evaluates only enabled rules and supports matching on `brand`, `productType`, `tag`, `sku`, `price`, `title`, and `stock`.
 * Tag operators inspect the product's tags array; `sku` and `price` use the first variant when present.
 * Stock uses the total inventory across all variants.
 *
 * @param product - The product (including variants and tags) to evaluate
 * @param rule - The exclusion rule to test
 * @returns `true` if the product matches the rule and should be excluded, `false` otherwise
 */
function matchesExclusionRule(
  product: ProductWithVariants,
  rule: SyncExclusionRule
): boolean {
  if (!rule.enabled) return false;

  let value: string | number | null = null;

  switch (rule.field) {
    case "brand":
      value = product.brand;
      break;
    case "productType":
      value = product.productType;
      break;
    case "title":
      value = product.name;
      break;
    case "tag":
      // For tags, check if any tag matches
      const productTags = product.tags || [];
      switch (rule.operator) {
        case "equals":
          return productTags.includes(rule.value);
        case "notEquals":
          return !productTags.includes(rule.value);
        case "contains":
          return productTags.some((tag) =>
            tag.toLowerCase().includes(rule.value.toLowerCase())
          );
        case "notContains":
          return !productTags.some((tag) =>
            tag.toLowerCase().includes(rule.value.toLowerCase())
          );
        case "startsWith":
          return productTags.some((tag) =>
            tag.toLowerCase().startsWith(rule.value.toLowerCase())
          );
        case "endsWith":
          return productTags.some((tag) =>
            tag.toLowerCase().endsWith(rule.value.toLowerCase())
          );
        default:
          return false;
      }
    case "sku":
      // Check first variant SKU
      value = product.variants[0]?.sku || null;
      break;
    case "price":
      // Check first variant price
      value = product.variants[0]?.price
        ? parseFloat(product.variants[0].price)
        : null;
      break;
    case "stock":
      // Calculate total inventory across all variants
      value = product.variants.reduce((sum, v) => sum + v.inventoryQuantity, 0);
      break;
  }

  if (value === null) return false;

  // Handle numeric comparisons for price and stock
  if (typeof value === "number") {
    const compareValue = parseFloat(rule.value);
    switch (rule.operator) {
      case "equals":
        return value === compareValue;
      case "notEquals":
        return value !== compareValue;
      case "greaterThan":
        return value > compareValue;
      case "lessThan":
        return value < compareValue;
      default:
        return false;
    }
  }

  // Handle string comparisons
  const strValue = String(value).toLowerCase();
  const ruleValue = rule.value.toLowerCase();

  switch (rule.operator) {
    case "equals":
      return strValue === ruleValue;
    case "notEquals":
      return strValue !== ruleValue;
    case "contains":
      return strValue.includes(ruleValue);
    case "notContains":
      return !strValue.includes(ruleValue);
    case "startsWith":
      return strValue.startsWith(ruleValue);
    case "endsWith":
      return strValue.endsWith(ruleValue);
    default:
      return false;
  }
}

/**
 * Determine whether a product matches any enabled exclusion rules.
 *
 * @param product - The product (including variants) to evaluate
 * @param exclusionRules - Array of exclusion rules to check against the product
 * @returns `true` if any enabled exclusion rule matches the product, `false` otherwise.
 */
export function shouldExcludeProduct(
  product: ProductWithVariants,
  exclusionRules: SyncExclusionRule[]
): boolean {
  // If any enabled rule matches, exclude the product
  return exclusionRules.some((rule) => matchesExclusionRule(product, rule));
}

/**
 * Get the reason why a product doesn't match filter rules.
 * Returns null if product passes all filters.
 */
export function getFilterFailureReason(
  product: ProductWithVariants,
  filters: FilterRules
): string | null {
  // Check brand filters
  if (filters.brands && filters.brands.length > 0) {
    if (!product.brand || !filters.brands.includes(product.brand)) {
      return `brand filter: product brand "${product.brand || 'null'}" not in allowed brands [${filters.brands.join(', ')}]`;
    }
  }

  // Check brand exclusions
  if (filters.excludeBrands && filters.excludeBrands.length > 0) {
    if (product.brand && filters.excludeBrands.includes(product.brand)) {
      return `excludeBrands: product brand "${product.brand}" is excluded`;
    }
  }

  // Check product type filters
  if (filters.productTypes && filters.productTypes.length > 0) {
    if (!product.productType || !filters.productTypes.includes(product.productType)) {
      return `productTypes filter: product type "${product.productType || 'null'}" not in allowed types [${filters.productTypes.join(', ')}]`;
    }
  }

  // Check product type exclusions
  if (filters.excludeProductTypes && filters.excludeProductTypes.length > 0) {
    if (product.productType && filters.excludeProductTypes.includes(product.productType)) {
      return `excludeProductTypes: product type "${product.productType}" is excluded`;
    }
  }

  // Check tag filters (match any)
  if (filters.tags && filters.tags.length > 0) {
    const productTags = product.tags || [];
    const hasMatchingTag = filters.tags.some((tag) => productTags.includes(tag));
    if (!hasMatchingTag) {
      return `tags filter: product tags [${productTags.join(', ')}] don't include any of [${filters.tags.join(', ')}]`;
    }
  }

  // Check tag exclusions
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const productTags = product.tags || [];
    const hasExcludedTag = filters.excludeTags.some((tag) => productTags.includes(tag));
    if (hasExcludedTag) {
      return `excludeTags: product has excluded tag`;
    }
  }

  // Check price range
  const firstVariantPrice = product.variants[0]?.price
    ? parseFloat(product.variants[0].price)
    : null;

  if (filters.minPrice !== undefined && firstVariantPrice !== null) {
    if (firstVariantPrice < filters.minPrice) {
      return `minPrice: product price ${firstVariantPrice} is below minimum ${filters.minPrice}`;
    }
  }

  if (filters.maxPrice !== undefined && firstVariantPrice !== null) {
    if (firstVariantPrice > filters.maxPrice) {
      return `maxPrice: product price ${firstVariantPrice} exceeds maximum ${filters.maxPrice}`;
    }
  }

  // Check require stock
  if (filters.requireStock) {
    const totalStock = product.variants.reduce((sum, v) => sum + v.inventoryQuantity, 0);
    if (totalStock <= 0) {
      return `requireStock: total stock ${totalStock} is <= 0`;
    }
  }

  // Check exclude title keywords
  if (filters.excludeTitleKeywords && filters.excludeTitleKeywords.length > 0) {
    const titleLower = product.name.toLowerCase();
    const matchedKeyword = filters.excludeTitleKeywords.find(
      (keyword) => titleLower.includes(keyword.toLowerCase())
    );
    if (matchedKeyword) {
      return `excludeTitleKeywords: title contains excluded keyword "${matchedKeyword}"`;
    }
  }

  return null;
}

/**
 * Determine whether a product satisfies all provided filter rules.
 *
 * Evaluates active brand and product type inclusions/exclusions, tag inclusions/exclusions,
 * price range based on the first variant, aggregate stock requirement, and title keyword exclusions.
 *
 * @param product - The product (including variants) to evaluate
 * @param filters - The set of filter rules to apply
 * @returns `true` if the product passes all active filters, `false` otherwise
 */
export function matchesFilters(
  product: ProductWithVariants,
  filters: FilterRules
): boolean {
  // Check brand filters
  if (filters.brands && filters.brands.length > 0) {
    if (!product.brand || !filters.brands.includes(product.brand)) {
      return false;
    }
  }

  // Check brand exclusions
  if (filters.excludeBrands && filters.excludeBrands.length > 0) {
    if (product.brand && filters.excludeBrands.includes(product.brand)) {
      return false;
    }
  }

  // Check product type filters
  if (filters.productTypes && filters.productTypes.length > 0) {
    if (!product.productType || !filters.productTypes.includes(product.productType)) {
      return false;
    }
  }

  // Check product type exclusions
  if (filters.excludeProductTypes && filters.excludeProductTypes.length > 0) {
    if (product.productType && filters.excludeProductTypes.includes(product.productType)) {
      return false;
    }
  }

  // Check tag filters (match any)
  if (filters.tags && filters.tags.length > 0) {
    const productTags = product.tags || [];
    const hasMatchingTag = filters.tags.some((tag) => productTags.includes(tag));
    if (!hasMatchingTag) {
      return false;
    }
  }

  // Check tag exclusions
  if (filters.excludeTags && filters.excludeTags.length > 0) {
    const productTags = product.tags || [];
    const hasExcludedTag = filters.excludeTags.some((tag) => productTags.includes(tag));
    if (hasExcludedTag) {
      return false;
    }
  }

  // Check price range (using first variant price)
  const firstVariantPrice = product.variants[0]?.price
    ? parseFloat(product.variants[0].price)
    : null;

  if (filters.minPrice !== undefined && firstVariantPrice !== null) {
    if (firstVariantPrice < filters.minPrice) {
      return false;
    }
  }

  if (filters.maxPrice !== undefined && firstVariantPrice !== null) {
    if (firstVariantPrice > filters.maxPrice) {
      return false;
    }
  }

  // Check require stock
  if (filters.requireStock) {
    const totalStock = product.variants.reduce((sum, v) => sum + v.inventoryQuantity, 0);
    if (totalStock <= 0) {
      return false;
    }
  }

  // Check exclude title keywords (case-insensitive)
  if (filters.excludeTitleKeywords && filters.excludeTitleKeywords.length > 0) {
    const titleLower = product.name.toLowerCase();
    const hasExcludedKeyword = filters.excludeTitleKeywords.some(
      (keyword) => titleLower.includes(keyword.toLowerCase())
    );
    if (hasExcludedKeyword) {
      return false;
    }
  }

  return true;
}