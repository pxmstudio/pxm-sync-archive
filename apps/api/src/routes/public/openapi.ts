import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { Env, Variables } from "../../types.js";

// Re-export for convenience
export { createRoute, z };

// Create OpenAPIHono app with proper typing
export function createOpenAPIApp() {
  return new OpenAPIHono<{ Bindings: Env; Variables: Variables }>();
}

// OpenAPI document configuration
export const openApiConfig = {
  openapi: "3.1.0" as const,
  info: {
    title: "PXM Sync API",
    version: "1.0.0",
    description: "Public API for retailer integrations with PXM Sync platform",
    contact: {
      name: "API Support",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1",
    },
  ],
  tags: [
    { name: "Products", description: "Product catalog operations" },
    { name: "Catalog", description: "Full catalog export in XML/CSV format" },
    { name: "Inventory", description: "Inventory tracking" },
    { name: "Facets", description: "Product filtering facets" },
    { name: "Webhooks", description: "Webhook subscription management" },
  ],
};

// Security scheme for Bearer authentication
export const securitySchemes = {
  bearerAuth: {
    type: "http" as const,
    scheme: "bearer",
    bearerFormat: "API Key",
    description: "API key in format: pxm_live_xxx (production) or pxm_test_xxx (sandbox)",
  },
};

// Common response schemas
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().openapi({ example: "NOT_FOUND" }),
    message: z.string().openapi({ example: "Resource not found" }),
    details: z.record(z.unknown()).optional(),
  }),
}).openapi("ApiError");

export const paginationMetaSchema = z.object({
  page: z.number().int().openapi({ example: 1 }),
  limit: z.number().int().openapi({ example: 20 }),
  total: z.number().int().openapi({ example: 100 }),
  totalPages: z.number().int().openapi({ example: 5 }),
}).openapi("PaginationMeta");

// Helper to create paginated response schema
export function createPaginatedResponse<T extends z.ZodTypeAny>(itemSchema: T, refName: string) {
  return z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(itemSchema),
      pagination: paginationMetaSchema,
    }),
  }).openapi(refName);
}

// Helper to create success response schema
export function createSuccessResponse<T extends z.ZodTypeAny>(dataSchema: T, refName: string) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  }).openapi(refName);
}

// Common error responses for routes
export const commonErrorResponses = {
  401: {
    description: "Unauthorized - Invalid or missing API key",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
  403: {
    description: "Forbidden - Insufficient permissions",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
  404: {
    description: "Not found",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
  400: {
    description: "Bad request - Validation error",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
  500: {
    description: "Internal server error",
    content: {
      "application/json": {
        schema: apiErrorSchema,
      },
    },
  },
} as const;

// Optional supplierId query parameter schema
// When provided, scopes request to a specific supplier
// When omitted, returns data from all connected suppliers
export const optionalSupplierIdParam = z.object({
  supplierId: z.string().optional().openapi({
    description: "Supplier organization ID to scope the request. If omitted, returns data from all connected suppliers.",
    example: "org_01234567890abcdefghijklmno",
  }),
});

// Required supplierId query parameter schema (for detail endpoints)
export const requiredSupplierIdParam = z.object({
  supplierId: z.string().openapi({
    description: "Supplier organization ID (required for this endpoint)",
    example: "org_01234567890abcdefghijklmno",
  }),
});

// @deprecated - kept for backwards compatibility, use supplierId query param instead
export const supplierIdHeader = z.object({
  "x-supplier-id": z.string().optional().openapi({
    description: "DEPRECATED: Use supplierId query parameter instead. Supplier organization ID to scope the request.",
    example: "org_01234567890abcdefghijklmno",
    deprecated: true,
  }),
});
