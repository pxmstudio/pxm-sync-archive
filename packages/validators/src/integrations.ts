import { z } from "zod";
import {
  integrationId,
  organizationId,
  url,
  integrationProvider,
} from "./common.js";

// ============================================
// Integration Settings
// ============================================

export const integrationSettings = z.object({
  // Shopify-specific
  shopifyApiVersion: z.string().optional(),
  shopifyLocationIds: z.array(z.string()).optional(),

  // Custom API-specific
  baseUrl: url.optional(),
  authType: z.enum(["api_key", "oauth", "basic"]).optional(),

  // Sync settings
  syncInterval: z.number().int().min(1).max(1440).optional(), // minutes (max 24h)
  syncProducts: z.boolean().optional(),
  syncInventory: z.boolean().optional(),
  syncOrders: z.boolean().optional(),

  // Webhook topics to subscribe to
  webhookTopics: z.array(z.string()).optional(),
});

export type IntegrationSettings = z.infer<typeof integrationSettings>;

// ============================================
// Connect Shopify
// ============================================

export const connectShopify = z.object({
  shopDomain: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/, {
      message: "Invalid Shopify domain format",
    }),
  // Access token will be obtained via OAuth flow
});

export type ConnectShopify = z.infer<typeof connectShopify>;

// Shopify OAuth callback
export const shopifyOAuthCallback = z.object({
  code: z.string(),
  shop: z.string(),
  state: z.string(),
  hmac: z.string(),
});

export type ShopifyOAuthCallback = z.infer<typeof shopifyOAuthCallback>;

// ============================================
// Connect Custom API
// ============================================

export const connectCustomApi = z.object({
  name: z.string().min(1).max(255),
  baseUrl: url,
  authType: z.enum(["api_key", "oauth", "basic"]),

  // Credentials (will be encrypted)
  apiKey: z.string().max(500).optional(),
  clientId: z.string().max(255).optional(),
  clientSecret: z.string().max(500).optional(),
  username: z.string().max(255).optional(),
  password: z.string().max(500).optional(),

  // Settings
  settings: integrationSettings.optional(),
});

export type ConnectCustomApi = z.infer<typeof connectCustomApi>;

// ============================================
// Update Integration
// ============================================

export const updateIntegration = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: integrationSettings.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateIntegration = z.infer<typeof updateIntegration>;

// ============================================
// Integration Response
// ============================================

export const integration = z.object({
  id: integrationId,
  organizationId: organizationId,
  provider: integrationProvider,
  name: z.string(),
  externalIdentifier: z.string().nullable(), // e.g., shop domain
  scopes: z.array(z.string()),
  settings: integrationSettings.nullable(),
  lastSyncAt: z.coerce.date().nullable(),
  lastSyncError: z.string().nullable(),
  isActive: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Integration = z.infer<typeof integration>;

// ============================================
// Sync Operations
// ============================================

export const triggerSync = z.object({
  integrationId: integrationId,
  syncType: z.enum(["full", "incremental"]),
  resources: z.array(z.enum(["products", "inventory", "orders"])).optional(),
});

export type TriggerSync = z.infer<typeof triggerSync>;

export const syncStatus = z.object({
  integrationId: integrationId,
  status: z.enum(["idle", "syncing", "completed", "failed"]),
  progress: z.number().min(0).max(100).optional(),
  lastSyncAt: z.coerce.date().nullable(),
  lastSyncError: z.string().nullable(),
  stats: z
    .object({
      productsProcessed: z.number().int().optional(),
      variantsProcessed: z.number().int().optional(),
      inventoryUpdates: z.number().int().optional(),
      errors: z.number().int().optional(),
    })
    .optional(),
});

export type SyncStatus = z.infer<typeof syncStatus>;

// ============================================
// Webhook Verification
// ============================================

export const shopifyWebhook = z.object({
  topic: z.string(),
  shop: z.string(),
  payload: z.record(z.unknown()),
});

export type ShopifyWebhook = z.infer<typeof shopifyWebhook>;
