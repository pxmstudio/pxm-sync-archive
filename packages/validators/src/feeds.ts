import { z } from "zod";
import {
  feedId,
  feedRequestId,
  feedSourceId,
  feedSubscriptionId,
  organizationId,
  slug,
  url,
  email,
  phone,
  feedStatus,
  feedType,
  feedSchedule,
  feedSyncStatus,
  paginationParams,
} from "./common.js";

// ============================================
// Feed
// ============================================

export const createFeed = z.object({
  name: z.string().min(1).max(255),
  slug: slug,
  website: url.optional(),
  logoUrl: url.optional(),
  description: z.string().max(5000).optional(),
  orderingUrl: url.optional(),
  orderingInstructions: z.string().max(2000).optional(),
  orderingEmail: email.optional(),
  orderingPhone: phone,
  status: feedStatus.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateFeed = z.infer<typeof createFeed>;

export const updateFeed = createFeed.partial();

export type UpdateFeed = z.infer<typeof updateFeed>;

export const feed = z.object({
  id: feedId,
  name: z.string(),
  slug: z.string(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  description: z.string().nullable(),
  orderingUrl: z.string().nullable(),
  orderingInstructions: z.string().nullable(),
  orderingEmail: z.string().nullable(),
  orderingPhone: z.string().nullable(),
  status: feedStatus,
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Feed = z.infer<typeof feed>;

// Feed with counts for list view
export const feedWithCounts = feed.extend({
  requestCount: z.number(),
  subscriptionCount: z.number(),
  productCount: z.number(),
});

export type FeedWithCounts = z.infer<typeof feedWithCounts>;

// ============================================
// Feed Request
// ============================================

// For requesting a NEW feed (not yet in system)
export const requestNewFeed = z.object({
  supplierName: z.string().min(1).max(255),
  supplierWebsite: url.optional(),
  feedUrl: url.optional(),
  notes: z.string().max(2000).optional(),
  credentialsProvided: z.boolean().optional(),
});

export type RequestNewFeed = z.infer<typeof requestNewFeed>;

// For requesting access to an EXISTING feed
export const requestExistingFeed = z.object({
  feedId: feedId,
  notes: z.string().max(2000).optional(),
  feedUrl: url.optional(),
  credentialsProvided: z.boolean().optional(),
});

export type RequestExistingFeed = z.infer<typeof requestExistingFeed>;

export const feedRequest = z.object({
  id: feedRequestId,
  feedId: feedId.nullable(),
  retailerId: organizationId,
  supplierName: z.string().nullable(),
  supplierWebsite: z.string().nullable(),
  notes: z.string().nullable(),
  feedUrl: z.string().nullable(),
  feedFileKey: z.string().nullable(),
  credentialsProvided: z.boolean().nullable(),
  createdAt: z.coerce.date(),
});

export type FeedRequest = z.infer<typeof feedRequest>;

// Request with retailer info for admin view
export const feedRequestWithRetailer = feedRequest.extend({
  retailer: z.object({
    id: organizationId,
    name: z.string(),
    slug: z.string(),
    logoUrl: z.string().nullable(),
  }),
});

export type FeedRequestWithRetailer = z.infer<typeof feedRequestWithRetailer>;

// ============================================
// Feed Subscription (Verification)
// ============================================

// Verification request for PUBLIC feeds (no auth required)
export const verifyPublicFeed = z.object({
  feedUrl: url,
});

export type VerifyPublicFeed = z.infer<typeof verifyPublicFeed>;

// Feed credentials for authenticated feeds
export const feedCredentials = z.object({
  type: z.enum(["none", "basic", "api_key", "bearer", "query_param"]),
  // Basic auth
  username: z.string().max(255).optional(),
  password: z.string().max(255).optional(),
  // API key / Bearer
  headerName: z.string().max(100).optional(),
  headerValue: z.string().max(1000).optional(),
  // Query param auth
  paramName: z.string().max(100).optional(),
  paramValue: z.string().max(1000).optional(),
});

export type FeedCredentials = z.infer<typeof feedCredentials>;

// Verification request for AUTHENTICATED feeds
export const verifyAuthenticatedFeed = z.object({
  feedUrl: url,
  credentials: feedCredentials,
});

export type VerifyAuthenticatedFeed = z.infer<typeof verifyAuthenticatedFeed>;

// Combined subscribe request (handles both public and authenticated)
export const subscribeToFeed = z.object({
  feedUrl: url,
  credentials: feedCredentials.optional(),
});

export type SubscribeToFeed = z.infer<typeof subscribeToFeed>;

export const feedSubscription = z.object({
  id: feedSubscriptionId,
  feedId: feedId,
  retailerId: organizationId,
  isActive: z.boolean(),
  verifiedAt: z.coerce.date(),
  disconnectedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FeedSubscription = z.infer<typeof feedSubscription>;

// Subscription with feed info for retailer view
export const feedSubscriptionWithFeed = feedSubscription.extend({
  feed: feed,
});

export type FeedSubscriptionWithFeed = z.infer<typeof feedSubscriptionWithFeed>;

// ============================================
// Feed Source
// ============================================

// Feed mapping field config
export const feedMappingFields = z.object({
  sku: z.string().optional(),
  name: z.string().optional(),
  price: z.string().optional(),
  description: z.string().optional(),
  brand: z.string().optional(),
  productType: z.string().optional(),
  tags: z.string().optional(),
  barcode: z.string().optional(),
  compareAtPrice: z.string().optional(),
  costPrice: z.string().optional(),
  currency: z.string().optional(),
  quantity: z.string().optional(),
  stockStatus: z.string().optional(),
  images: z.string().optional(),
});

export type FeedMappingFields = z.infer<typeof feedMappingFields>;

// Feed transform config
export const feedTransform = z.object({
  field: z.string(),
  type: z.enum([
    "regex_replace",
    "trim",
    "lowercase",
    "uppercase",
    "strip_html",
    "decode_entities",
    "split_first",
    "split_all",
    "prefix",
    "suffix",
    "number",
    "default",
  ]),
  params: z.record(z.string()).optional(),
});

export type FeedTransform = z.infer<typeof feedTransform>;

// Feed mapping options
export const feedMappingOptions = z.object({
  delimiter: z.string().optional(),
  encoding: z.string().optional(),
  skipRows: z.number().optional(),
  imageDelimiter: z.string().optional(),
  imagesAreArray: z.boolean().optional(),
  tagDelimiter: z.string().optional(),
  stockStatusMapping: z.record(z.number()).optional(),
  priceDecimalSeparator: z.string().optional(),
  priceThousandSeparator: z.string().optional(),
  defaultCurrency: z.string().optional(),
  defaultQuantity: z.number().optional(),
});

export type FeedMappingOptions = z.infer<typeof feedMappingOptions>;

// Complete feed mapping config
export const feedMapping = z.object({
  rootPath: z.string().optional(),
  fields: feedMappingFields.optional(),
  transforms: z.array(feedTransform).optional(),
  options: feedMappingOptions.optional(),
});

export type FeedMapping = z.infer<typeof feedMapping>;

export const createFeedSource = z.object({
  feedId: feedId,
  feedType: feedType,
  feedUrl: url.optional(),
  feedFileKey: z.string().optional(),
  requiresAuth: z.boolean().default(false),
  schedule: feedSchedule.default("daily"),
  mapping: feedMapping.default({}),
  isActive: z.boolean().default(true),
});

export type CreateFeedSource = z.infer<typeof createFeedSource>;

export const updateFeedSource = createFeedSource.omit({ feedId: true }).partial();

export type UpdateFeedSource = z.infer<typeof updateFeedSource>;

export const feedSource = z.object({
  id: feedSourceId,
  feedId: feedId,
  feedType: feedType,
  feedUrl: z.string().nullable(),
  feedFileKey: z.string().nullable(),
  requiresAuth: z.boolean(),
  credentialsRef: z.string().nullable(),
  schedule: feedSchedule,
  mapping: feedMapping,
  lastSyncAt: z.coerce.date().nullable(),
  lastSyncStatus: feedSyncStatus.nullable(),
  lastSyncError: z.string().nullable(),
  lastSyncProductCount: z.number().nullable(),
  lastSyncDurationMs: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FeedSource = z.infer<typeof feedSource>;

// ============================================
// Feed Sync Log
// ============================================

export const feedLogError = z.object({
  row: z.number().optional(),
  sku: z.string().optional(),
  field: z.string().optional(),
  message: z.string(),
  raw: z.unknown().optional(),
});

export type FeedLogError = z.infer<typeof feedLogError>;

export const feedSyncLog = z.object({
  id: z.string(),
  feedSourceId: feedSourceId,
  status: feedSyncStatus,
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  productsProcessed: z.number(),
  productsCreated: z.number(),
  productsUpdated: z.number(),
  productsFailed: z.number(),
  errors: z.array(feedLogError),
  triggeredBy: z.string().nullable(),
  triggeredByUserId: z.string().nullable(),
});

export type FeedSyncLog = z.infer<typeof feedSyncLog>;

// ============================================
// List Filters
// ============================================

export const feedFilters = z
  .object({
    status: feedStatus.optional(),
    search: z.string().max(100).optional(),
  })
  .merge(paginationParams);

export type FeedFilters = z.infer<typeof feedFilters>;

export const feedRequestFilters = z
  .object({
    // Filter to requests for new feeds (not yet in system)
    newOnly: z.coerce.boolean().optional(),
  })
  .merge(paginationParams);

export type FeedRequestFilters = z.infer<typeof feedRequestFilters>;
