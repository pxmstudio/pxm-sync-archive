/**
 * TypeID utilities for type-safe, sortable IDs
 *
 * TypeIDs are prefixed UUIDv7s encoded in base32:
 * - Type-safe: `org_xxx` can't be confused with `usr_xxx`
 * - Sortable: Time-ordered (UUIDv7)
 * - URL-safe: Base32 encoded (26 chars)
 *
 * Format: {prefix}_{base32_uuid} (e.g., "org_01h2xcejqtf2nbrexx3vqjhp41")
 */

import { typeid, TypeID } from "typeid-js";

/**
 * All entity prefixes used in the database.
 * Keep in sync with schema files.
 */
export const ID_PREFIXES = {
  // Core entities
  organization: "org",
  user: "usr",
  membership: "mem",

  // Product catalog
  product: "prd",
  variant: "var",
  inventory: "inv",

  // Connections
  connection: "con",

  // Orders
  order: "ord",
  orderItem: "oit",
  transaction: "txn",

  // Integrations
  integration: "int",
  syncCursor: "cur",

  // API access
  apiKey: "key",

  // Events & webhooks
  event: "evt",
  webhookSubscription: "whs",
  webhookLog: "whl",

  // Visibility rules
  visibilityRule: "vsr",
  ruleAssignment: "vra",

  // Collections
  collection: "col",
  collectionProduct: "clp",

  // Pricing
  pricingTier: "tier",
  tierRule: "trr",
  pricingRule: "prr",

  // Catalog aggregates
  brand: "brd",
  productTag: "ptg",
  productType: "pty",

  // Application fields & files
  applicationField: "apf",
  uploadedFile: "fil",

  // Shipping
  shippingZone: "shz",
  shippingMethod: "shm",
  shippingRate: "shr",
  shippingCondition: "shc",

  // Organization addresses
  orgAddress: "oad",

  // Retailer product sync
  syncSetting: "syn",
  syncedProduct: "spr",
  fieldMapping: "fmp",

  // Feeds (Community Library)
  feed: "feed",
  feedRequest: "freq",
  feedSource: "fsrc",
  feedSyncLog: "flog",
  feedSubscription: "fsub",
  feedSyncSetting: "fss",
  feedSyncedProduct: "fsp",

  // Commission billing
  commissionInvoice: "civ",
  orderCommission: "ocm",

  // Webhook deduplication
  processedWebhook: "pwh",

  // Auto-ordering / incoming orders
  incomingOrder: "inc",

  // Store sync runs (activity log)
  storeSyncRun: "ssr",

  // Shopify store metadata cache
  shopifyMeta: "smd",
} as const;

export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];
export type EntityType = keyof typeof ID_PREFIXES;

/**
 * Create a new TypeID for an entity type
 *
 * @example
 * const orgId = createId("organization"); // "org_01h2xcejqtf2nbrexx3vqjhp41"
 * const userId = createId("user");        // "usr_01h2xcejqtf2nbrexx3vqjhp42"
 */
export function createId<T extends EntityType>(entityType: T): string {
  const prefix = ID_PREFIXES[entityType];
  return typeid(prefix).toString();
}

/**
 * Create a TypeID generator function for use in Drizzle schema
 *
 * @example
 * text("id").primaryKey().$defaultFn(idGenerator("organization"))
 */
export function idGenerator<T extends EntityType>(entityType: T): () => string {
  return () => createId(entityType);
}

/**
 * Validate a TypeID string format
 *
 * @example
 * isValidTypeId("org_01h2xcejqtf2nbrexx3vqjhp41") // true
 * isValidTypeId("invalid") // false
 */
export function isValidTypeId(id: string): boolean {
  try {
    TypeID.fromString(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate that a TypeID has the expected prefix
 *
 * @example
 * isValidTypeIdWithPrefix("org_01h2xcejqtf2nbrexx3vqjhp41", "org") // true
 * isValidTypeIdWithPrefix("usr_01h2xcejqtf2nbrexx3vqjhp41", "org") // false
 */
export function isValidTypeIdWithPrefix(id: string, prefix: IdPrefix): boolean {
  try {
    const parsed = TypeID.fromString(id);
    return parsed.getType() === prefix;
  } catch {
    return false;
  }
}

/**
 * Extract the prefix from a TypeID
 *
 * @example
 * getTypeIdPrefix("org_01h2xcejqtf2nbrexx3vqjhp41") // "org"
 */
export function getTypeIdPrefix(id: string): string | null {
  try {
    const parsed = TypeID.fromString(id);
    return parsed.getType();
  } catch {
    return null;
  }
}

/**
 * Parse a TypeID and return its components
 */
export function parseTypeId(id: string): {
  prefix: string;
  suffix: string;
} | null {
  try {
    const parsed = TypeID.fromString(id);
    return {
      prefix: parsed.getType(),
      suffix: parsed.getSuffix(),
    };
  } catch {
    return null;
  }
}

/**
 * Type guard for specific entity type IDs
 */
export function isOrganizationId(id: string): boolean {
  return isValidTypeIdWithPrefix(id, "org");
}

export function isUserId(id: string): boolean {
  return isValidTypeIdWithPrefix(id, "usr");
}

export function isProductId(id: string): boolean {
  return isValidTypeIdWithPrefix(id, "prd");
}

export function isVariantId(id: string): boolean {
  return isValidTypeIdWithPrefix(id, "var");
}

export function isOrderId(id: string): boolean {
  return isValidTypeIdWithPrefix(id, "ord");
}

export function isConnectionId(id: string): boolean {
  return isValidTypeIdWithPrefix(id, "con");
}
