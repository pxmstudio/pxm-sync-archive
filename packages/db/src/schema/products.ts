import {
  pgTable,
  text,
  timestamp,
  jsonb,
  numeric,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { feeds } from "./feeds";
import { idGenerator } from "../lib/typeid";

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("product")),

    // Owner - either a verified supplier (organization) OR a feed
    // Exactly one must be set (enforced by check constraint)
    supplierId: text("supplier_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    feedId: text("feed_id").references(() => feeds.id, { onDelete: "cascade" }),

    // External reference (e.g., Shopify product ID)
    externalId: text("external_id"),

    // Product info
    sku: text("sku"),
    name: text("name").notNull(),
    description: text("description"),
    brand: text("brand"),
    productType: text("product_type"),

    // Tags for visibility rules and filtering
    tags: text("tags").array().default([]),

    // Images
    images: jsonb("images").$type<ProductImage[]>().default([]),

    // Flexible metadata storage
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    // Status
    isActive: text("is_active").notNull().default("true"),

    // Sync tracking
    syncedAt: timestamp("synced_at"),

    // ============================================
    // Change Detection (for incremental sync)
    // ============================================

    // Content hashes for change detection (MD5)
    contentHash: text("content_hash"),     // Combined hash of all non-inventory fields
    coreHash: text("core_hash"),           // name, description, brand, productType, tags
    imagesHash: text("images_hash"),       // images array
    variantsHash: text("variants_hash"),   // variant pricing/attributes (not inventory)

    // When content last changed (different from updatedAt which changes on any write)
    changedAt: timestamp("changed_at"),

    // What type of change occurred (enables fast-path routing)
    // 'new' = newly created product
    // 'full' = any non-inventory field changed
    // 'price' = only price/compareAtPrice/costPrice changed
    // 'inventory' = only inventory quantity changed
    changeType: text("change_type").$type<"new" | "full" | "price" | "inventory">(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    // Ensure exactly one owner type is set
    check(
      "products_single_owner",
      sql`(${table.supplierId} IS NOT NULL AND ${table.feedId} IS NULL) OR (${table.supplierId} IS NULL AND ${table.feedId} IS NOT NULL)`
    ),
    index("products_supplier_idx").on(table.supplierId),
    index("products_feed_idx").on(table.feedId),
    index("products_external_id_idx").on(table.supplierId, table.externalId),
    index("products_sku_idx").on(table.supplierId, table.sku),
    index("products_feed_sku_idx").on(table.feedId, table.sku),
    // Change detection indexes
    index("products_changed_at_idx").on(table.feedId, table.changedAt),
    index("products_change_type_idx").on(table.feedId, table.changeType),
  ]
);

export const variants = pgTable(
  "variants",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("variant")),

    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    // External reference (e.g., Shopify variant ID)
    externalId: text("external_id"),

    // Shopify inventory item ID (needed for inventory adjustments)
    inventoryItemId: text("inventory_item_id"),

    // Variant info
    sku: text("sku"),
    name: text("name").notNull(),
    barcode: text("barcode"),

    // Pricing (default/base price)
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }),
    costPrice: numeric("cost_price", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("USD"),

    // Weight for shipping
    weight: numeric("weight", { precision: 10, scale: 2 }),
    weightUnit: text("weight_unit").default("kg"),

    // Unit price measurement (from Shopify unitPriceMeasurement)
    // Used for pricing rules based on volume, weight, etc.
    measurementType: text("measurement_type"), // VOLUME, WEIGHT, AREA, LENGTH, COUNT
    quantityValue: numeric("quantity_value", { precision: 10, scale: 2 }),
    quantityUnit: text("quantity_unit"), // ML, L, G, KG, etc.
    referenceValue: numeric("reference_value", { precision: 10, scale: 2 }),
    referenceUnit: text("reference_unit"), // ML, L, G, KG, etc.

    // Variant attributes (size, color, etc.)
    attributes: jsonb("attributes").$type<Record<string, string>>().default({}),

    // Sort order
    position: text("position").default("0"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("variants_product_idx").on(table.productId),
    index("variants_external_id_idx").on(table.productId, table.externalId),
    index("variants_sku_idx").on(table.sku),
    index("variants_inventory_item_idx").on(table.inventoryItemId),
  ]
);

// Interface for product images
export interface ProductImage {
  url: string;
  altText?: string;
  position?: number;
  width?: number;
  height?: number;
}

// Product tags table - aggregated from product data
export const productTags = pgTable(
  "product_tags",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("productTag")),

    // Owner (supplier)
    supplierId: text("supplier_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Tag info
    name: text("name").notNull(),
    // Slug for deduplication (lowercase, no spaces)
    slug: text("slug").notNull(),

    // Product count (denormalized for quick display)
    productCount: text("product_count").notNull().default("0"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("product_tags_supplier_idx").on(table.supplierId),
    index("product_tags_slug_idx").on(table.supplierId, table.slug),
  ]
);

// Product types table - aggregated from product data
export const productTypes = pgTable(
  "product_types",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("productType")),

    // Owner (supplier)
    supplierId: text("supplier_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Product type info
    name: text("name").notNull(),
    // Slug for deduplication (lowercase, no spaces)
    slug: text("slug").notNull(),

    // Product count (denormalized for quick display)
    productCount: text("product_count").notNull().default("0"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("product_types_supplier_idx").on(table.supplierId),
    index("product_types_slug_idx").on(table.supplierId, table.slug),
  ]
);

// Brands table - aggregated from product data
export const brands = pgTable(
  "brands",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("brand")),

    // Owner (supplier)
    supplierId: text("supplier_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Brand info
    name: text("name").notNull(),
    // Slug for deduplication (lowercase, no spaces)
    slug: text("slug").notNull(),

    // Product count (denormalized for quick display)
    productCount: text("product_count").notNull().default("0"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("brands_supplier_idx").on(table.supplierId),
    index("brands_slug_idx").on(table.supplierId, table.slug),
  ]
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Variant = typeof variants.$inferSelect;
export type NewVariant = typeof variants.$inferInsert;
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type ProductTag = typeof productTags.$inferSelect;
export type NewProductTag = typeof productTags.$inferInsert;
export type ProductType = typeof productTypes.$inferSelect;
export type NewProductType = typeof productTypes.$inferInsert;
