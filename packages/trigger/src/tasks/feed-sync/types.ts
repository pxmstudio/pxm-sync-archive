/**
 * Types for custom supplier feed sync
 */

import type { FeedMapping, FeedTransform, FeedLogError } from "@workspace/db";

// Re-export for convenience
export type { FeedMapping, FeedTransform, FeedLogError };

/**
 * Normalized product data structure from any feed format
 */
export interface ParsedProduct {
  sku: string;
  name: string;
  price: number;
  currency: string;
  description?: string;
  brand?: string;
  productType?: string;
  tags?: string[];
  barcode?: string;
  compareAtPrice?: number;
  costPrice?: number;
  quantity?: number;
  images?: string[];
}

/**
 * Result from parsing a feed
 */
export interface ParseResult {
  products: ParsedProduct[];
  errors: FeedLogError[];
  totalRows: number;
}

/**
 * Payload for the feed sync task
 */
export interface FeedSyncPayload {
  feedId: string;
  triggeredBy: "schedule" | "manual";
  triggeredByUserId?: string;
}

/**
 * Change types for incremental sync
 */
export type ChangeType = "new" | "full" | "price" | "inventory" | "none";

/**
 * Summary of changes detected during feed sync
 */
export interface ChangeSummary {
  /** Products that are new to the feed */
  new: string[];
  /** Products with core/image changes requiring full sync */
  full: string[];
  /** Products with only price/variant changes */
  price: string[];
  /** Products with only inventory changes */
  inventory: string[];
  /** Products with no changes */
  unchanged: number;
}

/**
 * Result from the feed sync task
 */
export interface FeedSyncResult {
  success: boolean;
  productsProcessed: number;
  productsCreated: number;
  productsUpdated: number;
  productsFailed: number;
  errors: FeedLogError[];
  durationMs: number;
  /** Summary of changes detected (for incremental sync) */
  changeSummary?: ChangeSummary;
}

/**
 * Feed credentials for authenticated feeds
 */
export interface FeedCredentials {
  type: "none" | "basic" | "api_key" | "bearer" | "query_param";
  username?: string;
  password?: string;
  headerName?: string;
  headerValue?: string;
  paramName?: string;
  paramValue?: string;
}
