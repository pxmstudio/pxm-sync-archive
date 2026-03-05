/**
 * E-commerce Adapter Types
 *
 * Abstraction layer for e-commerce platforms (Shopify, WooCommerce, etc.)
 * This allows connecting to different platforms with a unified interface.
 */

// ============================================
// Product Types
// ============================================

export interface EcommerceImage {
  /** External ID from the platform */
  externalId: string;

  /** Image URL */
  url: string;

  /** Alt text for accessibility */
  altText: string | null;

  /** Display position (0-indexed) */
  position: number;

  /** Image dimensions */
  width: number | null;
  height: number | null;
}

export interface EcommerceVariant {
  /** External ID from the platform */
  externalId: string;

  /** SKU (Stock Keeping Unit) */
  sku: string | null;

  /** Variant title (e.g., "Small / Red") */
  title: string;

  /** Barcode (UPC, EAN, etc.) */
  barcode: string | null;

  /** Price in decimal (e.g., 29.99) */
  price: number;

  /** Compare at price (original price before discount) */
  compareAtPrice: number | null;

  /** Cost price (wholesale cost) */
  costPrice: number | null;

  /** Currency code (ISO 4217) */
  currency: string;

  /** Current inventory quantity */
  inventoryQuantity: number;

  /** Weight in the specified unit */
  weight: number | null;

  /** Weight unit (kg, g, lb, oz) */
  weightUnit: string;

  /** Variant-specific attributes (size, color, etc.) */
  attributes: Record<string, string>;

  /** Whether the variant requires shipping */
  requiresShipping: boolean;

  /** Inventory item ID (for inventory operations) */
  inventoryItemId: string | null;
}

export interface EcommerceProduct {
  /** External ID from the platform */
  externalId: string;

  /** Product title */
  title: string;

  /** Product description (may contain HTML) */
  description: string;

  /** Product description as plain text */
  descriptionPlainText: string;

  /** Vendor/brand name */
  vendor: string | null;

  /** Product type/category */
  productType: string | null;

  /** Tags for categorization */
  tags: string[];

  /** Product images */
  images: EcommerceImage[];

  /** Product variants */
  variants: EcommerceVariant[];

  /** Product status */
  status: "active" | "draft" | "archived";

  /** Product handle/slug */
  handle: string | null;

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;

  /** Platform-specific metadata */
  metadata: Record<string, unknown>;
}

// ============================================
// Inventory Types
// ============================================

export interface EcommerceInventoryLevel {
  /** Inventory item ID */
  inventoryItemId: string;

  /** Location ID (if multi-location) */
  locationId: string | null;

  /** Available quantity */
  available: number;

  /** Reserved/committed quantity */
  reserved: number;

  /** Last updated timestamp */
  updatedAt: Date;
}

export interface InventoryAdjustment {
  /** Inventory item ID */
  inventoryItemId: string;

  /** Location ID (if multi-location) */
  locationId?: string;

  /** Quantity change (positive or negative) */
  delta: number;

  /** Reason for adjustment */
  reason?: string;
}

// ============================================
// Order Types
// ============================================

export interface EcommerceAddress {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  province: string | null;
  provinceCode: string | null;
  country: string;
  countryCode: string;
  postalCode: string;
  phone: string | null;
}

export interface EcommerceLineItem {
  /** External ID from the platform */
  externalId: string;

  /** Variant external ID */
  variantExternalId: string;

  /** Product external ID */
  productExternalId: string;

  /** Product title */
  title: string;

  /** Variant title */
  variantTitle: string | null;

  /** SKU */
  sku: string | null;

  /** Quantity ordered */
  quantity: number;

  /** Unit price */
  price: number;

  /** Total price (quantity * price) */
  totalPrice: number;

  /** Whether the item requires shipping */
  requiresShipping: boolean;

  /** Fulfillment status */
  fulfillmentStatus: "fulfilled" | "partial" | "unfulfilled" | null;
}

export interface EcommerceOrder {
  /** External ID from the platform */
  externalId: string;

  /** Order number (human-readable) */
  orderNumber: string;

  /** Order line items */
  lineItems: EcommerceLineItem[];

  /** Shipping address */
  shippingAddress: EcommerceAddress | null;

  /** Billing address */
  billingAddress: EcommerceAddress | null;

  /** Customer email */
  email: string | null;

  /** Customer phone */
  phone: string | null;

  /** Order note */
  note: string | null;

  /** Subtotal (before tax/shipping) */
  subtotal: number;

  /** Total tax */
  totalTax: number;

  /** Shipping cost */
  shippingCost: number;

  /** Total discount */
  totalDiscount: number;

  /** Grand total */
  total: number;

  /** Currency code */
  currency: string;

  /** Financial status */
  financialStatus: "pending" | "paid" | "partially_paid" | "refunded" | "voided";

  /** Fulfillment status */
  fulfillmentStatus: "fulfilled" | "partial" | "unfulfilled" | null;

  /** Order tags */
  tags: string[];

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;
}

// ============================================
// Product Create/Update Input Types
// ============================================

export interface CreateProductVariantInput {
  /** SKU (Stock Keeping Unit) */
  sku?: string;

  /** Barcode (UPC, EAN, etc.) */
  barcode?: string;

  /** Price in decimal (e.g., 29.99) */
  price?: number;

  /** Compare at price (original price before discount) */
  compareAtPrice?: number;

  /** Cost price (wholesale cost for profit tracking) */
  cost?: number;

  /** Weight in the specified unit */
  weight?: number;

  /** Weight unit (kg, g, lb, oz) */
  weightUnit?: string;

  /** Whether the variant requires shipping */
  requiresShipping?: boolean;

  /** Variant options (e.g., ["Small", "Red"]) */
  options?: string[];
}

export interface CreateProductImageInput {
  /** Image URL */
  url: string;

  /** Alt text for accessibility */
  altText?: string;
}

export interface CreateProductVideoInput {
  /** Video URL (YouTube or Vimeo embed URL) */
  url: string;

  /** Alt text for accessibility */
  altText?: string;
}

export interface CreateProductMetafieldInput {
  /** Metafield namespace */
  namespace: string;

  /** Metafield key */
  key: string;

  /** Metafield value */
  value: string;

  /** Metafield type (e.g., "single_line_text_field", "date_time", "number_integer") */
  type: string;
}

export interface CreateProductInput {
  /** Product title */
  title: string;

  /** Product description (may contain HTML) */
  description?: string;

  /** Product description as HTML */
  descriptionHtml?: string;

  /** Vendor/brand name */
  vendor?: string;

  /** Product type/category */
  productType?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Product status */
  status?: "active" | "draft" | "archived";

  /** Product variants */
  variants?: CreateProductVariantInput[];

  /** Product images */
  images?: CreateProductImageInput[];

  /** Product videos (YouTube/Vimeo embed URLs) */
  videos?: CreateProductVideoInput[];

  /** Product metafields */
  metafields?: CreateProductMetafieldInput[];
}

export interface UpdateProductInput {
  /** Product title */
  title?: string;

  /** Product description (may contain HTML) */
  description?: string;

  /** Product description as HTML */
  descriptionHtml?: string;

  /** Vendor/brand name */
  vendor?: string;

  /** Product type/category */
  productType?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Product status */
  status?: "active" | "draft" | "archived";
}

export interface CreateOrderInput {
  /** Line items to order */
  lineItems: Array<{
    variantExternalId: string;
    quantity: number;
    price?: number; // Override price if needed
  }>;

  /** Shipping address */
  shippingAddress: EcommerceAddress;

  /** Billing address (optional, defaults to shipping) */
  billingAddress?: EcommerceAddress;

  /** Customer email */
  email?: string;

  /** Customer phone */
  phone?: string;

  /** Order note */
  note?: string;

  /** Tags to add to the order */
  tags?: string[];

  /** Whether the order is already paid (externally) */
  isPaid?: boolean;

  /** Currency code (ISO 4217, e.g., "USD", "EUR") */
  currency?: string;

  /** Send order confirmation email */
  sendReceipt?: boolean;

  /** Send fulfillment notification */
  sendFulfillmentReceipt?: boolean;
}

// ============================================
// Webhook Types
// ============================================

export type EcommerceWebhookTopic =
  | "products/create"
  | "products/update"
  | "products/delete"
  | "inventory_levels/update"
  | "orders/create"
  | "orders/updated"
  | "orders/fulfilled"
  | "orders/cancelled";

export interface EcommerceWebhookPayload {
  /** Webhook topic */
  topic: EcommerceWebhookTopic;

  /** Shop/store identifier */
  shopId: string;

  /** Raw payload data */
  data: Record<string, unknown>;

  /** Timestamp */
  timestamp: Date;
}

// ============================================
// Shipping Types
// ============================================

export interface EcommerceShippingCountry {
  /** ISO 3166-1 alpha-2 country code */
  code: string;

  /** Whether this represents "rest of world" */
  restOfWorld: boolean;

  /** Provinces/states within this country */
  provinces: Array<{
    /** Province/state name */
    name: string;
    /** Province/state code (e.g., "NY", "CA", "ON") */
    code: string;
  }>;
}

export interface EcommerceShippingRateCondition {
  /** Condition field (TOTAL_WEIGHT or TOTAL_PRICE) */
  field: "TOTAL_WEIGHT" | "TOTAL_PRICE";

  /** Condition operator (GREATER_THAN_OR_EQUAL_TO or LESS_THAN_OR_EQUAL_TO) */
  operator: "GREATER_THAN_OR_EQUAL_TO" | "LESS_THAN_OR_EQUAL_TO";

  /** Condition value - either MoneyV2 or Weight */
  value:
    | { type: "money"; amount: string; currencyCode: string }
    | { type: "weight"; value: number; unit: string };
}

export interface EcommerceShippingMethod {
  /** External ID from the platform */
  externalId: string;

  /** Method name/description */
  name: string;

  /** Whether the method is active */
  active: boolean;

  /** Rate amount (for flat rates) */
  rateAmount: string | null;

  /** Rate currency */
  rateCurrency: string | null;

  /** Rate conditions (for conditional rates) */
  conditions: EcommerceShippingRateCondition[];
}

export interface EcommerceShippingZone {
  /** External ID from the platform */
  externalId: string;

  /** Zone name */
  name: string;

  /** Countries included in this zone */
  countries: EcommerceShippingCountry[];

  /** Shipping methods available in this zone */
  methods: EcommerceShippingMethod[];
}

export interface EcommerceShippingData {
  /** All shipping zones */
  zones: EcommerceShippingZone[];

  /** Default currency for the shop */
  currency: string;
}

// ============================================
// Pagination Types
// ============================================

export interface PaginatedResult<T> {
  /** Items in this page */
  items: T[];

  /** Cursor for next page (null if no more pages) */
  nextCursor: string | null;

  /** Whether there are more items */
  hasMore: boolean;
}

// ============================================
// Adapter Interface
// ============================================

export interface EcommerceAdapter {
  /** Adapter identifier (e.g., "shopify", "custom") */
  readonly provider: string;

  // ---- Products ----

  /**
   * List products with cursor-based pagination
   * @param cursor - Cursor for pagination (null for first page)
   * @param limit - Number of items per page (default: 50)
   */
  listProducts(
    cursor?: string | null,
    limit?: number
  ): Promise<PaginatedResult<EcommerceProduct>>;

  /**
   * Get a single product by external ID
   */
  getProduct(externalId: string): Promise<EcommerceProduct | null>;

  /**
   * Iterate over all products (generator for memory efficiency)
   */
  iterateProducts(): AsyncGenerator<EcommerceProduct, void, unknown>;

  // ---- Inventory ----

  /**
   * Get inventory levels for specific inventory items
   */
  getInventoryLevels(
    inventoryItemIds: string[]
  ): Promise<Map<string, EcommerceInventoryLevel>>;

  /**
   * Adjust inventory quantity (delta change)
   */
  adjustInventory(adjustment: InventoryAdjustment): Promise<void>;

  /**
   * Set inventory quantity (absolute value)
   */
  setInventory(
    inventoryItemId: string,
    quantity: number,
    locationId?: string
  ): Promise<void>;

  // ---- Orders ----

  /**
   * Create an order
   */
  createOrder(input: CreateOrderInput): Promise<EcommerceOrder>;

  /**
   * Get an order by external ID
   */
  getOrder(externalId: string): Promise<EcommerceOrder | null>;

  /**
   * Cancel an order
   */
  cancelOrder(externalId: string, reason?: string): Promise<void>;

  /**
   * Mark an order as fulfilled
   */
  fulfillOrder(
    externalId: string,
    trackingInfo?: {
      trackingNumber?: string;
      trackingUrl?: string;
      carrier?: string;
    }
  ): Promise<void>;

  // ---- Webhooks ----

  /**
   * Register webhooks for the specified topics
   */
  registerWebhooks(
    topics: EcommerceWebhookTopic[],
    callbackUrl: string
  ): Promise<void>;

  /**
   * Verify a webhook signature
   */
  verifyWebhook(request: Request): Promise<boolean>;

  /**
   * Parse a webhook payload
   */
  parseWebhook(request: Request): Promise<EcommerceWebhookPayload | null>;

  // ---- Connection ----

  /**
   * Test the connection to the platform
   */
  testConnection(): Promise<{ success: boolean; message?: string }>;

  /**
   * Get shop/store information
   */
  getShopInfo(): Promise<{
    id: string;
    name: string;
    domain: string;
    email: string | null;
    currency: string;
    timezone: string | null;
  }>;

  // ---- Shipping (Optional) ----

  /**
   * Get shipping zones and rates from the platform
   * Not all platforms support this - returns null if not supported
   */
  getShippingZones?(): Promise<EcommerceShippingData | null>;
}
