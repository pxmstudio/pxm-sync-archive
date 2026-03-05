import { z } from "zod";
import { apiKeyId, organizationId } from "./common.js";

// ============================================
// API Scopes
// ============================================

export const apiScopes = z.enum([
  "products:read",
  "catalog:read",
  "inventory:read",
  "orders:read",
  "orders:write",
  "connections:read",
  "webhooks:read",
  "webhooks:write",
]);

export type ApiScope = z.infer<typeof apiScopes>;

// Scope descriptions for UI
export const API_SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "products:read": "Read product catalog (JSON API)",
  "catalog:read": "Read full catalog in XML/CSV format",
  "inventory:read": "Read inventory levels",
  "orders:read": "Read orders",
  "orders:write": "Create and update orders",
  "connections:read": "Read connection details",
  "webhooks:read": "Read webhook subscriptions",
  "webhooks:write": "Manage webhook subscriptions",
};

// ============================================
// Create API Key
// ============================================

export const createApiKey = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(apiScopes).min(1),
  expiresAt: z.coerce.date().optional(), // null = never expires
});

export type CreateApiKey = z.infer<typeof createApiKey>;

// ============================================
// API Key Response (without the actual key)
// ============================================

export const apiKey = z.object({
  id: apiKeyId,
  organizationId: organizationId,
  name: z.string(),
  prefix: z.string(), // e.g., "pxm_live_abc1"
  scopes: z.array(apiScopes),
  lastUsedAt: z.coerce.date().nullable(),
  lastUsedIp: z.string().nullable(),
  expiresAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  revokedAt: z.coerce.date().nullable(),
});

export type ApiKey = z.infer<typeof apiKey>;

// Response when creating a key (includes the full key, shown only once)
export const apiKeyCreated = apiKey.extend({
  key: z.string(), // Full key, only returned on creation
});

export type ApiKeyCreated = z.infer<typeof apiKeyCreated>;

// ============================================
// Update API Key
// ============================================

export const updateApiKey = z.object({
  name: z.string().min(1).max(255).optional(),
  scopes: z.array(apiScopes).min(1).optional(),
});

export type UpdateApiKey = z.infer<typeof updateApiKey>;

// ============================================
// Revoke API Key
// ============================================

export const revokeApiKey = z.object({
  reason: z.string().max(500).optional(),
});

export type RevokeApiKey = z.infer<typeof revokeApiKey>;

// ============================================
// API Key List Filters
// ============================================

export const apiKeyFilters = z.object({
  includeRevoked: z.coerce.boolean().default(false),
});

export type ApiKeyFilters = z.infer<typeof apiKeyFilters>;
