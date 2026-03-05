import { pgEnum } from "drizzle-orm/pg-core";

/**
 * @deprecated Use `roles` array on organizations table instead.
 * This enum is kept for migration purposes only.
 * Organizations can now have multiple roles (supplier AND/OR retailer).
 */
export const organizationTypeEnum = pgEnum("organization_type", [
  "supplier",
  "retailer",
]);

// Connection status between supplier and retailer
export const connectionStatusEnum = pgEnum("connection_status", [
  "pending",
  "active",
  "suspended",
  "terminated",
]);

// E-commerce integration provider
export const integrationProviderEnum = pgEnum("integration_provider", [
  "shopify",
  "custom",
]);

// Event types for the event log
export const eventTypeEnum = pgEnum("event_type", [
  "product.created",
  "product.updated",
  "product.deleted",
]);

// Membership roles
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "member",
]);

// Organization address types
export const addressTypeEnum = pgEnum("address_type", [
  "billing",
  "shipping",
  "warehouse",
  "store",
  "headquarters",
  "fulfillment_center",
  "return",
]);

// Sync product status (for retailer product sync)
export const syncProductStatusEnum = pgEnum("sync_product_status", [
  "pending",
  "synced",
  "failed",
  "deleted",
]);

// ============================================
// Feeds (Community Library)
// ============================================

// Feed status
export const feedStatusEnum = pgEnum("feed_status", [
  "pending", // Awaiting admin review
  "mapping", // Approved, needs feed mapping
  "active", // Feed mapped and syncing
  "paused", // Temporarily disabled
  "deprecated", // No longer maintained
]);

// Feed type for custom supplier feeds
export const feedTypeEnum = pgEnum("feed_type", ["xml", "csv", "json"]);

// Feed sync schedule
export const feedScheduleEnum = pgEnum("feed_schedule", [
  "hourly",
  "daily",
  "weekly",
  "manual",
]);

// Feed sync status
export const feedSyncStatusEnum = pgEnum("feed_sync_status", [
  "pending",
  "running",
  "success",
  "failed",
]);

// Store sync run status (for pushing products to Shopify)
export const storeSyncRunStatusEnum = pgEnum("store_sync_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "partial", // Some products synced, some failed
]);
