import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { integrations } from "./integrations";
import { idGenerator } from "../lib/typeid";

// ============================================
// Field Mapping Types
// ============================================

// Our system's product/variant fields
export type SourceField =
  | "name"
  | "description"
  | "brand"
  | "productType"
  | "tags"
  | "sku"
  | "barcode"
  | "price"
  | "compareAtPrice"
  | "costPrice"
  | "weight"
  | "weightUnit"
  | "images"
  | "variantName"
  | "variantAttributes"
  | "metafield:*"; // Custom metafields

// Shopify product/variant fields
export type ShopifyField =
  | "title"
  | "body_html"
  | "vendor"
  | "product_type"
  | "tags"
  | "sku"
  | "barcode"
  | "price"
  | "compare_at_price"
  | "cost"
  | "weight"
  | "weight_unit"
  | "images"
  | "option1"
  | "option2"
  | "option3"
  | "metafield:*"; // Custom metafields

// Sync mode determines when a field is synced
export type FieldSyncMode =
  | "always"      // Sync on every update (default)
  | "createOnly"  // Only sync when product is first created
  | "ifEmpty";    // Only sync if the Shopify field is empty/null

export interface FieldMapping {
  id: string;
  sourceField: string; // Our system field
  targetField: string; // Shopify field
  // When to sync this field
  syncMode: FieldSyncMode;
  // Optional transformation
  transform?: {
    type: "prefix" | "suffix" | "replace" | "template" | "uppercase" | "lowercase";
    value?: string;
    pattern?: string; // For replace
    replacement?: string; // For replace
  };
  // Whether to sync this field (can disable individual mappings)
  enabled: boolean;
}

export interface SyncExclusionRule {
  id: string;
  name: string;
  // Field to check
  field: "brand" | "productType" | "tag" | "sku" | "price" | "title" | "stock";
  // Comparison operator
  operator: "equals" | "notEquals" | "contains" | "notContains" | "startsWith" | "endsWith" | "greaterThan" | "lessThan";
  // Value to compare against
  value: string;
  // Whether rule is active
  enabled: boolean;
}

// ============================================
// Retailer Field Mappings Table
// ============================================

export const retailerFieldMappings = pgTable(
  "retailer_field_mappings",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("fieldMapping")),

    // The retailer organization
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // The target integration (Shopify store)
    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // Field mappings array
    fieldMappings: jsonb("field_mappings")
      .$type<FieldMapping[]>()
      .default([])
      .notNull(),

    // Exclusion rules - products matching these won't be synced
    exclusionRules: jsonb("exclusion_rules")
      .$type<SyncExclusionRule[]>()
      .default([])
      .notNull(),

    // Global sync settings
    syncSettings: jsonb("sync_settings")
      .$type<{
        // Master toggle - whether sync is enabled at all
        syncEnabled: boolean;
        // Whether to sync product images
        syncImages: boolean;
        // Whether to sync inventory levels
        syncInventory: boolean;
        // Whether to create new products or only update existing
        createNewProducts: boolean;
        // Whether to delete products that no longer exist in source
        deleteRemovedProducts: boolean;
        // Default status for new products
        defaultStatus: "active" | "draft" | "archived";
        // Whether to publish to all channels
        publishToChannels: boolean;
        // SKU prefix to add to all synced products
        skuPrefix?: string;
        // Vendor override (if not mapped)
        defaultVendor?: string;
        // Field locks - prevent specific fields from being overwritten
        fieldLocks?: {
          enabled: boolean;
          namespace: string;
          mappings: Record<string, string>;
          lockInterpretation?: "lockWhenFalse" | "lockWhenTrue";
        } | null;
      }>()
      .default({
        syncEnabled: false,
        syncImages: true,
        syncInventory: true,
        createNewProducts: true,
        deleteRemovedProducts: false,
        defaultStatus: "draft",
        publishToChannels: false,
      }),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // One mapping config per organization-integration pair
    index("retailer_field_mappings_org_idx").on(table.organizationId),
    index("retailer_field_mappings_integration_idx").on(table.integrationId),
  ]
);

// ============================================
// Types
// ============================================

export type RetailerFieldMapping = typeof retailerFieldMappings.$inferSelect;
export type NewRetailerFieldMapping = typeof retailerFieldMappings.$inferInsert;

// ============================================
// Default Field Mappings
// ============================================

export const DEFAULT_FIELD_MAPPINGS: FieldMapping[] = [
  { id: "fm_1", sourceField: "name", targetField: "title", syncMode: "always", enabled: true },
  { id: "fm_2", sourceField: "description", targetField: "body_html", syncMode: "always", enabled: true },
  { id: "fm_3", sourceField: "brand", targetField: "vendor", syncMode: "always", enabled: true },
  { id: "fm_4", sourceField: "productType", targetField: "product_type", syncMode: "always", enabled: true },
  { id: "fm_5", sourceField: "tags", targetField: "tags", syncMode: "always", enabled: true },
  { id: "fm_6", sourceField: "sku", targetField: "sku", syncMode: "always", enabled: true },
  { id: "fm_7", sourceField: "barcode", targetField: "barcode", syncMode: "always", enabled: true },
  { id: "fm_8", sourceField: "price", targetField: "price", syncMode: "always", enabled: true },
  { id: "fm_9", sourceField: "compareAtPrice", targetField: "compare_at_price", syncMode: "always", enabled: true },
  { id: "fm_10", sourceField: "weight", targetField: "weight", syncMode: "always", enabled: true },
  { id: "fm_11", sourceField: "weightUnit", targetField: "weight_unit", syncMode: "always", enabled: true },
  { id: "fm_12", sourceField: "images", targetField: "images", syncMode: "always", enabled: true },
  { id: "fm_13", sourceField: "variantName", targetField: "option1", syncMode: "always", enabled: true },
];

// Sync mode options for UI
export const SYNC_MODE_OPTIONS = [
  { value: "always", label: "Always", description: "Sync on every update" },
  { value: "createOnly", label: "Create Only", description: "Only sync when product is first created" },
  { value: "ifEmpty", label: "If Empty", description: "Only sync if Shopify field is empty" },
] as const;

// ============================================
// Source Fields Definition (for UI)
// ============================================

export const SOURCE_FIELDS = [
  { field: "name", label: "Product Name", type: "product" },
  { field: "description", label: "Description", type: "product" },
  { field: "brand", label: "Brand", type: "product" },
  { field: "productType", label: "Product Type", type: "product" },
  { field: "tags", label: "Tags", type: "product" },
  { field: "sku", label: "SKU", type: "variant" },
  { field: "barcode", label: "Barcode", type: "variant" },
  { field: "price", label: "Price", type: "variant" },
  { field: "compareAtPrice", label: "Compare At Price", type: "variant" },
  { field: "costPrice", label: "Cost Price", type: "variant" },
  { field: "weight", label: "Weight", type: "variant" },
  { field: "weightUnit", label: "Weight Unit", type: "variant" },
  { field: "images", label: "Images", type: "product" },
  { field: "variantName", label: "Variant Name", type: "variant" },
  { field: "variantAttributes", label: "Variant Attributes", type: "variant" },
] as const;

// ============================================
// Shopify Fields Definition (for UI)
// ============================================

export const SHOPIFY_FIELDS = [
  { field: "title", label: "Title", type: "product" },
  { field: "body_html", label: "Description (HTML)", type: "product" },
  { field: "vendor", label: "Vendor", type: "product" },
  { field: "product_type", label: "Product Type", type: "product" },
  { field: "tags", label: "Tags", type: "product" },
  { field: "sku", label: "SKU", type: "variant" },
  { field: "barcode", label: "Barcode", type: "variant" },
  { field: "price", label: "Price", type: "variant" },
  { field: "compare_at_price", label: "Compare At Price", type: "variant" },
  { field: "cost", label: "Cost", type: "variant" },
  { field: "weight", label: "Weight", type: "variant" },
  { field: "weight_unit", label: "Weight Unit", type: "variant" },
  { field: "images", label: "Images", type: "product" },
  { field: "option1", label: "Option 1", type: "variant" },
  { field: "option2", label: "Option 2", type: "variant" },
  { field: "option3", label: "Option 3", type: "variant" },
] as const;
