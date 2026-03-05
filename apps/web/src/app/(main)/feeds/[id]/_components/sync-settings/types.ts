import type {
  FieldMappingRule,
  FilterRules,
  PricingMargin,
  MarginRule,
  MarginCondition,
  FieldLockConfig,
  PublicationOverride,
  ShopifyPublication,
  LockableField,
  ProductStatus,
} from "@/hooks/use-sync-settings";
import type { SyncExclusionRule } from "@/hooks/use-field-mappings";
import type { GlobalSyncSettings } from "@/hooks/use-global-sync-settings";
import type { Integration, MetafieldDefinition, StoreMetadata } from "@/hooks/use-integrations";

export type {
  FieldMappingRule,
  FilterRules,
  PricingMargin,
  MarginRule,
  MarginCondition,
  FieldLockConfig,
  PublicationOverride,
  ShopifyPublication,
  LockableField,
  ProductStatus,
  SyncExclusionRule,
  GlobalSyncSettings,
  Integration,
  MetafieldDefinition,
  StoreMetadata,
};

export interface FilterOptions {
  brands: string[];
  productTypes: string[];
  tags: string[];
}

export const LOCKABLE_FIELD_LABELS: Record<LockableField, string> = {
  images: "Images",
  status: "Status",
  quantity: "Quantity",
  price: "Price",
  compareAtPrice: "Compare At Price",
  productType: "Product Type",
  description: "Description",
  title: "Title",
  vendor: "Vendor",
  tags: "Tags",
};

/**
 * Generate a unique identifier for a rule.
 *
 * @returns A string in the format `rule_<timestamp>_<suffix>`, where `<timestamp>` is the epoch milliseconds and `<suffix>` is a 5-character base-36 random string.
 */
export function generateRuleId() {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}