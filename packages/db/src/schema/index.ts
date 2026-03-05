import { relations } from "drizzle-orm";

// Export all enums
export * from "./enums";

// Export all tables and types
export * from "./organizations";
export * from "./users";
export * from "./products";
export * from "./collections";
export * from "./inventory";
export * from "./connections";
export * from "./integrations";
export * from "./api-keys";
export * from "./events";
export * from "./files";
export * from "./organization-addresses";
export * from "./sync-settings";
export * from "./feeds";
export * from "./field-mappings";

// Import tables for relations
import { organizations } from "./organizations";
import { users } from "./users";
import { products, variants, brands, productTags, productTypes } from "./products";
import { collections, collectionProducts } from "./collections";
import { inventory } from "./inventory";
import { connections } from "./connections";
import { integrations, syncCursors } from "./integrations";
import { apiKeys } from "./api-keys";
import { events, webhookSubscriptions, webhookLogs, processedWebhookEvents } from "./events";
import { uploadedFiles } from "./files";
import { organizationAddresses } from "./organization-addresses";
import {
  connectionSyncSettings,
  syncedProducts,
  feedSubscriptionSyncSettings,
  feedSyncedProducts,
  storeSyncRuns,
} from "./sync-settings";
import {
  feeds,
  feedRequests,
  feedSources,
  feedSyncLogs,
  feedSubscriptions,
} from "./feeds";
import { retailerFieldMappings } from "./field-mappings";

// ============================================
// Relations
// ============================================

// Organization relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  // As supplier
  products: many(products),
  collections: many(collections),
  brands: many(brands),
  productTags: many(productTags),
  productTypes: many(productTypes),
  supplierConnections: many(connections, { relationName: "supplierConnections" }),
  integrations: many(integrations),
  // As retailer
  retailerConnections: many(connections, { relationName: "retailerConnections" }),
  apiKeys: many(apiKeys),
  webhookSubscriptions: many(webhookSubscriptions),
  // Shared
  addresses: many(organizationAddresses),
  uploadedFiles: many(uploadedFiles),
  // Events
  events: many(events),
  // Feed requests and subscriptions (as retailer)
  feedRequests: many(feedRequests),
  feedSubscriptions: many(feedSubscriptions),
}));

// User relations - currently no relations, but kept for future use
export const usersRelations = relations(users, () => ({}));

// Product relations
export const productsRelations = relations(products, ({ one, many }) => ({
  supplier: one(organizations, {
    fields: [products.supplierId],
    references: [organizations.id],
  }),
  feed: one(feeds, {
    fields: [products.feedId],
    references: [feeds.id],
  }),
  variants: many(variants),
  collectionProducts: many(collectionProducts),
}));

// Collection relations
export const collectionsRelations = relations(collections, ({ one, many }) => ({
  supplier: one(organizations, {
    fields: [collections.supplierId],
    references: [organizations.id],
  }),
  collectionProducts: many(collectionProducts),
}));

// Collection-Product junction relations
export const collectionProductsRelations = relations(collectionProducts, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionProducts.collectionId],
    references: [collections.id],
  }),
  product: one(products, {
    fields: [collectionProducts.productId],
    references: [products.id],
  }),
}));

// Variant relations
export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  inventory: one(inventory, {
    fields: [variants.id],
    references: [inventory.variantId],
  }),
}));

// Brand relations
export const brandsRelations = relations(brands, ({ one }) => ({
  supplier: one(organizations, {
    fields: [brands.supplierId],
    references: [organizations.id],
  }),
}));

// Product tag relations
export const productTagsRelations = relations(productTags, ({ one }) => ({
  supplier: one(organizations, {
    fields: [productTags.supplierId],
    references: [organizations.id],
  }),
}));

// Product type relations
export const productTypesRelations = relations(productTypes, ({ one }) => ({
  supplier: one(organizations, {
    fields: [productTypes.supplierId],
    references: [organizations.id],
  }),
}));

// Inventory relations
export const inventoryRelations = relations(inventory, ({ one }) => ({
  variant: one(variants, {
    fields: [inventory.variantId],
    references: [variants.id],
  }),
}));

// Connection relations
export const connectionsRelations = relations(connections, ({ one, many }) => ({
  supplier: one(organizations, {
    fields: [connections.supplierId],
    references: [organizations.id],
    relationName: "supplierConnections",
  }),
  retailer: one(organizations, {
    fields: [connections.retailerId],
    references: [organizations.id],
    relationName: "retailerConnections",
  }),
  syncSettings: many(connectionSyncSettings),
}));

// Integration relations
export const integrationsRelations = relations(integrations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [integrations.organizationId],
    references: [organizations.id],
  }),
  syncCursors: many(syncCursors),
  connectionSyncSettings: many(connectionSyncSettings),
  feedSubscriptionSyncSettings: many(feedSubscriptionSyncSettings),
}));

// Sync cursor relations
export const syncCursorsRelations = relations(syncCursors, ({ one }) => ({
  integration: one(integrations, {
    fields: [syncCursors.integrationId],
    references: [integrations.id],
  }),
}));

// API key relations
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
}));

// Event relations
export const eventsRelations = relations(events, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [events.organizationId],
    references: [organizations.id],
  }),
  webhookLogs: many(webhookLogs),
}));

// Webhook subscription relations
export const webhookSubscriptionsRelations = relations(
  webhookSubscriptions,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [webhookSubscriptions.organizationId],
      references: [organizations.id],
    }),
    logs: many(webhookLogs),
  })
);

// Webhook log relations
export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  subscription: one(webhookSubscriptions, {
    fields: [webhookLogs.subscriptionId],
    references: [webhookSubscriptions.id],
  }),
  event: one(events, {
    fields: [webhookLogs.eventId],
    references: [events.id],
  }),
}));

// Uploaded files relations
export const uploadedFilesRelations = relations(uploadedFiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [uploadedFiles.organizationId],
    references: [organizations.id],
  }),
  uploader: one(users, {
    fields: [uploadedFiles.uploadedBy],
    references: [users.id],
  }),
}));

// Organization addresses relations
export const organizationAddressesRelations = relations(
  organizationAddresses,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationAddresses.organizationId],
      references: [organizations.id],
    }),
  })
);

// ============================================
// Sync Settings Relations (Retailer Product Sync)
// ============================================

// Connection sync settings relations
export const connectionSyncSettingsRelations = relations(
  connectionSyncSettings,
  ({ one, many }) => ({
    connection: one(connections, {
      fields: [connectionSyncSettings.connectionId],
      references: [connections.id],
    }),
    integration: one(integrations, {
      fields: [connectionSyncSettings.integrationId],
      references: [integrations.id],
    }),
    syncedProducts: many(syncedProducts),
  })
);

// Synced products relations
export const syncedProductsRelations = relations(syncedProducts, ({ one }) => ({
  syncSettings: one(connectionSyncSettings, {
    fields: [syncedProducts.syncSettingsId],
    references: [connectionSyncSettings.id],
  }),
  sourceProduct: one(products, {
    fields: [syncedProducts.sourceProductId],
    references: [products.id],
  }),
  sourceVariant: one(variants, {
    fields: [syncedProducts.sourceVariantId],
    references: [variants.id],
  }),
}));

// ============================================
// Feeds Relations (Community Library)
// ============================================

// Feed relations
export const feedsRelations = relations(feeds, ({ many }) => ({
  products: many(products),
  requests: many(feedRequests),
  sources: many(feedSources),
  subscriptions: many(feedSubscriptions),
}));

// Feed request relations
export const feedRequestsRelations = relations(feedRequests, ({ one }) => ({
  feed: one(feeds, {
    fields: [feedRequests.feedId],
    references: [feeds.id],
  }),
  retailer: one(organizations, {
    fields: [feedRequests.retailerId],
    references: [organizations.id],
  }),
}));

// Feed source relations
export const feedSourcesRelations = relations(feedSources, ({ one, many }) => ({
  feed: one(feeds, {
    fields: [feedSources.feedId],
    references: [feeds.id],
  }),
  logs: many(feedSyncLogs),
}));

// Feed sync log relations
export const feedSyncLogsRelations = relations(feedSyncLogs, ({ one }) => ({
  feedSource: one(feedSources, {
    fields: [feedSyncLogs.feedSourceId],
    references: [feedSources.id],
  }),
}));

// Feed subscription relations
export const feedSubscriptionsRelations = relations(
  feedSubscriptions,
  ({ one, many }) => ({
    feed: one(feeds, {
      fields: [feedSubscriptions.feedId],
      references: [feeds.id],
    }),
    retailer: one(organizations, {
      fields: [feedSubscriptions.retailerId],
      references: [organizations.id],
    }),
    syncSettings: many(feedSubscriptionSyncSettings),
  })
);

// ============================================
// Feed Subscription Sync Settings Relations
// ============================================

// Feed subscription sync settings relations
export const feedSubscriptionSyncSettingsRelations = relations(
  feedSubscriptionSyncSettings,
  ({ one, many }) => ({
    subscription: one(feedSubscriptions, {
      fields: [feedSubscriptionSyncSettings.subscriptionId],
      references: [feedSubscriptions.id],
    }),
    integration: one(integrations, {
      fields: [feedSubscriptionSyncSettings.integrationId],
      references: [integrations.id],
    }),
    syncedProducts: many(feedSyncedProducts),
    syncRuns: many(storeSyncRuns),
  })
);

// Feed synced products relations
export const feedSyncedProductsRelations = relations(feedSyncedProducts, ({ one }) => ({
  syncSettings: one(feedSubscriptionSyncSettings, {
    fields: [feedSyncedProducts.syncSettingsId],
    references: [feedSubscriptionSyncSettings.id],
  }),
  sourceProduct: one(products, {
    fields: [feedSyncedProducts.sourceProductId],
    references: [products.id],
  }),
  sourceVariant: one(variants, {
    fields: [feedSyncedProducts.sourceVariantId],
    references: [variants.id],
  }),
}));

// ============================================
// Field Mappings Relations (Retailer Sync Configuration)
// ============================================

// Retailer field mappings relations
export const retailerFieldMappingsRelations = relations(
  retailerFieldMappings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [retailerFieldMappings.organizationId],
      references: [organizations.id],
    }),
    integration: one(integrations, {
      fields: [retailerFieldMappings.integrationId],
      references: [integrations.id],
    }),
  })
);

// ============================================
// Store Sync Runs Relations (Activity Log)
// ============================================

// Store sync runs relations
export const storeSyncRunsRelations = relations(storeSyncRuns, ({ one }) => ({
  syncSettings: one(feedSubscriptionSyncSettings, {
    fields: [storeSyncRuns.syncSettingsId],
    references: [feedSubscriptionSyncSettings.id],
  }),
  subscription: one(feedSubscriptions, {
    fields: [storeSyncRuns.subscriptionId],
    references: [feedSubscriptions.id],
  }),
  integration: one(integrations, {
    fields: [storeSyncRuns.integrationId],
    references: [integrations.id],
  }),
  feed: one(feeds, {
    fields: [storeSyncRuns.feedId],
    references: [feeds.id],
  }),
}));
