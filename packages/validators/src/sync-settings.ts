import { z } from "zod";
import { connectionId, integrationId } from "./common.js";

// ============================================
// Filter Rules
// ============================================

export const filterRules = z.object({
  // Filter by brand names (include only these)
  brands: z.array(z.string()).optional(),
  // Filter by product types
  productTypes: z.array(z.string()).optional(),
  // Filter by tags (match any)
  tags: z.array(z.string()).optional(),
  // Exclude specific brands
  excludeBrands: z.array(z.string()).optional(),
  // Exclude specific product types
  excludeProductTypes: z.array(z.string()).optional(),
  // Exclude specific tags
  excludeTags: z.array(z.string()).optional(),
});

export type FilterRules = z.infer<typeof filterRules>;

// ============================================
// Field Mapping Rules
// ============================================

export const mappableField = z.enum(["brand", "productType", "tag"]);
export type MappableField = z.infer<typeof mappableField>;

export const fieldMappingRule = z.object({
  // Unique ID for the rule
  id: z.string().min(1),
  // Source: what to match in the feed
  sourceField: mappableField,
  sourceValue: z.string(),
  // Target: what to set in Shopify
  targetField: mappableField,
  targetValue: z.string(),
});

export type FieldMappingRule = z.infer<typeof fieldMappingRule>;

// ============================================
// Price Adjustment (deprecated - use pricingMargin)
// ============================================

export const priceAdjustment = z
  .object({
    type: z.enum(["percentage", "fixed"]),
    // For percentage: e.g., 10 means +10% markup
    // For fixed: e.g., 5 means add $5 to each product
    value: z.number(),
  })
  .nullable();

export type PriceAdjustment = z.infer<typeof priceAdjustment>;

// ============================================
// Pricing Margin (new flexible system)
// ============================================

export const marginConditionField = z.enum([
  "brand",
  "productType",
  "tag",
  "sku",
  "price",
  "compareAtPrice",
  "costPrice",
]);

export type MarginConditionField = z.infer<typeof marginConditionField>;

export const marginConditionOperator = z.enum([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "greaterThan",
  "lessThan",
  "between",
]);

export type MarginConditionOperator = z.infer<typeof marginConditionOperator>;

export const marginCondition = z.object({
  field: marginConditionField,
  operator: marginConditionOperator,
  // string for text fields, number for numeric, tuple for "between"
  value: z.union([
    z.string(),
    z.number(),
    z.tuple([z.number(), z.number()]), // [min, max] for "between"
  ]),
});

export type MarginCondition = z.infer<typeof marginCondition>;

export const marginType = z.enum(["percentage", "fixed"]);

export type MarginType = z.infer<typeof marginType>;

export const marginRule = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  priority: z.number().int().min(0).max(999),
  conditions: z.array(marginCondition).min(1),
  marginType: marginType,
  marginValue: z.number(),
});

export type MarginRule = z.infer<typeof marginRule>;

export const pricingMarginRounding = z.object({
  enabled: z.boolean(),
  strategy: z.enum(["none", "up", "down", "nearest"]),
  // precision: -1 = round to nearest $10, 0 = whole number, 1 = 10 cents
  precision: z.number().int().min(-1).max(1),
  endWith: z.number().int().min(0).max(99).optional(),
});

export type PricingMarginRounding = z.infer<typeof pricingMarginRounding>;

export const pricingMarginBounds = z.object({
  minPrice: z.number().min(0).optional(),
  maxMarkup: z.number().min(0).optional(),
});

export type PricingMarginBounds = z.infer<typeof pricingMarginBounds>;

export const pricingMargin = z.object({
  defaultMargin: z
    .object({
      type: marginType,
      value: z.number(),
    })
    .nullable(),
  rules: z.array(marginRule).default([]),
  rounding: pricingMarginRounding.optional(),
  bounds: pricingMarginBounds.optional(),
});

export type PricingMargin = z.infer<typeof pricingMargin>;

// ============================================
// Create/Update Sync Settings
// ============================================

export const createSyncSettings = z.object({
  connectionId: connectionId,
  integrationId: integrationId,
  syncEnabled: z.boolean().default(false),
  syncIntervalHours: z.number().int().min(1).max(168).default(24), // 1 hour to 1 week
  filterRules: filterRules.optional(),
  fieldMappings: z.array(fieldMappingRule).optional(),
  priceAdjustment: priceAdjustment.optional(), // deprecated
  pricingMargin: pricingMargin.optional(),
});

export type CreateSyncSettings = z.infer<typeof createSyncSettings>;

export const updateSyncSettings = z.object({
  syncEnabled: z.boolean().optional(),
  syncIntervalHours: z.number().int().min(1).max(168).optional(),
  filterRules: filterRules.optional(),
  fieldMappings: z.array(fieldMappingRule).optional(),
  priceAdjustment: priceAdjustment.optional(), // deprecated
  pricingMargin: pricingMargin.optional(),
});

export type UpdateSyncSettings = z.infer<typeof updateSyncSettings>;

// ============================================
// Sync Settings Response
// ============================================

export const syncSettingsResponse = z.object({
  id: z.string(),
  connectionId: connectionId,
  integrationId: integrationId,
  syncEnabled: z.string(), // stored as text in DB
  syncIntervalHours: z.string().nullable(),
  filterRules: filterRules.nullable(),
  fieldMappings: z.array(fieldMappingRule).nullable(),
  priceAdjustment: priceAdjustment, // deprecated
  pricingMargin: pricingMargin.nullable(),
  lastSyncAt: z.coerce.date().nullable(),
  lastSyncError: z.string().nullable(),
  lastSyncProductCount: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SyncSettingsResponse = z.infer<typeof syncSettingsResponse>;

// ============================================
// Trigger Sync
// ============================================

export const triggerProductSync = z.object({
  syncType: z.enum(["full", "incremental"]).default("incremental"),
});

export type TriggerProductSync = z.infer<typeof triggerProductSync>;

// ============================================
// Synced Product Status
// ============================================

export const syncedProductStatus = z.enum([
  "pending",
  "synced",
  "failed",
  "deleted",
]);

export type SyncedProductStatus = z.infer<typeof syncedProductStatus>;

export const syncedProductResponse = z.object({
  id: z.string(),
  syncSettingsId: z.string(),
  sourceProductId: z.string(),
  sourceVariantId: z.string(),
  externalProductId: z.string().nullable(),
  externalVariantId: z.string().nullable(),
  syncStatus: syncedProductStatus,
  lastError: z.string().nullable(),
  lastSyncedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SyncedProductResponse = z.infer<typeof syncedProductResponse>;

// ============================================
// Global Sync Settings (Organization Level)
// ============================================

export const defaultPublicationMode = z.enum(["all", "selected", "none"]);
export type DefaultPublicationMode = z.infer<typeof defaultPublicationMode>;

export const defaultPublications = z.object({
  mode: defaultPublicationMode,
  publicationIds: z.array(z.string()).optional(),
});
export type DefaultPublications = z.infer<typeof defaultPublications>;

export const fieldLockConfig = z.object({
  enabled: z.boolean(),
  namespace: z.string(),
  mappings: z.record(z.string(), z.string()),
  lockInterpretation: z.enum(["lockWhenFalse", "lockWhenTrue"]).optional(),
});
export type FieldLockConfig = z.infer<typeof fieldLockConfig>;

export const globalSyncSettings = z.object({
  // Pricing margin
  pricingMargin: pricingMargin.nullable().optional(),

  // Publications / Sales Channels
  defaultPublications: defaultPublications.nullable().optional(),

  // Product behavior
  defaultStatus: z.enum(["active", "draft", "archived"]).optional(),
  createNewProducts: z.boolean().optional(),
  deleteRemovedProducts: z.boolean().optional(),

  // Data sync
  syncImages: z.boolean().optional(),
  syncInventory: z.boolean().optional(),

  // Defaults
  skuPrefix: z.string().max(20).optional(),
  defaultVendor: z.string().optional(),

  // Field locks
  fieldLocks: fieldLockConfig.nullable().optional(),
});
export type GlobalSyncSettings = z.infer<typeof globalSyncSettings>;
