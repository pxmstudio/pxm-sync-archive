import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { idGenerator } from "../lib/typeid";

// API keys for retailers to access the public API
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("apiKey")),

    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Key identification
    name: text("name").notNull(), // e.g., "Production Key", "Development Key"
    prefix: text("prefix").notNull(), // e.g., "pxm_live_abc123" - first chars for identification

    // Hashed key (we never store the full key)
    keyHash: text("key_hash").notNull().unique(),

    // Scopes/permissions
    scopes: text("scopes").array().default([]),

    // Usage tracking
    lastUsedAt: timestamp("last_used_at"),
    lastUsedIp: text("last_used_ip"),

    // Expiration (null = never expires)
    expiresAt: timestamp("expires_at"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    index("api_keys_org_idx").on(table.organizationId),
    index("api_keys_prefix_idx").on(table.prefix),
    index("api_keys_hash_idx").on(table.keyHash),
  ]
);

// Available API scopes
export const API_SCOPES = {
  // Product access
  "products:read": "Read product catalog",

  // Catalog export (XML/CSV format for non-pro retailers)
  "catalog:read": "Read full product catalog in XML/CSV format",

  // Inventory access
  "inventory:read": "Read inventory levels",

  // Order management
  "orders:read": "Read orders",
  "orders:write": "Create and update orders",

  // Connection info
  "connections:read": "Read connection details",

  // Webhooks
  "webhooks:read": "Read webhook subscriptions",
  "webhooks:write": "Manage webhook subscriptions",
} as const;

export type ApiScope = keyof typeof API_SCOPES;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
