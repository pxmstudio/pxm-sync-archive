import { z } from "zod";
import {
  uuid,
  paginationParams,
  cursorPaginationParams,
  paginationMeta,
  cursorPaginationMeta,
  apiSuccess,
  apiError,
  paginatedResponse,
  eventType,
} from "../common.js";
import { product, productWithVariants, productFilters } from "../products.js";
import { inventoryItem, inventoryFilters } from "../inventory.js";
import { connection } from "../connections.js";

// ============================================
// Public API - Request Headers
// ============================================

export const publicApiHeaders = z.object({
  authorization: z.string().regex(/^Bearer\s+pxm_(live|test)_[a-zA-Z0-9]+$/),
  "x-supplier-id": uuid.optional(),
});

export type PublicApiHeaders = z.infer<typeof publicApiHeaders>;

// ============================================
// Public API - Products
// ============================================

// GET /v1/products
export const listProductsRequest = productFilters.merge(cursorPaginationParams);
export type ListProductsRequest = z.infer<typeof listProductsRequest>;

export const listProductsResponse = z.object({
  success: z.literal(true),
  data: z.array(product),
  meta: cursorPaginationMeta,
});
export type ListProductsResponse = z.infer<typeof listProductsResponse>;

// GET /v1/products/:id
export const getProductResponse = apiSuccess(productWithVariants);
export type GetProductResponse = z.infer<typeof getProductResponse>;

// ============================================
// Public API - Inventory
// ============================================

// GET /v1/inventory
export const listInventoryRequest = inventoryFilters.merge(paginationParams);
export type ListInventoryRequest = z.infer<typeof listInventoryRequest>;

export const listInventoryResponse = paginatedResponse(inventoryItem);
export type ListInventoryResponse = z.infer<typeof listInventoryResponse>;

// GET /v1/inventory/:variantId
export const getInventoryResponse = apiSuccess(inventoryItem);
export type GetInventoryResponse = z.infer<typeof getInventoryResponse>;

// ============================================
// Public API - Connections
// ============================================

// GET /v1/connections
export const listConnectionsResponse = apiSuccess(
  z.array(
    connection.pick({
      id: true,
      supplierId: true,
      status: true,
      createdAt: true,
    }).extend({
      supplier: z.object({
        id: uuid,
        name: z.string(),
        slug: z.string(),
        logoUrl: z.string().nullable(),
      }),
    })
  )
);
export type ListConnectionsResponse = z.infer<typeof listConnectionsResponse>;

// GET /v1/connections/:id
export const getConnectionResponse = apiSuccess(connection);
export type GetConnectionResponse = z.infer<typeof getConnectionResponse>;

// ============================================
// Public API - Webhooks
// ============================================

// POST /v1/webhooks
export const createWebhookRequest = z.object({
  url: z.string().url().max(2048),
  events: z.array(eventType).min(1),
  secret: z.string().min(16).max(255).optional(), // Optional, we can generate one
});
export type CreateWebhookRequest = z.infer<typeof createWebhookRequest>;

export const webhookResponse = z.object({
  id: uuid,
  url: z.string(),
  events: z.array(eventType),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
});

export const createWebhookResponse = apiSuccess(
  webhookResponse.extend({
    secret: z.string(), // Only returned on creation
  })
);
export type CreateWebhookResponse = z.infer<typeof createWebhookResponse>;

// GET /v1/webhooks
export const listWebhooksResponse = apiSuccess(z.array(webhookResponse));
export type ListWebhooksResponse = z.infer<typeof listWebhooksResponse>;

// DELETE /v1/webhooks/:id
export const deleteWebhookResponse = apiSuccess(z.object({ deleted: z.literal(true) }));
export type DeleteWebhookResponse = z.infer<typeof deleteWebhookResponse>;

// ============================================
// Public API - Error Responses
// ============================================

export { apiError };
export type ApiError = z.infer<typeof apiError>;

// Common error codes
export const API_ERROR_CODES = {
  // Authentication
  UNAUTHORIZED: "unauthorized",
  INVALID_API_KEY: "invalid_api_key",
  EXPIRED_API_KEY: "expired_api_key",
  INSUFFICIENT_SCOPE: "insufficient_scope",

  // Request
  BAD_REQUEST: "bad_request",
  VALIDATION_ERROR: "validation_error",
  NOT_FOUND: "not_found",
  CONFLICT: "conflict",

  // Business logic
  SUPPLIER_NOT_FOUND: "supplier_not_found",
  CONNECTION_NOT_ACTIVE: "connection_not_active",
  INSUFFICIENT_INVENTORY: "insufficient_inventory",
  PRODUCT_NOT_AVAILABLE: "product_not_available",

  // Rate limiting
  RATE_LIMITED: "rate_limited",

  // Server
  INTERNAL_ERROR: "internal_error",
  SERVICE_UNAVAILABLE: "service_unavailable",
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// ============================================
// Webhook Payload Schemas (outgoing to retailers)
// ============================================

export const inventoryUpdatedPayload = z.object({
  variantId: uuid,
  sku: z.string().nullable(),
  productId: uuid,
  productName: z.string(),
  previousQuantity: z.number().int(),
  newQuantity: z.number().int(),
  available: z.number().int(),
});

export const productUpdatedPayload = z.object({
  productId: uuid,
  action: z.enum(["created", "updated", "deleted"]),
  product: product.nullable(), // null if deleted
});

export type InventoryUpdatedPayload = z.infer<typeof inventoryUpdatedPayload>;
export type ProductUpdatedPayload = z.infer<typeof productUpdatedPayload>;
