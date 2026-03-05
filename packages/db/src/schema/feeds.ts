import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  unique,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import {
  feedStatusEnum,
  feedTypeEnum,
  feedScheduleEnum,
  feedSyncStatusEnum,
} from "./enums";
import { idGenerator } from "../lib/typeid";

// ============================================
// Feeds (Community Library)
// ============================================

/**
 * Feeds are external product data sources in the Community Library.
 * They don't have an organization account - their products are
 * imported from XML/CSV feeds and managed by admins.
 */
export const feeds = pgTable(
  "feeds",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("feed")),

    // Basic info
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    website: text("website"),
    logoUrl: text("logo_url"),
    description: text("description"),

    // Ordering info (since orders happen externally)
    orderingUrl: text("ordering_url"), // URL to supplier's B2B portal
    orderingInstructions: text("ordering_instructions"), // How to place orders
    orderingEmail: text("ordering_email"), // Contact for orders
    orderingPhone: text("ordering_phone"),

    // Status
    status: feedStatusEnum("status").notNull().default("pending"),

    // Flexible metadata storage
    metadata: jsonb("metadata").$type<FeedMetadata>().default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("feeds_status_idx").on(table.status),
    index("feeds_slug_idx").on(table.slug),
  ]
);

// ============================================
// Feed Requests
// ============================================

/**
 * Tracks which retailers requested each feed.
 * Used for prioritization - feeds with more requests get added first.
 */
export const feedRequests = pgTable(
  "feed_requests",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("feedRequest")),

    // Can be null if this is a request for a NEW feed not yet in the system
    feedId: text("feed_id").references(() => feeds.id, { onDelete: "cascade" }),

    retailerId: text("retailer_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Request details
    supplierName: text("supplier_name"), // For new feed requests
    supplierWebsite: text("supplier_website"), // For new feed requests
    notes: text("notes"), // Retailer's notes about why they want this
    feedUrl: text("feed_url"), // URL they provided
    feedFileKey: text("feed_file_key"), // If they uploaded a sample file (R2 key)
    credentialsProvided: boolean("credentials_provided").default(false),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // A retailer can only request the same feed once
    unique("feed_requests_feed_retailer_unique").on(
      table.feedId,
      table.retailerId
    ),
    index("feed_requests_feed_idx").on(table.feedId),
    index("feed_requests_retailer_idx").on(table.retailerId),
  ]
);

// ============================================
// Feed Sources
// ============================================

/**
 * Source configuration for feeds.
 * Contains the feed URL, authentication, schedule, and field mapping.
 */
export const feedSources = pgTable(
  "feed_sources",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("feedSource")),

    feedId: text("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),

    // Feed source
    feedType: feedTypeEnum("feed_type").notNull(),
    feedUrl: text("feed_url"), // URL to fetch (if remote)
    feedFileKey: text("feed_file_key"), // R2 key (if uploaded)

    // Authentication
    requiresAuth: boolean("requires_auth").notNull().default(false), // Does retailer need to provide credentials to connect?
    credentialsRef: text("credentials_ref"), // KMS reference for OUR auth credentials (used for syncing)

    // Schedule
    schedule: feedScheduleEnum("schedule").notNull().default("daily"),

    // Mapping configuration
    mapping: jsonb("mapping").$type<FeedMapping>().notNull().default({}),

    // Sync tracking
    lastSyncAt: timestamp("last_sync_at"),
    lastSyncStatus: feedSyncStatusEnum("last_sync_status"),
    lastSyncError: text("last_sync_error"),
    lastSyncProductCount: integer("last_sync_product_count"),
    lastSyncDurationMs: integer("last_sync_duration_ms"),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("feed_sources_feed_idx").on(table.feedId),
    index("feed_sources_active_idx").on(table.isActive),
  ]
);

// ============================================
// Feed Sync Logs
// ============================================

/**
 * Detailed sync history for debugging and monitoring.
 */
export const feedSyncLogs = pgTable(
  "feed_sync_logs",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("feedSyncLog")),

    feedSourceId: text("feed_source_id")
      .notNull()
      .references(() => feedSources.id, { onDelete: "cascade" }),

    // Sync details
    status: feedSyncStatusEnum("status").notNull(),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),

    // Results
    productsProcessed: integer("products_processed").default(0),
    productsCreated: integer("products_created").default(0),
    productsUpdated: integer("products_updated").default(0),
    productsFailed: integer("products_failed").default(0),

    // Errors (array of error objects)
    errors: jsonb("errors").$type<FeedLogError[]>().default([]),

    // Trigger info
    triggeredBy: text("triggered_by"), // 'schedule', 'manual'
    triggeredByUserId: text("triggered_by_user_id"),
  },
  (table) => [
    index("feed_sync_logs_source_idx").on(table.feedSourceId),
    index("feed_sync_logs_started_idx").on(table.startedAt),
  ]
);

// ============================================
// Feed Subscriptions
// ============================================

/**
 * Tracks which retailers have subscribed to (activated) a feed.
 * Subscription requires verification (matching feed URL or valid credentials).
 */
export const feedSubscriptions = pgTable(
  "feed_subscriptions",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("feedSubscription")),

    feedId: text("feed_id")
      .notNull()
      .references(() => feeds.id, { onDelete: "cascade" }),

    retailerId: text("retailer_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Subscription status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    verifiedAt: timestamp("verified_at").defaultNow().notNull(), // When verification passed
    disconnectedAt: timestamp("disconnected_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("feed_subscriptions_feed_retailer_unique").on(
      table.feedId,
      table.retailerId
    ),
    index("feed_subscriptions_feed_idx").on(table.feedId),
    index("feed_subscriptions_retailer_idx").on(table.retailerId),
  ]
);

// ============================================
// TypeScript Types
// ============================================

export interface FeedMetadata {
  // Additional feed info
  brandNames?: string[]; // Brands this feed carries
  categories?: string[]; // Product categories
  region?: string; // Geographic region

  // Import tracking
  totalProducts?: number;
  lastFullSync?: string; // ISO date

  // Any other flexible data
  [key: string]: unknown;
}

export interface FeedMapping {
  // XML-specific: path to products array
  // e.g., "products.products_details" for <products><products_details>...</products_details></products>
  rootPath?: string;

  // Field mappings (key = our field, value = source field/path)
  fields?: {
    // Required
    sku?: string; // e.g., "code" or "erp_id"
    name?: string; // e.g., "title"
    price?: string; // e.g., "price"

    // Optional product fields
    description?: string; // e.g., "description" or "commercial"
    brand?: string; // e.g., "brand"
    productType?: string; // e.g., "categories" (first category)
    tags?: string; // e.g., "categories" (all categories)
    barcode?: string; // e.g., "barcode"

    // Pricing
    salePrice?: string; // Discounted/promo price - if lower than price, becomes the actual selling price
    compareAtPrice?: string;
    costPrice?: string;
    currency?: string; // e.g., "currency" - defaults to defaultCurrency

    // Inventory
    quantity?: string; // e.g., "stock_no"
    stockStatus?: string; // e.g., "stock" - for text like "in stoc"

    // Images
    images?: string; // Field containing image URL(s)
    additionalImages?: string; // Field containing additional image URL(s)
  };

  // Data transformations
  transforms?: FeedTransform[];

  // Parsing options
  options?: {
    // CSV options
    delimiter?: string; // default: ","
    encoding?: string; // default: "utf-8"
    skipRows?: number; // Skip header rows

    // Image handling
    imageDelimiter?: string; // If multiple images in one field
    imagesAreArray?: boolean; // For XML with multiple <image> elements

    // Category/tag handling
    tagDelimiter?: string; // e.g., ";" for "Cat1;Cat2;Cat3"
    productTypeDelimiter?: string; // e.g., ";" - use first segment as productType
    productTypePathSeparator?: string; // e.g., "/" - extract last segment from path like "Category/Subcategory"

    // Stock status mapping
    stockStatusMapping?: Record<string, number>; // e.g., { "in stoc": 100, "indisponibil": 0 }

    // Price parsing
    priceDecimalSeparator?: string; // "." or ","
    priceThousandSeparator?: string; // "," or "." or " "

    // Default values
    defaultCurrency?: string;
    defaultQuantity?: number;

    // Additional image fields
    additionalImageFields?: string[]; // e.g., ["image_1", "image_2", "image_3"]
  };
}

export interface FeedTransform {
  field: string; // Which field to transform
  type:
    | "regex_replace" // Replace with regex
    | "trim" // Trim whitespace
    | "lowercase"
    | "uppercase"
    | "strip_html" // Remove HTML tags
    | "decode_entities" // Decode HTML entities
    | "split_first" // Take first item after split
    | "split_all" // Convert to array after split
    | "prefix"
    | "suffix"
    | "number" // Parse as number
    | "default"; // Set default if empty
  params?: Record<string, string>;
}

export interface FeedCredentials {
  type: "none" | "basic" | "api_key" | "bearer" | "query_param";

  // Basic auth
  username?: string;
  password?: string;

  // API key / Bearer
  headerName?: string; // e.g., "X-API-Key" or "Authorization"
  headerValue?: string; // e.g., "abc123" or "Bearer xyz"

  // Query param auth
  paramName?: string;
  paramValue?: string;
}

export interface FeedLogError {
  row?: number; // Row number in feed (if applicable)
  sku?: string; // SKU of problematic product
  field?: string; // Field that caused error
  message: string; // Error message
  raw?: unknown; // Raw data that caused error (truncated)
}

// Inferred types
export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type FeedRequest = typeof feedRequests.$inferSelect;
export type NewFeedRequest = typeof feedRequests.$inferInsert;
export type FeedSource = typeof feedSources.$inferSelect;
export type NewFeedSource = typeof feedSources.$inferInsert;
export type FeedSyncLog = typeof feedSyncLogs.$inferSelect;
export type NewFeedSyncLog = typeof feedSyncLogs.$inferInsert;
export type FeedSubscription = typeof feedSubscriptions.$inferSelect;
export type NewFeedSubscription = typeof feedSubscriptions.$inferInsert;
