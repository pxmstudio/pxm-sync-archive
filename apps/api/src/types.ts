import type { Context } from "hono";
import type { Database } from "@workspace/db";

// Cloudflare Workers environment bindings
export interface Env {
  // Database
  DATABASE_URL: string;

  // Cloudflare R2 Storage
  R2_DOCS: R2Bucket;

  // Auth (Clerk)
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_WEBHOOK_SECRET: string;

  // Studio API (admin monorepo)
  STUDIO_API_KEY: string;
  STUDIO_API_URL?: string;

  // Stripe (for Stripe Connect and payments - subscription management via platform)
  STRIPE_SECRET_KEY: string;
  STRIPE_CLIENT_ID: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_CONNECT_WEBHOOK_SECRET: string;
  // GCP KMS
  GCP_KMS_PROJECT_ID: string;
  GCP_KMS_LOCATION: string;
  GCP_KMS_KEY_RING: string;
  GCP_KMS_KEY: string;
  GCP_SERVICE_ACCOUNT_JSON: string;

  // Trigger.dev
  TRIGGER_SECRET_KEY: string;

  // App URLs
  APP_URL: string;
  SUPPLIER_APP_URL: string;
  RETAILER_APP_URL: string;
  API_URL: string;
  /** Optional: Override webhook callback base URL (defaults to API_URL if not set) */
  WEBHOOK_BASE_URL?: string;
}

// Organization role type
export type OrganizationRole = "supplier" | "retailer";

// Membership role within an organization
export type MembershipRole = "owner" | "admin" | "member";

// Auth context for internal API (Clerk authenticated)
export interface AuthContext {
  userId: string;
  organizationId: string;
  /** Clerk organization ID (for Studio API calls) */
  clerkOrgId: string;
  /** All roles the organization has (empty if pending role selection) */
  organizationRoles: OrganizationRole[];
  /** The currently active role for this request (null if no roles assigned yet) */
  activeRole: OrganizationRole | null;
  /** Membership role within the organization */
  membershipRole: MembershipRole;
}

// API key context for public API
export interface ApiKeyContext {
  apiKeyId: string;
  organizationId: string; // Retailer organization
  scopes: string[];
}

// Single feed context (when feedId is specified)
export interface SingleFeedContext {
  mode: "single";
  feedId: string;
  subscriptionId: string;
  /** @deprecated Alias for feedId - use feedId instead */
  supplierId: string;
  /** @deprecated Alias for subscriptionId - use subscriptionId instead */
  connectionId: string;
}

// Multi-feed context (when querying across all subscriptions)
export interface MultiFeedContext {
  mode: "multi";
  /** All active feed subscriptions for the organization */
  subscriptions: Array<{
    feedId: string;
    subscriptionId: string;
  }>;
  /** All feed IDs for quick filtering */
  feedIds: string[];
  /** @deprecated Alias for feedIds - use feedIds instead */
  supplierIds: string[];
  /** @deprecated Alias for subscriptions - use subscriptions instead */
  connections: Array<{
    supplierId: string;
    connectionId: string;
  }>;
}

// Feed context for public API queries - can be single or multi feed
export type FeedContext = SingleFeedContext | MultiFeedContext;

// Legacy supplier context types (for backwards compatibility during migration)
// TODO: Remove these after fully migrating to feed-based context
export type SingleSupplierContext = SingleFeedContext;
export type MultiSupplierContext = MultiFeedContext;
export type SupplierContext = FeedContext;

// Variables set by middleware
export interface Variables {
  db: Database;
  auth?: AuthContext;
  apiKey?: ApiKeyContext;
  feed?: FeedContext;
  /** @deprecated Use 'feed' instead */
  supplier?: SupplierContext;
  /** Raw Clerk JWT for forwarding to platform API */
  clerkToken?: string;
}

// Typed Hono context
export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

// API Error response
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// API Success response
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
