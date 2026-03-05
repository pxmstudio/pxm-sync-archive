import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiError } from "../types.js";

// Custom API error class
export class ApiException extends HTTPException {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    status: ContentfulStatusCode,
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(status, { message });
    this.code = code;
    this.details = details;
  }

  toJSON(): ApiError {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// Common errors
export const Errors = {
  // Auth errors
  unauthorized: (message = "Authentication required") =>
    new ApiException(401, "UNAUTHORIZED", message),

  forbidden: (message = "Access denied", details?: Record<string, unknown>) =>
    new ApiException(403, "FORBIDDEN", message, details),

  invalidApiKey: () =>
    new ApiException(401, "INVALID_API_KEY", "Invalid or expired API key"),

  insufficientScopes: (required: string[]) =>
    new ApiException(403, "INSUFFICIENT_SCOPES", "Missing required scopes", {
      required,
    }),

  // Subscription/feature gating errors
  apiAccessRequired: () =>
    new ApiException(
      403,
      "API_ACCESS_REQUIRED",
      "API access requires Growth or Scale plan. Please upgrade your subscription."
    ),

  subscriptionRequired: () =>
    new ApiException(
      403,
      "SUBSCRIPTION_REQUIRED",
      "Active subscription required to access this resource"
    ),

  // Resource errors
  notFound: (resource: string) =>
    new ApiException(404, "NOT_FOUND", `${resource} not found`),

  alreadyExists: (resource: string) =>
    new ApiException(409, "ALREADY_EXISTS", `${resource} already exists`),

  // Validation errors
  validation: (details: Record<string, unknown>) =>
    new ApiException(400, "VALIDATION_ERROR", "Validation failed", details),

  badRequest: (message: string) =>
    new ApiException(400, "BAD_REQUEST", message),

  // Connection errors
  connectionRequired: () =>
    new ApiException(
      400,
      "CONNECTION_REQUIRED",
      "Active connection to supplier required"
    ),

  noActiveConnections: () =>
    new ApiException(
      400,
      "NO_ACTIVE_CONNECTIONS",
      "No active supplier connections found"
    ),

  supplierIdRequired: () =>
    new ApiException(
      400,
      "SUPPLIER_ID_REQUIRED",
      "supplierId query parameter is required for this endpoint"
    ),

  // Rate limiting
  rateLimited: () =>
    new ApiException(429, "RATE_LIMITED", "Too many requests"),

  // Server errors
  internal: (message = "Internal server error") =>
    new ApiException(500, "INTERNAL_ERROR", message),
};
