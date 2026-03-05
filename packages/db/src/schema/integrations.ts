import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { integrationProviderEnum } from "./enums";
import { idGenerator } from "../lib/typeid";

// E-commerce platform integrations (Shopify, Custom API, etc.)
export const integrations = pgTable(
  "integrations",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("integration")),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    provider: integrationProviderEnum("provider").notNull(),

    // Display name for this integration
    name: text("name").notNull(),

    // Provider-specific identifier (e.g., Shopify shop domain)
    externalIdentifier: text("external_identifier"),

    // OAuth Client ID (not secret, stored plain) - deprecated for Shopify custom apps
    oauthClientId: text("oauth_client_id"),

    // Encrypted credentials stored in GCP KMS
    // Contains JSON: { accessToken } for Shopify Admin API tokens
    credentialsRef: text("credentials_ref"),

    // Webhook secret for verifying incoming webhooks
    webhookSecretRef: text("webhook_secret_ref"),

    // Scopes/permissions granted
    scopes: text("scopes").array().default([]),

    // Provider-specific settings
    settings: jsonb("settings").$type<IntegrationSettings>().default({}),

    // Store currency code (e.g., "USD", "EUR", "RON") - platform agnostic
    currency: text("currency"),

    // Sync tracking
    lastSyncAt: timestamp("last_sync_at"),
    lastSyncError: text("last_sync_error"),

    // Status
    isActive: text("is_active").notNull().default("true"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("integrations_org_idx").on(table.organizationId),
    index("integrations_provider_idx").on(
      table.organizationId,
      table.provider
    ),
  ]
);

// Sync cursors for pagination/incremental sync
export const syncCursors = pgTable(
  "sync_cursors",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("syncCursor")),

    integrationId: text("integration_id")
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // Resource type (products, inventory, orders)
    resourceType: text("resource_type").notNull(),

    // Cursor value (page token, updated_at timestamp, etc.)
    cursor: text("cursor"),

    // Timestamps
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("sync_cursors_integration_idx").on(table.integrationId)]
);

// ============================================
// Shopify Publication Types
// ============================================

export interface ShopifyPublication {
  id: string; // "gid://shopify/Publication/12345678"
  name: string; // "Online Store", "Point of Sale", etc.
  handle?: string; // "online-store"
  autoPublish: boolean; // Whether to auto-publish synced products to this channel
}

// ============================================
// Integration Settings
// ============================================

export interface IntegrationSettings {
  // Shopify-specific
  shopifyApiVersion?: string;
  shopifyLocationIds?: string[];

  // Sales channels/publications to publish products to
  publications?: ShopifyPublication[];

  // Custom API-specific
  baseUrl?: string;
  authType?: "api_key" | "oauth" | "basic";

  // Sync settings (for supplier import)
  syncInterval?: number; // minutes
  syncProducts?: boolean;
  syncInventory?: boolean;
  syncOrders?: boolean;

  // Webhook topics to subscribe to
  webhookTopics?: string[];

  // Webhook registration status
  webhooksRegistered?: boolean;
  webhooksRegisteredAt?: string; // ISO date string
  webhooksError?: string;

  // ============================================
  // Retailer-specific settings (for product export)
  // ============================================

  // Integration purpose: 'import' (supplier) or 'export' (retailer)
  purpose?: "import" | "export";

  // Whether product sync to this store is globally enabled
  exportEnabled?: boolean;

  // Default settings for new sync configurations
  defaultSyncInterval?: number; // hours
  defaultPriceAdjustment?: {
    type: "percentage" | "fixed";
    value: number;
  };
}

// ============================================
// Shopify Store Metadata Cache
// ============================================

/**
 * Caches metadata from Shopify stores (vendors, product types, tags)
 * for use in UI dropdowns. Refreshed periodically by a scheduled task.
 */
export const shopifyStoreMetadata = pgTable(
  "shopify_store_metadata",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("shopifyMeta")),

    // The Shopify integration this cache belongs to
    integrationId: text("integration_id")
      .notNull()
      .unique()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // Cached values extracted from products
    vendors: jsonb("vendors").$type<string[]>().default([]),
    productTypes: jsonb("product_types").$type<string[]>().default([]),
    tags: jsonb("tags").$type<string[]>().default([]),

    // Stats
    productCount: text("product_count"),

    // Cache freshness
    lastRefreshedAt: timestamp("last_refreshed_at"),
    refreshError: text("refresh_error"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("shopify_store_metadata_integration_idx").on(table.integrationId),
  ]
);

export type ShopifyStoreMetadata = typeof shopifyStoreMetadata.$inferSelect;
export type NewShopifyStoreMetadata = typeof shopifyStoreMetadata.$inferInsert;

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type SyncCursor = typeof syncCursors.$inferSelect;
export type NewSyncCursor = typeof syncCursors.$inferInsert;
