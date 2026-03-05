/**
 * Shopify E-commerce Adapter
 *
 * Implementation of EcommerceAdapter for Shopify stores using the Admin API.
 */

import {
  shopifyApi,
  ApiVersion,
  Session,
  type Shopify,
} from "@shopify/shopify-api";
import "@shopify/shopify-api/adapters/web-api";

import type {
  EcommerceAdapter,
  EcommerceProduct,
  EcommerceVariant,
  EcommerceImage,
  EcommerceOrder,
  EcommerceLineItem,
  EcommerceAddress,
  EcommerceInventoryLevel,
  EcommerceWebhookPayload,
  EcommerceWebhookTopic,
  EcommerceShippingData,
  EcommerceShippingZone,
  EcommerceShippingMethod,
  EcommerceShippingCountry,
  EcommerceShippingRateCondition,
  CreateOrderInput,
  CreateProductInput,
  UpdateProductInput,
  InventoryAdjustment,
  PaginatedResult,
} from "./types.js";

// ============================================
// Retry Helper for Rate Limiting
// ============================================

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Check if an error is a throttle/rate limit error from Shopify
 */
function isThrottleError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("throttled") ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("429")
    );
  }
  return false;
}

/**
 * Execute an async operation with exponential backoff retry on throttle errors
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 5, baseDelayMs = 1000, maxDelayMs = 30000 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Only retry on throttle errors
      if (!isThrottleError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 500;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      console.log(
        `[Shopify] Throttled, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// Configuration
// ============================================

export interface ShopifyAdapterConfig {
  /** Shopify shop domain (e.g., "my-store.myshopify.com") */
  shopDomain: string;

  /** Admin API access token */
  accessToken: string;

  /** API version (optional, defaults to latest stable) */
  apiVersion?: ApiVersion;

  /** Webhook secret for verifying webhooks */
  webhookSecret?: string;
}

// ============================================
// ProductSet Types
// ============================================

/**
 * Variant input for productSet mutation
 */
export interface ProductSetVariantInput {
  id?: string; // GID for existing variant, omit for new
  sku?: string;
  barcode?: string;
  price?: string;
  compareAtPrice?: string | null;
  cost?: string;
  optionValues: Array<{ optionName: string; name: string }>;
  inventoryQuantities?: Array<{
    locationId: string;
    name: "available" | "on_hand";
    quantity: number;
  }>;
}

/**
 * Input for productSet mutation - updates product and all variants in a single API call
 */
export interface ProductSetInput {
  title?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  handle?: string;
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
    type: string;
  }>;
  variants?: ProductSetVariantInput[];
  /** Product options - required when updating variants */
  productOptions?: Array<{
    name: string;
    values: Array<{ name: string }>;
  }>;
}

export class ShopifyAdapter implements EcommerceAdapter {
  readonly provider = "shopify";

  private shopify: Shopify;
  private session: Session;
  private config: ShopifyAdapterConfig;

  constructor(config: ShopifyAdapterConfig) {
    this.config = config;

    // Initialize Shopify API
    this.shopify = shopifyApi({
      apiKey: "placeholder", // Not needed for private apps with access token
      apiSecretKey: config.webhookSecret || "placeholder",
      scopes: [],
      hostName: config.shopDomain,
      apiVersion: config.apiVersion || ApiVersion.January25,
      isCustomStoreApp: true,
      isEmbeddedApp: false,
      adminApiAccessToken: config.accessToken,
    });

    // Create session for API calls
    this.session = new Session({
      id: `${config.shopDomain}_session`,
      shop: config.shopDomain,
      state: "",
      isOnline: false,
      accessToken: config.accessToken,
    });
  }

  // ============================================
  // GraphQL Helper with Retry
  // ============================================

  /**
   * Execute a GraphQL request with automatic retry on throttle errors
   */
  private async graphqlRequest<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    return withRetry(
      async () => {
        const response = await client.request(query, { variables });
        return response.data as T;
      },
      { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 30000 }
    );
  }

  // ============================================
  // Shop Info
  // ============================================

  /**
   * Get the store's primary currency code (e.g., "USD", "EUR")
   */
  async getStoreCurrency(): Promise<string> {
    const query = `
      query GetShopCurrency {
        shop {
          currencyCode
        }
      }
    `;

    const data = await this.graphqlRequest<{
      shop: { currencyCode: string };
    }>(query);

    return data.shop.currencyCode;
  }

  // ============================================
  // Products
  // ============================================

  async listProducts(
    cursor?: string | null,
    limit: number = 50
  ): Promise<PaginatedResult<EcommerceProduct>> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            title
            descriptionHtml
            description
            vendor
            productType
            tags
            handle
            status
            createdAt
            updatedAt
            images(first: 10) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.request(query, {
      variables: {
        first: limit,
        after: cursor || null,
      },
    });

    const data = response.data as {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: Array<Record<string, unknown>>;
      };
    };

    const products = data.products.nodes.map((node) =>
      this.mapShopifyProduct(node)
    );

    return {
      items: products,
      nextCursor: data.products.pageInfo.endCursor,
      hasMore: data.products.pageInfo.hasNextPage,
    };
  }

  async getProduct(externalId: string): Promise<EcommerceProduct | null> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const query = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          descriptionHtml
          description
          vendor
          productType
          tags
          handle
          status
          createdAt
          updatedAt
          images(first: 20) {
            nodes {
              id
              url
              altText
              width
              height
            }
          }
          variants(first: 100) {
            nodes {
              id
              title
              sku
              barcode
              price
              compareAtPrice
              inventoryQuantity
              inventoryItem {
                id
                unitCost {
                  amount
                }
              }
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    `;

    // Convert numeric ID to GID format if needed
    const gid = externalId.startsWith("gid://")
      ? externalId
      : `gid://shopify/Product/${externalId}`;

    const response = await client.request(query, {
      variables: { id: gid },
    });

    const data = response.data as { product: Record<string, unknown> | null };

    if (!data.product) {
      return null;
    }

    return this.mapShopifyProduct(data.product);
  }

  async *iterateProducts(): AsyncGenerator<EcommerceProduct, void, unknown> {
    let cursor: string | null = null;

    do {
      const result = await this.listProducts(cursor, 50);

      for (const product of result.items) {
        yield product;
      }

      cursor = result.nextCursor;
    } while (cursor);
  }

  /**
   * Bulk fetch multiple products by their IDs using the nodes query.
   * More efficient than multiple getProduct calls.
   * @param externalIds Array of Shopify product IDs (numeric or GID format)
   * @returns Map of externalId -> EcommerceProduct (only includes found products)
   */
  async getProductsByIds(
    externalIds: string[]
  ): Promise<Map<string, EcommerceProduct>> {
    const result = new Map<string, EcommerceProduct>();

    if (externalIds.length === 0) {
      return result;
    }

    // Convert to GIDs if needed
    const gids = externalIds.map((id) =>
      id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`
    );

    const query = `
      query GetProductsByIds($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            descriptionHtml
            description
            vendor
            productType
            tags
            handle
            status
            createdAt
            updatedAt
            images(first: 20) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest<{
      nodes: Array<Record<string, unknown> | null>;
    }>(query, { ids: gids });

    for (const node of data.nodes) {
      if (node && node.id) {
        const product = this.mapShopifyProduct(node);
        result.set(product.externalId, product);
      }
    }

    return result;
  }

  // ============================================
  // Product Creation/Update (for retailer sync)
  // ============================================

  /**
   * Create a new product in the Shopify store
   * Note: Shopify API 2025-01+ requires two-step process:
   * 1. Create product with productOptions (defines option names)
   * 2. Use productVariantsBulkCreate to add variants
   */
  async createProduct(input: CreateProductInput): Promise<EcommerceProduct> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    // Step 1: Create product without variants (API 2025-01 doesn't support inline variants)
    const createProductMutation = `
      mutation CreateProduct($input: ProductInput!, $media: [CreateMediaInput!]) {
        productCreate(input: $input, media: $media) {
          product {
            id
            title
            descriptionHtml
            description
            vendor
            productType
            tags
            handle
            status
            createdAt
            updatedAt
            images(first: 20) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Extract unique option names from variants to build productOptions
    // productOptions defines the option structure (e.g., ["Size", "Color"])
    const optionNames: string[] = [];
    const optionValuesMap: Map<string, Set<string>> = new Map();

    if (input.variants && input.variants.length > 0) {
      for (const variant of input.variants) {
        if (variant.options) {
          variant.options.forEach((optValue, index) => {
            const optName = `Option${index + 1}`;
            if (!optionNames.includes(optName)) {
              optionNames.push(optName);
              optionValuesMap.set(optName, new Set());
            }
            optionValuesMap.get(optName)?.add(optValue);
          });
        }
      }
    }

    // Build productOptions for productCreate (defines option structure)
    const productOptions = optionNames.map((name) => ({
      name,
      values: Array.from(optionValuesMap.get(name) || []).map((v) => ({ name: v })),
    }));

    // Build media input for images and videos
    const media: Array<{
      originalSource: string;
      alt?: string;
      mediaContentType: "IMAGE" | "EXTERNAL_VIDEO";
    }> = [];

    // Add images
    if (input.images) {
      for (const img of input.images) {
        media.push({
          originalSource: img.url,
          alt: img.altText || undefined,
          mediaContentType: "IMAGE",
        });
      }
    }

    // Add videos
    if (input.videos) {
      for (const video of input.videos) {
        media.push({
          originalSource: video.url,
          alt: video.altText || undefined,
          mediaContentType: "EXTERNAL_VIDEO",
        });
      }
    }

    // Build metafields input
    const metafields = input.metafields?.map((m) => ({
      namespace: m.namespace,
      key: m.key,
      value: m.value,
      type: m.type,
    }));

    // Create product (without variants - they'll be added in step 2)
    const createData = await this.graphqlRequest<{
      productCreate: {
        product: Record<string, unknown> | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    }>(createProductMutation, {
      input: {
        title: input.title,
        descriptionHtml: input.descriptionHtml || input.description,
        vendor: input.vendor,
        productType: input.productType,
        tags: input.tags || [],
        status: input.status?.toUpperCase() || "ACTIVE",
        productOptions: productOptions.length > 0 ? productOptions : undefined,
        metafields: metafields && metafields.length > 0 ? metafields : undefined,
      },
      media: media.length > 0 ? media : undefined,
    });

    if (createData.productCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create product: ${createData.productCreate.userErrors
          .map((e) => `${e.field}: ${e.message}`)
          .join(", ")}`
      );
    }

    if (!createData.productCreate.product) {
      throw new Error("Product creation returned no product");
    }

    const productId = createData.productCreate.product.id as string;

    // Get the default variant that was auto-created
    const createdProduct = createData.productCreate.product as {
      variants?: { nodes: Array<{ id: string }> };
    };
    const defaultVariantId = createdProduct.variants?.nodes?.[0]?.id;

    // Step 2: Handle variants
    if (input.variants && input.variants.length > 0) {
      const firstVariant = input.variants[0]!;
      const isSingleVariantProduct = input.variants.length === 1 &&
        (!firstVariant.options || firstVariant.options.length === 0);

      if (isSingleVariantProduct && defaultVariantId) {
        // For single-variant products without options, update the auto-created default variant
        // Using productVariantsBulkUpdate since productVariantUpdate doesn't exist in API 2025-01
        const updateVariantMutation = `
          mutation UpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              productVariants {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const updateResponse = await client.request(updateVariantMutation, {
          variables: {
            productId,
            variants: [{
              id: defaultVariantId,
              barcode: firstVariant.barcode,
              price: firstVariant.price?.toString(),
              compareAtPrice: firstVariant.compareAtPrice?.toString(),
              inventoryItem: {
                sku: firstVariant.sku,
                cost: firstVariant.cost?.toString(),
                tracked: true,
              },
            }],
          },
        });

        const updateData = updateResponse.data as {
          productVariantsBulkUpdate: {
            productVariants: Array<{ id: string }> | null;
            userErrors: Array<{ field: string; message: string }>;
          };
        };

        if (updateData.productVariantsBulkUpdate.userErrors.length > 0) {
          console.warn(
            `Warning: Failed to update default variant: ${updateData.productVariantsBulkUpdate.userErrors
              .map((e) => `${e.field}: ${e.message}`)
              .join(", ")}`
          );
        }
      } else {
        // For multi-variant products, use productVariantsBulkCreate
        const variantsBulkMutation = `
          mutation ProductVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkCreate(productId: $productId, variants: $variants) {
              productVariants {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        // Build variants input for bulk create
        // Note: In API 2025-01, SKU and cost must be set via inventoryItem, not directly on the variant
        const variantsInput = input.variants.map((v) => ({
          barcode: v.barcode,
          price: v.price?.toString(),
          compareAtPrice: v.compareAtPrice?.toString(),
          inventoryItem: {
            sku: v.sku,
            cost: v.cost?.toString(),
            tracked: true,
          },
          optionValues: v.options?.map((optValue, index) => ({
            optionName: `Option${index + 1}`,
            name: optValue,
          })) || [],
        }));

        const variantsResponse = await client.request(variantsBulkMutation, {
          variables: {
            productId,
            variants: variantsInput,
          },
        });

        const variantsData = variantsResponse.data as {
          productVariantsBulkCreate: {
            productVariants: Array<Record<string, unknown>> | null;
            userErrors: Array<{ field: string; message: string }>;
          };
        };

        if (variantsData.productVariantsBulkCreate.userErrors.length > 0) {
          // Log warning but don't fail - product was created
          console.warn(
            `Warning: Failed to create some variants: ${variantsData.productVariantsBulkCreate.userErrors
              .map((e) => `${e.field}: ${e.message}`)
              .join(", ")}`
          );
        }
      }
    }

    // Fetch the complete product with variants
    const fetchQuery = `
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          descriptionHtml
          description
          vendor
          productType
          tags
          handle
          status
          createdAt
          updatedAt
          images(first: 20) {
            nodes {
              id
              url
              altText
              width
              height
            }
          }
          variants(first: 100) {
            nodes {
              id
              title
              sku
              barcode
              price
              compareAtPrice
              inventoryQuantity
              inventoryItem {
                id
                unitCost {
                  amount
                }
              }
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    `;

    const fetchResponse = await client.request(fetchQuery, {
      variables: { id: productId },
    });

    const fetchData = fetchResponse.data as {
      product: Record<string, unknown> | null;
    };

    if (!fetchData.product) {
      // Fall back to the created product data if fetch fails
      return this.mapShopifyProduct(createData.productCreate.product);
    }

    return this.mapShopifyProduct(fetchData.product);
  }

  /**
   * Update an existing product in the Shopify store
   */
  async updateProduct(
    externalId: string,
    input: UpdateProductInput
  ): Promise<EcommerceProduct> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const gid = externalId.startsWith("gid://")
      ? externalId
      : `gid://shopify/Product/${externalId}`;

    const mutation = `
      mutation UpdateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            descriptionHtml
            description
            vendor
            productType
            tags
            handle
            status
            createdAt
            updatedAt
            images(first: 20) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const productInput: Record<string, unknown> = {
      id: gid,
    };

    if (input.title !== undefined) productInput.title = input.title;
    if (input.descriptionHtml !== undefined)
      productInput.descriptionHtml = input.descriptionHtml;
    if (input.description !== undefined)
      productInput.descriptionHtml = input.description;
    if (input.vendor !== undefined) productInput.vendor = input.vendor;
    if (input.productType !== undefined)
      productInput.productType = input.productType;
    if (input.tags !== undefined) productInput.tags = input.tags;
    if (input.status !== undefined)
      productInput.status = input.status.toUpperCase();

    const response = await client.request(mutation, {
      variables: { input: productInput },
    });

    const data = response.data as {
      productUpdate: {
        product: Record<string, unknown> | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    };

    if (data.productUpdate.userErrors.length > 0) {
      throw new Error(
        `Failed to update product: ${data.productUpdate.userErrors
          .map((e) => `${e.field}: ${e.message}`)
          .join(", ")}`
      );
    }

    if (!data.productUpdate.product) {
      throw new Error("Product update returned no product");
    }

    return this.mapShopifyProduct(data.productUpdate.product);
  }

  // ============================================
  // ProductSet - Bulk Update Product + Variants
  // ============================================

  /**
   * Update a product and all its variants using the productSet mutation.
   * This is more efficient than separate updateProduct + updateVariant calls.
   *
   * ⚠️ IMPORTANT: Variants not included in the input will be DELETED.
   * Always include all existing variants when updating.
   *
   * @param productId - Shopify product GID (or numeric ID)
   * @param input - Product and variant data to update
   * @returns Updated product
   */
  async productSet(
    productId: string,
    input: ProductSetInput
  ): Promise<EcommerceProduct> {
    const gid = productId.startsWith("gid://")
      ? productId
      : `gid://shopify/Product/${productId}`;

    const mutation = `
      mutation ProductSet($input: ProductSetInput!, $identifier: ProductSetIdentifiers) {
        productSet(synchronous: true, input: $input, identifier: $identifier) {
          product {
            id
            title
            descriptionHtml
            description
            vendor
            productType
            tags
            handle
            status
            createdAt
            updatedAt
            images(first: 20) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    // Build the productSet input
    const productSetInput: Record<string, unknown> = {};

    if (input.title !== undefined) productSetInput.title = input.title;
    if (input.descriptionHtml !== undefined) productSetInput.descriptionHtml = input.descriptionHtml;
    if (input.vendor !== undefined) productSetInput.vendor = input.vendor;
    if (input.productType !== undefined) productSetInput.productType = input.productType;
    if (input.tags !== undefined) productSetInput.tags = input.tags;
    if (input.status !== undefined) productSetInput.status = input.status;
    if (input.handle !== undefined) productSetInput.handle = input.handle;

    // Add metafields if provided
    if (input.metafields && input.metafields.length > 0) {
      productSetInput.metafields = input.metafields.map(m => ({
        namespace: m.namespace,
        key: m.key,
        value: m.value,
        type: m.type,
      }));
    }

    // Add productOptions if provided (required when updating variants)
    if (input.productOptions && input.productOptions.length > 0) {
      productSetInput.productOptions = input.productOptions;
    }

    // Add variants if provided
    if (input.variants && input.variants.length > 0) {
      productSetInput.variants = input.variants.map(v => {
        const variantInput: Record<string, unknown> = {
          optionValues: v.optionValues,
        };

        if (v.id) {
          // Convert to GID if needed
          variantInput.id = v.id.startsWith("gid://")
            ? v.id
            : `gid://shopify/ProductVariant/${v.id}`;
        }

        if (v.price !== undefined) variantInput.price = v.price;
        if (v.compareAtPrice !== undefined) variantInput.compareAtPrice = v.compareAtPrice;
        if (v.barcode !== undefined) variantInput.barcode = v.barcode;

        // SKU and cost go in inventoryItem
        if (v.sku !== undefined || v.cost !== undefined) {
          const inventoryItem: Record<string, unknown> = {};
          if (v.sku !== undefined) inventoryItem.sku = v.sku;
          if (v.cost !== undefined) inventoryItem.cost = v.cost;
          variantInput.inventoryItem = inventoryItem;
        }

        // Inventory quantities if provided
        if (v.inventoryQuantities && v.inventoryQuantities.length > 0) {
          variantInput.inventoryQuantities = v.inventoryQuantities;
        }

        return variantInput;
      });
    }

    const data = await this.graphqlRequest<{
      productSet: {
        product: Record<string, unknown> | null;
        userErrors: Array<{ field: string[]; message: string; code: string }>;
      };
    }>(mutation, {
      input: productSetInput,
      identifier: { id: gid },
    });

    if (data.productSet.userErrors.length > 0) {
      const errors = data.productSet.userErrors
        .map(e => `${e.field?.join(".")}: ${e.message} (${e.code})`)
        .join(", ");
      throw new Error(`productSet failed: ${errors}`);
    }

    if (!data.productSet.product) {
      throw new Error("productSet returned no product");
    }

    return this.mapShopifyProduct(data.productSet.product);
  }

  /**
   * Create a new product using productSet mutation.
   * More efficient than createProduct when you have all data upfront.
   */
  async productSetCreate(
    input: ProductSetInput & { title: string }
  ): Promise<EcommerceProduct> {
    const mutation = `
      mutation ProductSetCreate($input: ProductSetInput!) {
        productSet(synchronous: true, input: $input) {
          product {
            id
            title
            descriptionHtml
            description
            vendor
            productType
            tags
            handle
            status
            createdAt
            updatedAt
            images(first: 20) {
              nodes {
                id
                url
                altText
                width
                height
              }
            }
            variants(first: 100) {
              nodes {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  id
                  unitCost {
                    amount
                  }
                }
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    // Build the productSet input
    const productSetInput: Record<string, unknown> = {
      title: input.title,
    };

    if (input.descriptionHtml !== undefined) productSetInput.descriptionHtml = input.descriptionHtml;
    if (input.vendor !== undefined) productSetInput.vendor = input.vendor;
    if (input.productType !== undefined) productSetInput.productType = input.productType;
    if (input.tags !== undefined) productSetInput.tags = input.tags;
    if (input.status !== undefined) productSetInput.status = input.status;
    if (input.handle !== undefined) productSetInput.handle = input.handle;

    // Add metafields if provided
    if (input.metafields && input.metafields.length > 0) {
      productSetInput.metafields = input.metafields.map(m => ({
        namespace: m.namespace,
        key: m.key,
        value: m.value,
        type: m.type,
      }));
    }

    // Add productOptions if provided (required when creating with variants)
    if (input.productOptions && input.productOptions.length > 0) {
      productSetInput.productOptions = input.productOptions;
    }

    // Add variants if provided
    if (input.variants && input.variants.length > 0) {
      productSetInput.variants = input.variants.map(v => {
        const variantInput: Record<string, unknown> = {
          optionValues: v.optionValues,
        };

        if (v.price !== undefined) variantInput.price = v.price;
        if (v.compareAtPrice !== undefined) variantInput.compareAtPrice = v.compareAtPrice;
        if (v.barcode !== undefined) variantInput.barcode = v.barcode;

        // SKU and cost go in inventoryItem
        if (v.sku !== undefined || v.cost !== undefined) {
          const inventoryItem: Record<string, unknown> = {};
          if (v.sku !== undefined) inventoryItem.sku = v.sku;
          if (v.cost !== undefined) inventoryItem.cost = v.cost;
          variantInput.inventoryItem = inventoryItem;
        }

        // Inventory quantities if provided
        if (v.inventoryQuantities && v.inventoryQuantities.length > 0) {
          variantInput.inventoryQuantities = v.inventoryQuantities;
        }

        return variantInput;
      });
    }

    const data = await this.graphqlRequest<{
      productSet: {
        product: Record<string, unknown> | null;
        userErrors: Array<{ field: string[]; message: string; code: string }>;
      };
    }>(mutation, {
      input: productSetInput,
    });

    if (data.productSet.userErrors.length > 0) {
      const errors = data.productSet.userErrors
        .map(e => `${e.field?.join(".")}: ${e.message} (${e.code})`)
        .join(", ");
      throw new Error(`productSetCreate failed: ${errors}`);
    }

    if (!data.productSet.product) {
      throw new Error("productSetCreate returned no product");
    }

    return this.mapShopifyProduct(data.productSet.product);
  }

  /**
   * Delete a product from the Shopify store
   */
  async deleteProduct(externalId: string): Promise<void> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const gid = externalId.startsWith("gid://")
      ? externalId
      : `gid://shopify/Product/${externalId}`;

    const mutation = `
      mutation DeleteProduct($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.request(mutation, {
      variables: { input: { id: gid } },
    });

    const data = response.data as {
      productDelete: {
        deletedProductId: string | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    };

    if (data.productDelete.userErrors.length > 0) {
      throw new Error(
        `Failed to delete product: ${data.productDelete.userErrors
          .map((e) => `${e.field}: ${e.message}`)
          .join(", ")}`
      );
    }
  }

  /**
   * Set or update product metafields
   */
  async setProductMetafields(
    externalId: string,
    metafields: Array<{
      namespace: string;
      key: string;
      value: string;
      type: string;
    }>
  ): Promise<void> {
    if (!metafields || metafields.length === 0) {
      return;
    }

    const client = new this.shopify.clients.Graphql({ session: this.session });

    const gid = externalId.startsWith("gid://")
      ? externalId
      : `gid://shopify/Product/${externalId}`;

    const mutation = `
      mutation SetProductMetafields($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const metafieldsInput = metafields.map((m) => ({
      namespace: m.namespace,
      key: m.key,
      value: m.value,
      type: m.type,
    }));

    const response = await client.request(mutation, {
      variables: {
        input: {
          id: gid,
          metafields: metafieldsInput,
        },
      },
    });

    const data = response.data as {
      productUpdate: {
        product: { id: string } | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    };

    if (data.productUpdate.userErrors.length > 0) {
      throw new Error(
        `Failed to set metafields: ${data.productUpdate.userErrors
          .map((e) => `${e.field}: ${e.message}`)
          .join(", ")}`
      );
    }
  }

  /**
   * Update product media (images and videos)
   * Deletes all existing media and uploads new ones
   */
  async updateProductMedia(
    externalId: string,
    images: Array<{ url: string; altText?: string }>,
    videos?: Array<{ url: string; altText?: string }>
  ): Promise<void> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const gid = externalId.startsWith("gid://")
      ? externalId
      : `gid://shopify/Product/${externalId}`;

    // First, get existing media IDs
    const mediaQuery = `
      query GetProductMedia($id: ID!) {
        product(id: $id) {
          media(first: 50) {
            nodes {
              id
            }
          }
        }
      }
    `;

    const mediaResponse = await client.request(mediaQuery, {
      variables: { id: gid },
    });

    const mediaData = mediaResponse.data as {
      product: {
        media: {
          nodes: Array<{ id: string }>;
        };
      } | null;
    };

    const existingMediaIds = mediaData.product?.media?.nodes?.map((m) => m.id) || [];

    // Delete existing media if any
    if (existingMediaIds.length > 0) {
      const deleteMutation = `
        mutation DeleteProductMedia($mediaIds: [ID!]!, $productId: ID!) {
          productDeleteMedia(mediaIds: $mediaIds, productId: $productId) {
            deletedMediaIds
            userErrors {
              field
              message
            }
          }
        }
      `;

      const deleteResponse = await client.request(deleteMutation, {
        variables: {
          mediaIds: existingMediaIds,
          productId: gid,
        },
      });

      const deleteData = deleteResponse.data as {
        productDeleteMedia: {
          deletedMediaIds: string[];
          userErrors: Array<{ field: string; message: string }>;
        };
      };

      if (deleteData.productDeleteMedia.userErrors.length > 0) {
        console.warn(
          `Failed to delete some media: ${deleteData.productDeleteMedia.userErrors
            .map((e) => e.message)
            .join(", ")}`
        );
      }
    }

    // Upload new media (images and videos)
    const hasMedia = images.length > 0 || (videos && videos.length > 0);
    if (hasMedia) {
      const createMutation = `
        mutation CreateProductMedia($productId: ID!, $media: [CreateMediaInput!]!) {
          productCreateMedia(productId: $productId, media: $media) {
            media {
              id
            }
            mediaUserErrors {
              field
              message
            }
          }
        }
      `;

      // Build media array with images first, then videos
      const media: Array<{
        originalSource: string;
        alt?: string;
        mediaContentType: "IMAGE" | "EXTERNAL_VIDEO";
      }> = [];

      // Add images
      for (const img of images) {
        media.push({
          originalSource: img.url,
          alt: img.altText || undefined,
          mediaContentType: "IMAGE",
        });
      }

      // Add videos (as EXTERNAL_VIDEO for YouTube/Vimeo embeds)
      if (videos) {
        for (const video of videos) {
          media.push({
            originalSource: video.url,
            alt: video.altText || undefined,
            mediaContentType: "EXTERNAL_VIDEO",
          });
        }
      }

      const createResponse = await client.request(createMutation, {
        variables: {
          productId: gid,
          media,
        },
      });

      const createData = createResponse.data as {
        productCreateMedia: {
          media: Array<{ id: string }>;
          mediaUserErrors: Array<{ field: string; message: string }>;
        };
      };

      if (createData.productCreateMedia.mediaUserErrors.length > 0) {
        throw new Error(
          `Failed to create media: ${createData.productCreateMedia.mediaUserErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }
    }
  }

  /**
   * Update a variant's price, SKU, barcode, etc.
   * Note: In API 2025-01, productVariantUpdate was removed. We use productVariantsBulkUpdate instead.
   * SKU must be set via inventoryItem in API 2025-01.
   */
  async updateVariant(
    productExternalId: string,
    variantExternalId: string,
    input: {
      price?: number;
      compareAtPrice?: number | null;
      cost?: number;
      sku?: string;
      barcode?: string;
    }
  ): Promise<void> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const productGid = productExternalId.startsWith("gid://")
      ? productExternalId
      : `gid://shopify/Product/${productExternalId}`;

    const variantGid = variantExternalId.startsWith("gid://")
      ? variantExternalId
      : `gid://shopify/ProductVariant/${variantExternalId}`;

    const mutation = `
      mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variantInput: Record<string, unknown> = {
      id: variantGid,
    };

    if (input.price !== undefined) variantInput.price = input.price.toString();
    if (input.compareAtPrice !== undefined)
      variantInput.compareAtPrice =
        input.compareAtPrice !== null ? input.compareAtPrice.toString() : null;
    if (input.barcode !== undefined) variantInput.barcode = input.barcode;

    // SKU, cost, and tracking must be set via inventoryItem in API 2025-01
    const inventoryItem: Record<string, unknown> = { tracked: true };
    if (input.sku !== undefined) inventoryItem.sku = input.sku;
    if (input.cost !== undefined) inventoryItem.cost = input.cost.toString();
    variantInput.inventoryItem = inventoryItem;

    const response = await client.request(mutation, {
      variables: {
        productId: productGid,
        variants: [variantInput],
      },
    });

    const data = response.data as {
      productVariantsBulkUpdate: {
        productVariants: Array<{ id: string }> | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    };

    if (data.productVariantsBulkUpdate.userErrors.length > 0) {
      throw new Error(
        `Failed to update variant: ${data.productVariantsBulkUpdate.userErrors
          .map((e) => `${e.field}: ${e.message}`)
          .join(", ")}`
      );
    }
  }

  // ============================================
  // Inventory
  // ============================================

  async getInventoryLevels(
    inventoryItemIds: string[]
  ): Promise<Map<string, EcommerceInventoryLevel>> {
    const client = new this.shopify.clients.Graphql({ session: this.session });
    const result = new Map<string, EcommerceInventoryLevel>();

    // Convert to GIDs if needed
    const gids = inventoryItemIds.map((id) =>
      id.startsWith("gid://") ? id : `gid://shopify/InventoryItem/${id}`
    );

    // Note: In Shopify API 2024-04+, 'available' field was replaced with 'quantities'
    const query = `
      query GetInventoryLevels($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on InventoryItem {
            id
            inventoryLevels(first: 10) {
              nodes {
                id
                quantities(names: ["available"]) {
                  name
                  quantity
                }
                location {
                  id
                }
                updatedAt
              }
            }
          }
        }
      }
    `;

    const response = await client.request(query, {
      variables: { ids: gids },
    });

    const data = response.data as {
      nodes: Array<{
        id: string;
        inventoryLevels?: {
          nodes: Array<{
            id: string;
            quantities: Array<{ name: string; quantity: number }>;
            location: { id: string };
            updatedAt: string;
          }>;
        };
      }>;
    };

    for (const node of data.nodes) {
      if (node?.inventoryLevels?.nodes) {
        // Aggregate across locations
        let totalAvailable = 0;
        let latestUpdate = new Date(0);

        for (const level of node.inventoryLevels.nodes) {
          // Find the 'available' quantity from the quantities array
          const availableQty = level.quantities.find(q => q.name === "available");
          totalAvailable += availableQty?.quantity || 0;
          const updatedAt = new Date(level.updatedAt);
          if (updatedAt > latestUpdate) {
            latestUpdate = updatedAt;
          }
        }

        const numericId = this.extractNumericId(node.id);
        result.set(numericId, {
          inventoryItemId: numericId,
          locationId: null, // Aggregated
          available: totalAvailable,
          reserved: 0, // Shopify doesn't expose this directly
          updatedAt: latestUpdate,
        });
      }
    }

    return result;
  }

  /**
   * Get inventory item IDs for a list of variant IDs.
   * Used for backfilling the inventory fast-path data.
   * @param variantIds Array of Shopify variant IDs (numeric or GID format)
   * @returns Map of variantId -> inventoryItemId
   */
  async getVariantInventoryItemIds(
    variantIds: string[]
  ): Promise<Map<string, string>> {
    const client = new this.shopify.clients.Graphql({ session: this.session });
    const result = new Map<string, string>();

    // Convert to GIDs if needed
    const gids = variantIds.map((id) =>
      id.startsWith("gid://") ? id : `gid://shopify/ProductVariant/${id}`
    );

    // Process in batches of 50 to avoid query limits
    for (let i = 0; i < gids.length; i += 50) {
      const batchGids = gids.slice(i, i + 50);

      const query = `
        query GetVariantInventoryItems($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on ProductVariant {
              id
              inventoryItem {
                id
              }
            }
          }
        }
      `;

      const response = await client.request(query, {
        variables: { ids: batchGids },
      });

      const data = response.data as {
        nodes: Array<{
          id: string;
          inventoryItem?: { id: string };
        } | null>;
      };

      for (const node of data.nodes) {
        if (node && node.inventoryItem) {
          // Extract numeric IDs from GIDs
          const variantId = node.id.replace("gid://shopify/ProductVariant/", "");
          const inventoryItemId = node.inventoryItem.id.replace(
            "gid://shopify/InventoryItem/",
            ""
          );
          result.set(variantId, inventoryItemId);
        }
      }

      // Small delay between batches to respect rate limits
      if (i + 50 < gids.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return result;
  }

  async adjustInventory(adjustment: InventoryAdjustment): Promise<void> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    // First, get the location if not provided
    let locationId = adjustment.locationId;
    if (!locationId) {
      const locQuery = `
        query GetPrimaryLocation {
          locations(first: 1) {
            nodes {
              id
            }
          }
        }
      `;
      const locResponse = await client.request(locQuery);
      const locData = locResponse.data as {
        locations: { nodes: Array<{ id: string }> };
      };
      locationId = locData.locations.nodes[0]?.id;
    }

    if (!locationId) {
      throw new Error("No location found for inventory adjustment");
    }

    const inventoryItemGid = adjustment.inventoryItemId.startsWith("gid://")
      ? adjustment.inventoryItemId
      : `gid://shopify/InventoryItem/${adjustment.inventoryItemId}`;

    const locationGid = locationId.startsWith("gid://")
      ? locationId
      : `gid://shopify/Location/${locationId}`;

    const mutation = `
      mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
        inventoryAdjustQuantities(input: $input) {
          inventoryAdjustmentGroup {
            reason
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.request(mutation, {
      variables: {
        input: {
          name: "available",
          reason: adjustment.reason || "correction",
          changes: [
            {
              inventoryItemId: inventoryItemGid,
              locationId: locationGid,
              delta: adjustment.delta,
            },
          ],
        },
      },
    });

    const data = response.data as {
      inventoryAdjustQuantities: {
        inventoryAdjustmentGroup: { reason: string } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };

    if (data.inventoryAdjustQuantities.userErrors.length > 0) {
      const errors = data.inventoryAdjustQuantities.userErrors
        .map((e) => `${e.field?.join(".")}: ${e.message}`)
        .join(", ");
      throw new Error(`Failed to adjust inventory: ${errors}`);
    }
  }

  async setInventory(
    inventoryItemId: string,
    quantity: number,
    locationId?: string
  ): Promise<void> {
    // Get current inventory to calculate delta
    const levels = await this.getInventoryLevels([inventoryItemId]);
    const numericId = this.extractNumericId(inventoryItemId);
    const current = levels.get(numericId);

    // If inventory item not found, we still try to set it
    // This handles cases where the inventory item exists but has no levels yet
    const currentQty = current?.available ?? 0;
    const delta = quantity - currentQty;

    if (delta !== 0) {
      await this.adjustInventory({
        inventoryItemId,
        locationId,
        delta,
        reason: "correction",
      });
    }
  }

  // ============================================
  // Orders
  // ============================================

  async createOrder(input: CreateOrderInput): Promise<EcommerceOrder> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    // Use orderCreate mutation which requires write_orders scope (not write_draft_orders)
    const mutation = `
      mutation CreateOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          order {
            id
            name
            createdAt
            updatedAt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Currency for the order (default to USD)
    const currencyCode = input.currency || "USD";

    // Build line items for orderCreate
    // When specifying a currency, we need to provide both shopMoney and presentmentMoney
    const lineItems = input.lineItems.map((item) => ({
      variantId: item.variantExternalId.startsWith("gid://")
        ? item.variantExternalId
        : `gid://shopify/ProductVariant/${item.variantExternalId}`,
      quantity: item.quantity,
      priceSet: item.price
        ? {
            shopMoney: {
              amount: item.price.toString(),
              currencyCode,
            },
            presentmentMoney: {
              amount: item.price.toString(),
              currencyCode,
            },
          }
        : undefined,
    }));

    // Helper to validate phone - Shopify requires E.164 format (+1234567890)
    const formatPhone = (
      phone: string | null | undefined
    ): string | undefined => {
      if (!phone || phone.trim() === "") return undefined;
      // E.164 format: starts with +, followed by 7-15 digits
      const e164Regex = /^\+[1-9]\d{6,14}$/;
      const cleaned = phone.replace(/[\s\-().]/g, ""); // Remove common formatting
      if (e164Regex.test(cleaned)) {
        return cleaned;
      }
      // If not valid E.164, return undefined - Shopify will reject invalid formats
      return undefined;
    };

    // Build addresses for orderCreate
    const shippingAddress = {
      firstName: input.shippingAddress.firstName || "",
      lastName: input.shippingAddress.lastName || "",
      company: input.shippingAddress.company || null,
      address1: input.shippingAddress.address1,
      address2: input.shippingAddress.address2 || null,
      city: input.shippingAddress.city,
      provinceCode: input.shippingAddress.province || null,
      countryCode: input.shippingAddress.country,
      zip: input.shippingAddress.postalCode,
      phone: formatPhone(input.shippingAddress.phone),
    };

    const billingAddress = input.billingAddress
      ? {
          firstName: input.billingAddress.firstName || "",
          lastName: input.billingAddress.lastName || "",
          company: input.billingAddress.company || null,
          address1: input.billingAddress.address1,
          address2: input.billingAddress.address2 || null,
          city: input.billingAddress.city,
          provinceCode: input.billingAddress.province || null,
          countryCode: input.billingAddress.country,
          zip: input.billingAddress.postalCode,
          phone: formatPhone(input.billingAddress.phone),
        }
      : shippingAddress;

    const response = await client.request(mutation, {
      variables: {
        order: {
          currency: currencyCode,
          lineItems,
          shippingAddress,
          billingAddress,
          email: input.email || null,
          phone: formatPhone(input.phone),
          note: input.note || null,
          tags: input.tags || [],
          // Set financial status based on isPaid
          financialStatus: input.isPaid ? "PAID" : "PENDING",
        },
        options: {
          // Don't send confirmation emails for B2B orders
          sendReceipt: false,
          sendFulfillmentReceipt: false,
        },
      },
    });

    const data = response.data as {
      orderCreate: {
        order: { id: string; name: string } | null;
        userErrors: Array<{ field: string; message: string }>;
      };
    };

    if (data.orderCreate.userErrors.length > 0) {
      throw new Error(
        `Failed to create order: ${data.orderCreate.userErrors
          .map((e) => e.message)
          .join(", ")}`
      );
    }

    const orderId = data.orderCreate.order?.id;
    if (!orderId) {
      throw new Error("Failed to create order");
    }

    // Fetch and return the complete order
    const order = await this.getOrder(orderId);
    if (!order) {
      throw new Error("Order created but could not be fetched");
    }

    return order;
  }

  async getOrder(externalId: string): Promise<EcommerceOrder | null> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const gid = externalId.startsWith("gid://")
      ? externalId
      : `gid://shopify/Order/${externalId}`;

    const query = `
      query GetOrder($id: ID!) {
        order(id: $id) {
          id
          name
          email
          phone
          note
          tags
          createdAt
          updatedAt
          displayFinancialStatus
          displayFulfillmentStatus
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
            }
          }
          totalShippingPriceSet {
            shopMoney {
              amount
            }
          }
          totalDiscountsSet {
            shopMoney {
              amount
            }
          }
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          shippingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            provinceCode
            country
            countryCodeV2
            zip
            phone
          }
          billingAddress {
            firstName
            lastName
            company
            address1
            address2
            city
            province
            provinceCode
            country
            countryCodeV2
            zip
            phone
          }
          lineItems(first: 100) {
            nodes {
              id
              title
              variantTitle
              sku
              quantity
              originalUnitPriceSet {
                shopMoney {
                  amount
                }
              }
              originalTotalSet {
                shopMoney {
                  amount
                }
              }
              requiresShipping
              variant {
                id
                product {
                  id
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.request(query, {
      variables: { id: gid },
    });

    const data = response.data as { order: Record<string, unknown> | null };

    if (!data.order) {
      return null;
    }

    return this.mapShopifyOrder(data.order);
  }

  async cancelOrder(externalId: string, reason?: string): Promise<void> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const gid = externalId.startsWith("gid://")
      ? externalId
      : `gid://shopify/Order/${externalId}`;

    const mutation = `
      mutation CancelOrder($orderId: ID!, $reason: OrderCancelReason!, $notifyCustomer: Boolean) {
        orderCancel(orderId: $orderId, reason: $reason, notifyCustomer: $notifyCustomer) {
          orderCancelUserErrors {
            field
            message
          }
        }
      }
    `;

    await client.request(mutation, {
      variables: {
        orderId: gid,
        reason: "OTHER",
        notifyCustomer: false,
      },
    });
  }

  async fulfillOrder(
    externalId: string,
    trackingInfo?: {
      trackingNumber?: string;
      trackingUrl?: string;
      carrier?: string;
    }
  ): Promise<void> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const gid = externalId.startsWith("gid://")
      ? externalId
      : `gid://shopify/Order/${externalId}`;

    // First, get fulfillment order
    const foQuery = `
      query GetFulfillmentOrders($orderId: ID!) {
        order(id: $orderId) {
          fulfillmentOrders(first: 10) {
            nodes {
              id
              status
              lineItems(first: 100) {
                nodes {
                  id
                  remainingQuantity
                }
              }
            }
          }
        }
      }
    `;

    const foResponse = await client.request(foQuery, {
      variables: { orderId: gid },
    });

    const foData = foResponse.data as {
      order: {
        fulfillmentOrders: {
          nodes: Array<{
            id: string;
            status: string;
            lineItems: { nodes: Array<{ id: string; remainingQuantity: number }> };
          }>;
        };
      };
    };

    const fulfillmentOrder = foData.order?.fulfillmentOrders?.nodes?.find(
      (fo) => fo.status === "OPEN" || fo.status === "IN_PROGRESS"
    );

    if (!fulfillmentOrder) {
      throw new Error("No fulfillable order found");
    }

    const mutation = `
      mutation FulfillOrder($fulfillment: FulfillmentInput!) {
        fulfillmentCreate(fulfillment: $fulfillment) {
          fulfillment {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    await client.request(mutation, {
      variables: {
        fulfillment: {
          lineItemsByFulfillmentOrder: [
            {
              fulfillmentOrderId: fulfillmentOrder.id,
              fulfillmentOrderLineItems: fulfillmentOrder.lineItems.nodes
                .filter((li) => li.remainingQuantity > 0)
                .map((li) => ({
                  id: li.id,
                  quantity: li.remainingQuantity,
                })),
            },
          ],
          trackingInfo: trackingInfo
            ? {
                number: trackingInfo.trackingNumber,
                url: trackingInfo.trackingUrl,
                company: trackingInfo.carrier,
              }
            : undefined,
        },
      },
    });
  }

  // ============================================
  // Webhooks
  // ============================================

  async registerWebhooks(
    topics: EcommerceWebhookTopic[],
    callbackUrl: string
  ): Promise<void> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const topicMapping: Record<EcommerceWebhookTopic, string> = {
      "products/create": "PRODUCTS_CREATE",
      "products/update": "PRODUCTS_UPDATE",
      "products/delete": "PRODUCTS_DELETE",
      "inventory_levels/update": "INVENTORY_LEVELS_UPDATE",
      "orders/create": "ORDERS_CREATE",
      "orders/updated": "ORDERS_UPDATED",
      "orders/fulfilled": "ORDERS_FULFILLED",
      "orders/cancelled": "ORDERS_CANCELLED",
    };

    for (const topic of topics) {
      const mutation = `
        mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      await client.request(mutation, {
        variables: {
          topic: topicMapping[topic],
          webhookSubscription: {
            callbackUrl,
            format: "JSON",
          },
        },
      });
    }
  }

  async verifyWebhook(request: Request): Promise<boolean> {
    if (!this.config.webhookSecret) {
      console.warn("Webhook secret not configured");
      return false;
    }

    const hmacHeader = request.headers.get("X-Shopify-Hmac-SHA256");
    if (!hmacHeader) {
      return false;
    }

    const body = await request.clone().text();

    // Use Web Crypto API for HMAC verification
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.config.webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const computedHmac = btoa(
      String.fromCharCode(...new Uint8Array(signature))
    );

    return computedHmac === hmacHeader;
  }

  async parseWebhook(request: Request): Promise<EcommerceWebhookPayload | null> {
    const topic = request.headers.get("X-Shopify-Topic") as EcommerceWebhookTopic;
    const shopDomain = request.headers.get("X-Shopify-Shop-Domain");

    if (!topic || !shopDomain) {
      return null;
    }

    const data = await request.json();

    return {
      topic,
      shopId: shopDomain,
      data: data as Record<string, unknown>,
      timestamp: new Date(),
    };
  }

  // ============================================
  // Connection
  // ============================================

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      await this.getShopInfo();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getShopInfo(): Promise<{
    id: string;
    name: string;
    domain: string;
    email: string | null;
    currency: string;
    timezone: string | null;
  }> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    const query = `
      query GetShop {
        shop {
          id
          name
          myshopifyDomain
          email
          currencyCode
          timezoneAbbreviation
        }
      }
    `;

    const response = await client.request(query);
    const data = response.data as {
      shop: {
        id: string;
        name: string;
        myshopifyDomain: string;
        email: string;
        currencyCode: string;
        timezoneAbbreviation: string;
      };
    };

    return {
      id: this.extractNumericId(data.shop.id),
      name: data.shop.name,
      domain: data.shop.myshopifyDomain,
      email: data.shop.email,
      currency: data.shop.currencyCode,
      timezone: data.shop.timezoneAbbreviation,
    };
  }

  // ============================================
  // Shipping
  // ============================================

  async getShippingZones(): Promise<EcommerceShippingData | null> {
    const client = new this.shopify.clients.Graphql({ session: this.session });

    // First get the shop currency
    const shopInfo = await this.getShopInfo();

    const query = `
      query GetDeliveryProfiles {
        deliveryProfiles(first: 20) {
          nodes {
            id
            name
            default
            profileLocationGroups {
              locationGroup {
                id
              }
              locationGroupZones(first: 50) {
                nodes {
                  zone {
                    id
                    name
                    countries {
                      code {
                        countryCode
                        restOfWorld
                      }
                      provinces {
                        name
                        code
                      }
                    }
                  }
                  methodDefinitions(first: 20) {
                    nodes {
                      id
                      active
                      name
                      description
                      rateProvider {
                        __typename
                        ... on DeliveryRateDefinition {
                          id
                          price {
                            amount
                            currencyCode
                          }
                        }
                      }
                      methodConditions {
                        field
                        operator
                        conditionCriteria {
                          __typename
                          ... on MoneyV2 {
                            amount
                            currencyCode
                          }
                          ... on Weight {
                            unit
                            value
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await client.request(query);
    const data = response.data as {
      deliveryProfiles: {
        nodes: Array<{
          id: string;
          name: string;
          default: boolean;
          profileLocationGroups: Array<{
            locationGroup: { id: string };
            locationGroupZones: {
              nodes: Array<{
                zone: {
                  id: string;
                  name: string;
                  countries: Array<{
                    code: {
                      countryCode: string;
                      restOfWorld: boolean;
                    };
                    provinces: Array<{
                      name: string;
                      code: string;
                    }>;
                  }>;
                };
                methodDefinitions: {
                  nodes: Array<{
                    id: string;
                    active: boolean;
                    name: string;
                    description: string | null;
                    rateProvider: {
                      __typename: string;
                      id?: string;
                      price?: {
                        amount: string;
                        currencyCode: string;
                      };
                    } | null;
                    methodConditions: Array<{
                      field: string;
                      operator: string;
                      conditionCriteria: {
                        __typename: string;
                        amount?: string;
                        currencyCode?: string;
                        unit?: string;
                        value?: number;
                      };
                    }>;
                  }>;
                };
              }>;
            };
          }>;
        }>;
      };
    };

    // Collect all zones from all profiles (merge duplicates by zone ID)
    const zoneMap = new Map<string, EcommerceShippingZone>();

    for (const profile of data.deliveryProfiles.nodes) {
      for (const locationGroup of profile.profileLocationGroups) {
        for (const lgZone of locationGroup.locationGroupZones.nodes) {
          const zoneId = lgZone.zone.id;

          // Map countries
          const countries: EcommerceShippingCountry[] = lgZone.zone.countries.map(
            (country) => ({
              code: country.code.countryCode,
              restOfWorld: country.code.restOfWorld,
              provinces: country.provinces.map((p) => ({
                name: p.name,
                code: p.code,
              })),
            })
          );

          // Map methods
          const methods: EcommerceShippingMethod[] =
            lgZone.methodDefinitions.nodes.map((method) => {
              // Map conditions
              const conditions: EcommerceShippingRateCondition[] =
                method.methodConditions.map((cond) => {
                  const isWeight = cond.conditionCriteria.__typename === "Weight";
                  return {
                    field: cond.field as "TOTAL_WEIGHT" | "TOTAL_PRICE",
                    operator: cond.operator as
                      | "GREATER_THAN_OR_EQUAL_TO"
                      | "LESS_THAN_OR_EQUAL_TO",
                    value: isWeight
                      ? {
                          type: "weight" as const,
                          value: cond.conditionCriteria.value || 0,
                          unit: cond.conditionCriteria.unit || "KILOGRAMS",
                        }
                      : {
                          type: "money" as const,
                          amount: cond.conditionCriteria.amount || "0",
                          currencyCode:
                            cond.conditionCriteria.currencyCode || shopInfo.currency,
                        },
                  };
                });

              // Get rate amount from rateProvider
              let rateAmount: string | null = null;
              let rateCurrency: string | null = null;
              if (
                method.rateProvider?.__typename === "DeliveryRateDefinition" &&
                method.rateProvider.price
              ) {
                rateAmount = method.rateProvider.price.amount;
                rateCurrency = method.rateProvider.price.currencyCode;
              }

              return {
                externalId: this.extractNumericId(method.id),
                name: method.name || method.description || "Shipping",
                active: method.active,
                rateAmount,
                rateCurrency,
                conditions,
              };
            });

          // Check if we already have this zone (merge methods if so)
          const existingZone = zoneMap.get(zoneId);
          if (existingZone) {
            // Merge methods, avoiding duplicates by ID
            const existingMethodIds = new Set(
              existingZone.methods.map((m) => m.externalId)
            );
            for (const method of methods) {
              if (!existingMethodIds.has(method.externalId)) {
                existingZone.methods.push(method);
              }
            }
          } else {
            zoneMap.set(zoneId, {
              externalId: this.extractNumericId(zoneId),
              name: lgZone.zone.name,
              countries,
              methods,
            });
          }
        }
      }
    }

    return {
      zones: Array.from(zoneMap.values()),
      currency: shopInfo.currency,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private extractNumericId(gid: string): string {
    const parts = gid.split("/");
    return parts[parts.length - 1] ?? gid;
  }

  private mapShopifyProduct(node: Record<string, unknown>): EcommerceProduct {
    const images = (
      node.images as { nodes: Array<Record<string, unknown>> }
    ).nodes.map((img, index) => this.mapShopifyImage(img, index));

    const variants = (
      node.variants as { nodes: Array<Record<string, unknown>> }
    ).nodes.map((v) => this.mapShopifyVariant(v));

    return {
      externalId: this.extractNumericId(node.id as string),
      title: node.title as string,
      description: node.descriptionHtml as string,
      descriptionPlainText: node.description as string,
      vendor: (node.vendor as string) || null,
      productType: (node.productType as string) || null,
      tags: node.tags as string[],
      images,
      variants,
      status: this.mapProductStatus(node.status as string),
      handle: (node.handle as string) || null,
      createdAt: new Date(node.createdAt as string),
      updatedAt: new Date(node.updatedAt as string),
      metadata: {},
    };
  }

  private mapShopifyImage(
    node: Record<string, unknown>,
    index: number
  ): EcommerceImage {
    return {
      externalId: this.extractNumericId(node.id as string),
      url: node.url as string,
      altText: (node.altText as string) || null,
      position: index,
      width: (node.width as number) || null,
      height: (node.height as number) || null,
    };
  }

  private mapShopifyVariant(node: Record<string, unknown>): EcommerceVariant {
    const selectedOptions = node.selectedOptions as Array<{
      name: string;
      value: string;
    }>;
    const attributes: Record<string, string> = {};
    for (const opt of selectedOptions || []) {
      attributes[opt.name] = opt.value;
    }

    const inventoryItem = node.inventoryItem as {
      id: string;
      unitCost?: { amount: string };
    } | null;

    return {
      externalId: this.extractNumericId(node.id as string),
      sku: (node.sku as string) || null,
      title: node.title as string,
      barcode: (node.barcode as string) || null,
      price: parseFloat(node.price as string),
      compareAtPrice: node.compareAtPrice
        ? parseFloat(node.compareAtPrice as string)
        : null,
      costPrice: inventoryItem?.unitCost
        ? parseFloat(inventoryItem.unitCost.amount)
        : null,
      currency: "USD", // Will be overridden by shop currency
      inventoryQuantity: (node.inventoryQuantity as number) || 0,
      weight: (node.weight as number) || null,
      weightUnit: ((node.weightUnit as string) || "KILOGRAMS").toLowerCase(),
      attributes,
      requiresShipping: (node.requiresShipping as boolean) ?? true,
      inventoryItemId: inventoryItem
        ? this.extractNumericId(inventoryItem.id)
        : null,
    };
  }

  private mapShopifyOrder(node: Record<string, unknown>): EcommerceOrder {
    const lineItems = (
      node.lineItems as { nodes: Array<Record<string, unknown>> }
    ).nodes.map((li) => this.mapShopifyLineItem(li));

    const priceSet = node.totalPriceSet as {
      shopMoney: { amount: string; currencyCode: string };
    };

    return {
      externalId: this.extractNumericId(node.id as string),
      orderNumber: node.name as string,
      lineItems,
      shippingAddress: node.shippingAddress
        ? this.mapShopifyAddress(node.shippingAddress as Record<string, unknown>)
        : null,
      billingAddress: node.billingAddress
        ? this.mapShopifyAddress(node.billingAddress as Record<string, unknown>)
        : null,
      email: (node.email as string) || null,
      phone: (node.phone as string) || null,
      note: (node.note as string) || null,
      subtotal: parseFloat(
        (node.subtotalPriceSet as { shopMoney: { amount: string } }).shopMoney
          .amount
      ),
      totalTax: parseFloat(
        (node.totalTaxSet as { shopMoney: { amount: string } }).shopMoney.amount
      ),
      shippingCost: parseFloat(
        (node.totalShippingPriceSet as { shopMoney: { amount: string } })
          .shopMoney.amount
      ),
      totalDiscount: parseFloat(
        (node.totalDiscountsSet as { shopMoney: { amount: string } }).shopMoney
          .amount
      ),
      total: parseFloat(priceSet.shopMoney.amount),
      currency: priceSet.shopMoney.currencyCode,
      financialStatus: this.mapFinancialStatus(
        node.displayFinancialStatus as string
      ),
      fulfillmentStatus: this.mapFulfillmentStatus(
        node.displayFulfillmentStatus as string
      ),
      tags: (node.tags as string[]) || [],
      createdAt: new Date(node.createdAt as string),
      updatedAt: new Date(node.updatedAt as string),
    };
  }

  private mapShopifyLineItem(node: Record<string, unknown>): EcommerceLineItem {
    const variant = node.variant as {
      id: string;
      product: { id: string };
    } | null;

    return {
      externalId: this.extractNumericId(node.id as string),
      variantExternalId: variant ? this.extractNumericId(variant.id) : "",
      productExternalId: variant
        ? this.extractNumericId(variant.product.id)
        : "",
      title: node.title as string,
      variantTitle: (node.variantTitle as string) || null,
      sku: (node.sku as string) || null,
      quantity: node.quantity as number,
      price: parseFloat(
        (node.originalUnitPriceSet as { shopMoney: { amount: string } })
          .shopMoney.amount
      ),
      totalPrice: parseFloat(
        (node.originalTotalSet as { shopMoney: { amount: string } }).shopMoney
          .amount
      ),
      requiresShipping: (node.requiresShipping as boolean) ?? true,
      fulfillmentStatus: null,
    };
  }

  private mapShopifyAddress(node: Record<string, unknown>): EcommerceAddress {
    return {
      firstName: (node.firstName as string) || null,
      lastName: (node.lastName as string) || null,
      company: (node.company as string) || null,
      address1: node.address1 as string,
      address2: (node.address2 as string) || null,
      city: node.city as string,
      province: (node.province as string) || null,
      provinceCode: (node.provinceCode as string) || null,
      country: node.country as string,
      countryCode: (node.countryCodeV2 as string) || (node.country as string),
      postalCode: node.zip as string,
      phone: (node.phone as string) || null,
    };
  }

  private mapProductStatus(
    status: string
  ): "active" | "draft" | "archived" {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return "active";
      case "DRAFT":
        return "draft";
      case "ARCHIVED":
        return "archived";
      default:
        return "draft";
    }
  }

  private mapFinancialStatus(
    status: string
  ): "pending" | "paid" | "partially_paid" | "refunded" | "voided" {
    switch (status?.toUpperCase()) {
      case "PAID":
        return "paid";
      case "PARTIALLY_PAID":
        return "partially_paid";
      case "REFUNDED":
        return "refunded";
      case "VOIDED":
        return "voided";
      default:
        return "pending";
    }
  }

  private mapFulfillmentStatus(
    status: string
  ): "fulfilled" | "partial" | "unfulfilled" | null {
    switch (status?.toUpperCase()) {
      case "FULFILLED":
        return "fulfilled";
      case "PARTIAL":
      case "PARTIALLY_FULFILLED":
        return "partial";
      case "UNFULFILLED":
        return "unfulfilled";
      default:
        return null;
    }
  }
}
