import { z } from "zod";

// ============================================
// TypeID Validators
// ============================================

// TypeID prefixes matching the db package
export const ID_PREFIXES = {
  organization: "org",
  user: "usr",
  membership: "mem",
  product: "prd",
  variant: "var",
  inventory: "inv",
  connection: "con",
  integration: "int",
  syncCursor: "cur",
  apiKey: "key",
  event: "evt",
  webhookSubscription: "whs",
  webhookLog: "whl",
  uploadedFile: "fil",
  // Custom suppliers (Community Library)
  feed: "feed",
  feedRequest: "freq",
  feedSource: "fsrc",
  feedSyncLog: "flog",
  feedSubscription: "fsub",
} as const;

export type EntityType = keyof typeof ID_PREFIXES;
export type IdPrefix = (typeof ID_PREFIXES)[EntityType];

// Generic TypeID validator
const typeIdRegex = /^[a-z]+_[0-9a-hjkmnp-tv-z]{26}$/;

export const typeId = z.string().regex(typeIdRegex, {
  message: "Invalid TypeID format",
});

// Factory to create typed ID validators
function createIdValidator<T extends EntityType>(entityType: T) {
  const prefix = ID_PREFIXES[entityType];
  return z.string().refine(
    (val) => {
      if (!typeIdRegex.test(val)) return false;
      return val.startsWith(`${prefix}_`);
    },
    { message: `Invalid ${entityType} ID, expected prefix '${prefix}_'` }
  );
}

// Typed ID validators for each entity
export const organizationId = createIdValidator("organization");
export const userId = createIdValidator("user");
export const membershipId = createIdValidator("membership");
export const productId = createIdValidator("product");
export const variantId = createIdValidator("variant");
export const inventoryId = createIdValidator("inventory");
export const connectionId = createIdValidator("connection");
export const integrationId = createIdValidator("integration");
export const syncCursorId = createIdValidator("syncCursor");
export const apiKeyId = createIdValidator("apiKey");
export const eventId = createIdValidator("event");
export const webhookSubscriptionId = createIdValidator("webhookSubscription");
export const webhookLogId = createIdValidator("webhookLog");
export const uploadedFileId = createIdValidator("uploadedFile");
// Custom suppliers
export const feedId = createIdValidator("feed");
export const feedRequestId = createIdValidator("feedRequest");
export const feedSourceId = createIdValidator("feedSource");
export const feedSyncLogId = createIdValidator("feedSyncLog");
export const feedSubscriptionId = createIdValidator("feedSubscription");

// Backward compatibility - generic ID (accepts any valid TypeID)
export const uuid = typeId;

export const email = z.string().email().max(255);

export const url = z.string().url().max(2048);

export const slug = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "Slug must be lowercase alphanumeric with hyphens",
  });

export const phone = z
  .string()
  .max(20)
  .refine((val) => val === "" || /^\+?[0-9\s\-()]+$/.test(val), {
    message: "Invalid phone number format",
  })
  .optional()
  .transform((val) => val === "" ? undefined : val);

// Money in cents or decimal string
export const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, {
    message: "Invalid money format",
  })
  .or(z.number().nonnegative());

// Percentage as decimal (0.01 = 1%)
export const percentage = z
  .string()
  .regex(/^[01](\.\d{1,4})?$/)
  .or(z.number().min(0).max(1));

// ============================================
// Address
// ============================================

// Helper to transform empty strings to undefined for optional fields
const optionalString = (maxLen: number) =>
  z.string().max(maxLen).optional().transform((val) => val === "" ? undefined : val);

export const address = z.object({
  firstName: optionalString(100),
  lastName: optionalString(100),
  company: optionalString(255),
  address1: z.string().min(1).max(255),
  address2: optionalString(255),
  city: z.string().min(1).max(100),
  state: optionalString(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  phone: phone,
  email: z.string().email().max(255).optional()
    .or(z.literal(""))
    .transform((val) => val === "" ? undefined : val),
});

export type Address = z.infer<typeof address>;

// ============================================
// Pagination
// ============================================

export const paginationParams = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cursorPaginationParams = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const paginationMeta = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
});

export const cursorPaginationMeta = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type PaginationParams = z.infer<typeof paginationParams>;
export type CursorPaginationParams = z.infer<typeof cursorPaginationParams>;
export type PaginationMeta = z.infer<typeof paginationMeta>;
export type CursorPaginationMeta = z.infer<typeof cursorPaginationMeta>;

// ============================================
// Sorting
// ============================================

export const sortOrder = z.enum(["asc", "desc"]).default("desc");

export const sortParams = <T extends readonly string[]>(fields: T) =>
  z.object({
    sortBy: z.enum(fields as unknown as [string, ...string[]]).optional(),
    sortOrder: sortOrder,
  });

// ============================================
// Filters
// ============================================

export const dateRangeFilter = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type DateRangeFilter = z.infer<typeof dateRangeFilter>;

// ============================================
// API Response Wrappers
// ============================================

export const apiSuccess = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const apiError = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

export const paginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: paginationMeta,
  });

export const cursorPaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
    meta: cursorPaginationMeta,
  });

// ============================================
// Enums (mirroring DB enums for validation)
// ============================================

/**
 * @deprecated Use `organizationRole` and `organizationRoles` instead.
 * Organizations can now have multiple roles.
 */
export const organizationType = z.enum(["supplier", "retailer"]);

// Organization roles (organizations can have multiple roles)
export const organizationRole = z.enum(["supplier", "retailer"]);
export const organizationRoles = z.array(organizationRole).min(1);

export const connectionStatus = z.enum([
  "pending",
  "active",
  "suspended",
  "terminated",
]);

export const integrationProvider = z.enum(["shopify", "custom"]);

export const eventType = z.enum([
  "product.created",
  "product.updated",
  "product.deleted",
]);

export const membershipRole = z.enum(["owner", "admin", "member"]);

// Custom supplier enums
export const feedStatus = z.enum([
  "pending",
  "mapping",
  "active",
  "paused",
  "deprecated",
]);

export const feedType = z.enum(["xml", "csv", "json"]);

export const feedSchedule = z.enum(["hourly", "daily", "weekly", "manual"]);

export const feedSyncStatus = z.enum(["pending", "running", "success", "failed"]);

// Export enum types
/** @deprecated Use `OrganizationRole` instead */
export type OrganizationType = z.infer<typeof organizationType>;
export type OrganizationRole = z.infer<typeof organizationRole>;
export type OrganizationRoles = z.infer<typeof organizationRoles>;
export type ConnectionStatus = z.infer<typeof connectionStatus>;
export type IntegrationProvider = z.infer<typeof integrationProvider>;
export type EventType = z.infer<typeof eventType>;
export type MembershipRole = z.infer<typeof membershipRole>;
export type FeedStatus = z.infer<typeof feedStatus>;
export type FeedType = z.infer<typeof feedType>;
export type FeedSchedule = z.infer<typeof feedSchedule>;
export type FeedSyncStatus = z.infer<typeof feedSyncStatus>;
