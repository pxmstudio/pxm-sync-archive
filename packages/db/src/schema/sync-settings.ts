import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  unique,
  integer,
} from "drizzle-orm/pg-core";
import { connections } from "./connections";
import { feeds, feedSubscriptions } from "./feeds";
import { integrations } from "./integrations";
import { products, variants } from "./products";
import { idGenerator } from "../lib/typeid";
import { syncProductStatusEnum, storeSyncRunStatusEnum } from "./enums";

// ============================================
// Filter Rules Type
// ============================================

export interface FilterRules {
  // Filter by brand names
  brands?: string[];
  // Filter by product types
  productTypes?: string[];
  // Filter by tags (match any)
  tags?: string[];
  // Exclude specific brands
  excludeBrands?: string[];
  // Exclude specific product types
  excludeProductTypes?: string[];
  // Exclude specific tags
  excludeTags?: string[];
  // Price range filtering
  minPrice?: number;
  maxPrice?: number;
  // Only sync products with stock > 0
  requireStock?: boolean;
  // Exclude products with these keywords in title (case-insensitive)
  excludeTitleKeywords?: string[];
  // New products default to DRAFT status instead of ACTIVE
  defaultToDraft?: boolean;
}

// ============================================
// Pricing Margin Types
// ============================================

export type MarginConditionField =
  | "brand"
  | "productType"
  | "tag"
  | "sku"
  | "price"
  | "compareAtPrice"
  | "costPrice";

export type MarginConditionOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "between";

export interface MarginCondition {
  field: MarginConditionField;
  operator: MarginConditionOperator;
  value: string | number | [number, number]; // [min, max] for "between"
}

export type MarginType = "percentage" | "fixed";

export interface MarginRule {
  id: string;
  name: string;
  priority: number;
  conditions: MarginCondition[];
  marginType: MarginType;
  marginValue: number;
}

export interface PricingMarginRounding {
  enabled: boolean;
  strategy: "none" | "up" | "down" | "nearest";
  precision: number;
  endWith?: number;
}

export interface PricingMarginBounds {
  minPrice?: number;
  maxMarkup?: number;
}

export interface PricingMargin {
  defaultMargin: {
    type: MarginType;
    value: number;
  } | null;
  rules: MarginRule[];
  rounding?: PricingMarginRounding;
  bounds?: PricingMarginBounds;
}

// SyncExclusionRule is imported from field-mappings.ts
import type { SyncExclusionRule } from "./field-mappings.js";

// ============================================
// Field Lock Types (Custom Metafield Overrides)
// ============================================

export type LockableField =
  | "images"
  | "status"
  | "quantity"
  | "price"
  | "compareAtPrice"
  | "productType"
  | "description"
  | "title"
  | "vendor"
  | "tags";

export interface FieldLockConfig {
  // Whether field locking is enabled
  enabled: boolean;

  // Metafield namespace for lock metafields (default: "custom")
  namespace: string;

  // Mapping of our fields to metafield keys
  // When metafield value is "false", that field is not synced
  mappings: Partial<Record<LockableField, string>>;

  // Lock interpretation mode:
  // - "lockWhenTrue" (default): metafield value "true" = field is LOCKED (don't sync)
  // - "lockWhenFalse": metafield value "false" = field is LOCKED (don't sync)
  lockInterpretation?: "lockWhenFalse" | "lockWhenTrue";
}

// Default configuration (matches GogoBaby behavior)
export const DEFAULT_FIELD_LOCK_CONFIG: FieldLockConfig = {
  enabled: false,
  namespace: "custom",
  mappings: {
    images: "custom_images",
    status: "custom_status",
    quantity: "custom_quantity",
    price: "custom_price",
    compareAtPrice: "custom_compare_at_price",
    productType: "custom_product_type",
    description: "custom_description",
    title: "custom_title",
    vendor: "custom_vendor",
    tags: "custom_tags",
  },
};

// ============================================
// Publication Override Types
// ============================================

export type PublicationOverrideMode = "default" | "override" | "none";

export interface PublicationOverride {
  // Mode: use integration defaults, override, or disable
  mode: PublicationOverrideMode;

  // When mode="override", use these publication IDs
  publicationIds?: string[];
}

// ============================================
// Field Remapping Types
// ============================================

/**
 * Remappable fields - fields that can have their values remapped
 */
export type RemappableField = "productType" | "vendor" | "tags";

/**
 * A single value remapping rule
 */
export interface FieldRemapRule {
  /** Unique ID for the rule (for UI purposes) */
  id: string;
  /** Original value from the feed (case-insensitive match) */
  from: string;
  /** Value to use in Shopify */
  to: string;
}

/**
 * Configuration for remapping field values
 * Maps original values from the feed to new values in Shopify
 */
export interface FieldRemappingConfig {
  /** Whether field remapping is enabled */
  enabled: boolean;

  /** Product type remappings (e.g., "Lanturi antiderapante" -> "Snow Chains") */
  productType?: FieldRemapRule[];

  /** Vendor/brand remappings (e.g., "GoSoft" -> "GoSoft Premium") */
  vendor?: FieldRemapRule[];

  /** Tag remappings (e.g., "winter" -> "Winter Collection") */
  tags?: FieldRemapRule[];
}

// ============================================
// Change Breakdown Types
// ============================================

/**
 * Breakdown of changes detected during sync.
 * Used for displaying sync stats in the UI.
 */
export interface SyncChangeBreakdown {
  new: number;
  full: number;
  price: number;
  inventory: number;
  unchanged: number;
  total: number;
  /** Number of inventory updates using the fast-path (direct Inventory API) */
  inventoryFastPath?: number;
}

// ============================================
// Field Mapping Types
// ============================================

export type MappableField = "brand" | "productType" | "tag";

export interface FieldMappingRule {
  // Unique ID for the rule
  id: string;
  // Source: what to match in the feed
  sourceField: MappableField;
  sourceValue: string;
  // Target: what to set in Shopify
  targetField: MappableField;
  targetValue: string;
}

// ============================================
// Connection Sync Settings Table
// ============================================

export const connectionSyncSettings = pgTable(
  "connection_sync_settings",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("syncSetting")),

    // The connection this applies to (supplier-retailer relationship)
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),

    // The retailer's integration (their Shopify store)
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // Whether auto-sync is enabled
    syncEnabled: text("sync_enabled").notNull().default("false"),

    // Sync interval in hours (for scheduled sync)
    syncIntervalHours: text("sync_interval_hours").default("24"),

    // Filter rules for which products to sync
    filterRules: jsonb("filter_rules").$type<FilterRules>().default({}),

    // Field mapping rules
    fieldMappings: jsonb("field_mappings")
      .$type<FieldMappingRule[]>()
      .default([]),

    // Price adjustment for synced products (deprecated - use pricingMargin)
    priceAdjustment: jsonb("price_adjustment").$type<{
      type: "percentage" | "fixed";
      value: number;
    } | null>(),

    // Pricing margin configuration with conditions and rules
    pricingMargin: jsonb("pricing_margin").$type<PricingMargin>(),

    // Sync tracking
    lastSyncAt: timestamp("last_sync_at"),
    lastSyncError: text("last_sync_error"),
    lastSyncProductCount: text("last_sync_product_count"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // One sync setting per connection-integration pair
    unique("connection_sync_settings_unique").on(
      table.connectionId,
      table.integrationId
    ),
    index("connection_sync_settings_connection_idx").on(table.connectionId),
    index("connection_sync_settings_integration_idx").on(table.integrationId),
    index("connection_sync_settings_enabled_idx").on(table.syncEnabled),
  ]
);

// ============================================
// Feed Subscription Sync Settings Table
// ============================================

/**
 * Sync settings for feed subscriptions (Community Library).
 * Controls how products from a feed are synced to a retailer's Shopify store.
 */
export const feedSubscriptionSyncSettings = pgTable(
  "feed_subscription_sync_settings",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("feedSyncSetting")),

    // The subscription this applies to
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => feedSubscriptions.id, { onDelete: "cascade" }),

    // The retailer's integration (their Shopify store)
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // Whether auto-sync is enabled
    syncEnabled: text("sync_enabled").notNull().default("false"),

    // Sync interval in hours (for scheduled sync)
    syncIntervalHours: text("sync_interval_hours").default("24"),

    // Filter rules for which products to sync
    filterRules: jsonb("filter_rules").$type<FilterRules>().default({}),

    // Field mapping rules
    fieldMappings: jsonb("field_mappings")
      .$type<FieldMappingRule[]>()
      .default([]),

    // Pricing margin configuration with conditions and rules
    pricingMargin: jsonb("pricing_margin").$type<PricingMargin>(),

    // SKU transformation
    skuPrefix: text("sku_prefix"), // Prefix to add to all SKUs (e.g., "GGB-")

    // Field lock configuration (per-product field overrides via metafields)
    fieldLocks: jsonb("field_locks").$type<FieldLockConfig>(),

    // Publication/sales channel override
    publicationOverride: jsonb("publication_override").$type<PublicationOverride>(),

    // Default product status for new products (active, draft, archived)
    // When null, uses global settings
    defaultProductStatus: text("default_product_status").$type<"active" | "draft" | "archived">(),

    // Exclusion rules for filtering products
    // When null, uses global settings
    exclusionRules: jsonb("exclusion_rules").$type<SyncExclusionRule[]>(),

    // Field value remapping (e.g., remap product types to different values)
    fieldRemappings: jsonb("field_remappings").$type<FieldRemappingConfig>(),

    // ============================================
    // Change Detection (for incremental sync)
    // ============================================

    // Hash of current settings (pricing, filters, mappings, etc.)
    // Used to detect when settings change and trigger re-sync
    settingsHash: text("settings_hash"),

    // When settings were last changed
    settingsChangedAt: timestamp("settings_changed_at"),

    // Sync tracking
    lastSyncAt: timestamp("last_sync_at"),
    lastSyncError: text("last_sync_error"),
    lastSyncProductCount: text("last_sync_product_count"),
    lastSyncChangeBreakdown: jsonb("last_sync_change_breakdown").$type<SyncChangeBreakdown>(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // One sync setting per subscription-integration pair
    unique("feed_subscription_sync_settings_unique").on(
      table.subscriptionId,
      table.integrationId
    ),
    index("feed_subscription_sync_settings_subscription_idx").on(table.subscriptionId),
    index("feed_subscription_sync_settings_integration_idx").on(table.integrationId),
    index("feed_subscription_sync_settings_enabled_idx").on(table.syncEnabled),
  ]
);

// ============================================
// Feed Synced Products Table
// ============================================

/**
 * Tracks which products have been synced from a feed subscription to Shopify.
 */
export const feedSyncedProducts = pgTable(
  "feed_synced_products",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("feedSyncedProduct")),

    // Which sync settings this belongs to
    syncSettingsId: text("sync_settings_id")
      .notNull()
      .references(() => feedSubscriptionSyncSettings.id, { onDelete: "cascade" }),

    // Source product (from feed)
    sourceProductId: text("source_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    // Source variant (from feed)
    sourceVariantId: text("source_variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),

    // External IDs in retailer's Shopify store
    externalProductId: text("external_product_id"),
    externalVariantId: text("external_variant_id"),
    externalInventoryItemId: text("external_inventory_item_id"),

    // Sync status
    syncStatus: syncProductStatusEnum("sync_status").notNull().default("pending"),

    // Last error if failed
    lastError: text("last_error"),

    // ============================================
    // Change Detection Hashes (for incremental sync)
    // ============================================

    // Hash of product content when last synced
    lastSyncedContentHash: text("last_synced_content_hash"),

    // Hash of sync settings when last synced (detect config changes)
    lastSyncedSettingsHash: text("last_synced_settings_hash"),

    // Inventory tracking for fast-path
    lastSyncedInventoryHash: text("last_synced_inventory_hash"),
    lastInventorySyncAt: timestamp("last_inventory_sync_at"),

    // Timestamps
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // One entry per variant per sync settings
    unique("feed_synced_products_variant_unique").on(
      table.syncSettingsId,
      table.sourceVariantId
    ),
    index("feed_synced_products_sync_settings_idx").on(table.syncSettingsId),
    index("feed_synced_products_source_product_idx").on(table.sourceProductId),
    index("feed_synced_products_status_idx").on(table.syncStatus),
    index("feed_synced_products_external_product_idx").on(table.externalProductId),
    index("feed_synced_products_external_variant_idx").on(table.externalVariantId),
    // Index for inventory fast-path lookups
    index("feed_synced_products_inventory_item_idx").on(table.externalInventoryItemId),
    // Index for change detection queries
    index("feed_synced_products_content_hash_idx").on(table.syncSettingsId, table.lastSyncedContentHash),
  ]
);

// ============================================
// Synced Products Table (Legacy - for connections)
// ============================================

export const syncedProducts = pgTable(
  "synced_products",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("syncedProduct")),

    // Which sync settings this belongs to
    syncSettingsId: text("sync_settings_id")
      .notNull()
      .references(() => connectionSyncSettings.id, { onDelete: "cascade" }),

    // Source product (from supplier)
    sourceProductId: text("source_product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    // Source variant (from supplier)
    sourceVariantId: text("source_variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),

    // External IDs in retailer's Shopify store
    externalProductId: text("external_product_id"),
    externalVariantId: text("external_variant_id"),

    // Sync status
    syncStatus: syncProductStatusEnum("sync_status").notNull().default("pending"),

    // Last error if failed
    lastError: text("last_error"),

    // Timestamps
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // One entry per variant per sync settings
    unique("synced_products_variant_unique").on(
      table.syncSettingsId,
      table.sourceVariantId
    ),
    index("synced_products_sync_settings_idx").on(table.syncSettingsId),
    index("synced_products_source_product_idx").on(table.sourceProductId),
    index("synced_products_status_idx").on(table.syncStatus),
    index("synced_products_external_product_idx").on(table.externalProductId),
    // Index for reverse lookup (retailer's Shopify variant -> supplier variant)
    index("synced_products_external_variant_idx").on(table.externalVariantId),
  ]
);

// ============================================
// Types
// ============================================

export type ConnectionSyncSettings = typeof connectionSyncSettings.$inferSelect;
export type NewConnectionSyncSettings = typeof connectionSyncSettings.$inferInsert;
export type SyncedProduct = typeof syncedProducts.$inferSelect;
export type NewSyncedProduct = typeof syncedProducts.$inferInsert;

// Feed subscription sync types
export type FeedSubscriptionSyncSettings = typeof feedSubscriptionSyncSettings.$inferSelect;
export type NewFeedSubscriptionSyncSettings = typeof feedSubscriptionSyncSettings.$inferInsert;
export type FeedSyncedProduct = typeof feedSyncedProducts.$inferSelect;
export type NewFeedSyncedProduct = typeof feedSyncedProducts.$inferInsert;

// ============================================
// Store Sync Runs Table (Activity Log)
// ============================================

/**
 * Error structure for sync run errors.
 * Captures details about products that failed to sync.
 */
export interface StoreSyncError {
  productId?: string;
  sku?: string;
  productName?: string;
  action?: "create" | "update" | "delete";
  message: string;
  code?: string;
}

/**
 * Tracks each store sync execution (pushing products to Shopify).
 * Used for the Activity page to show sync history.
 */
export const storeSyncRuns = pgTable(
  "store_sync_runs",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("storeSyncRun")),

    // References
    syncSettingsId: text("sync_settings_id")
      .notNull()
      .references(() => feedSubscriptionSyncSettings.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .notNull()
      .references(() => feedSubscriptions.id, { onDelete: "cascade" }),
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),
    feedId: text("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),

    // Trigger.dev integration
    triggerRunId: text("trigger_run_id"),

    // Execution info
    syncType: text("sync_type").notNull(), // 'full' | 'incremental' | 'manual'
    status: storeSyncRunStatusEnum("status").notNull().default("pending"),

    // Timing
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),

    // Results
    productsProcessed: integer("products_processed").notNull().default(0),
    productsCreated: integer("products_created").notNull().default(0),
    productsUpdated: integer("products_updated").notNull().default(0),
    productsSkipped: integer("products_skipped").notNull().default(0),
    productsFailed: integer("products_failed").notNull().default(0),

    // Error tracking
    errorMessage: text("error_message"),
    errors: jsonb("errors").$type<StoreSyncError[]>(),

    // Change breakdown (for incremental sync)
    changeBreakdown: jsonb("change_breakdown").$type<SyncChangeBreakdown>(),

    // Trigger metadata
    triggeredBy: text("triggered_by").notNull(), // 'schedule' | 'manual'
    triggeredByUserId: text("triggered_by_user_id"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("store_sync_runs_settings_idx").on(table.syncSettingsId),
    index("store_sync_runs_subscription_idx").on(table.subscriptionId),
    index("store_sync_runs_integration_idx").on(table.integrationId),
    index("store_sync_runs_feed_idx").on(table.feedId),
    index("store_sync_runs_started_idx").on(table.startedAt),
    index("store_sync_runs_status_idx").on(table.status),
  ]
);

// Store sync run types
export type StoreSyncRun = typeof storeSyncRuns.$inferSelect;
export type NewStoreSyncRun = typeof storeSyncRuns.$inferInsert;
