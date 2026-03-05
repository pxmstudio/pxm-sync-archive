import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, ilike, or, desc, asc, isNull, inArray } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk";
import {
  feeds,
  feedSubscriptions,
  feedSubscriptionSyncSettings,
  feedSyncedProducts,
  products,
  integrations,
  organizations,
} from "@workspace/db";
import { success, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";
import { ShopifyAdapter } from "@workspace/adapters/ecommerce";
import { getCredentials } from "../../lib/credentials.js";
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// Shop Products Query Schema
// ============================================

const shopProductsQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  brands: z.string().optional(), // comma-separated list
  productTypes: z.string().optional(), // comma-separated list
  feedIds: z.string().optional(), // comma-separated list
  sortBy: z.enum(["name", "price", "updatedAt"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================
// GET /internal/shop/products
// ============================================

app.get(
  "/products",
  zValidator("query", shopProductsQuery),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const {
      page,
      limit,
      search,
      brands: brandsParam,
      productTypes: productTypesParam,
      feedIds: feedIdsParam,
      sortBy,
      sortOrder,
    } = c.req.valid("query");

    // Get all active feed subscriptions for this retailer
    const subscriptions = await db.query.feedSubscriptions.findMany({
      where: and(
        eq(feedSubscriptions.retailerId, auth.organizationId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (subscriptions.length === 0) {
      return paginated(c, [], { page, limit, total: 0 });
    }

    const subscribedFeedIds = subscriptions.map((s) => s.feedId);

    // Parse filter arrays
    const brandFilters = brandsParam ? brandsParam.split(",").filter(Boolean) : [];
    const productTypeFilters = productTypesParam
      ? productTypesParam.split(",").filter(Boolean)
      : [];
    const feedIdFilters = feedIdsParam ? feedIdsParam.split(",").filter(Boolean) : [];

    // Filter feedIds to only include subscribed feeds
    const effectiveFeedIds =
      feedIdFilters.length > 0
        ? feedIdFilters.filter((id) => subscribedFeedIds.includes(id))
        : subscribedFeedIds;

    if (effectiveFeedIds.length === 0) {
      return paginated(c, [], { page, limit, total: 0 });
    }

    // Build where conditions
    const conditions = [
      inArray(products.feedId, effectiveFeedIds),
      eq(products.isActive, "true"),
      isNull(products.deletedAt),
    ];

    if (search) {
      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.description, `%${search}%`)
        )!
      );
    }

    if (brandFilters.length > 0) {
      conditions.push(inArray(products.brand, brandFilters));
    }

    if (productTypeFilters.length > 0) {
      conditions.push(inArray(products.productType, productTypeFilters));
    }

    // Build orderBy
    const orderFn = sortOrder === "asc" ? asc : desc;
    let orderBy;
    switch (sortBy) {
      case "name":
        orderBy = [orderFn(products.name)];
        break;
      case "updatedAt":
      default:
        orderBy = [orderFn(products.updatedAt)];
        break;
    }

    // Fetch products with variants and feed info
    const [items, countResult] = await Promise.all([
      db.query.products.findMany({
        where: and(...conditions),
        with: {
          variants: {
            columns: {
              id: true,
              sku: true,
              name: true,
              attributes: true,
              price: true,
              compareAtPrice: true,
              currency: true,
            },
            with: {
              inventory: true,
            },
          },
          feed: {
            columns: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
        orderBy,
        limit,
        offset: (page - 1) * limit,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(and(...conditions)),
    ]);

    // Get sync settings for each subscription
    const syncSettingsMap = new Map<
      string,
      { syncSettingsId: string; shopDomain: string | null }
    >();
    const syncSettingsList = await db.query.feedSubscriptionSyncSettings.findMany({
      where: inArray(
        feedSubscriptionSyncSettings.subscriptionId,
        subscriptions.map((s) => s.id)
      ),
      with: {
        integration: {
          columns: {
            externalIdentifier: true,
          },
        },
        subscription: {
          columns: {
            feedId: true,
          },
        },
      },
    });

    for (const ss of syncSettingsList) {
      syncSettingsMap.set(ss.subscription.feedId, {
        syncSettingsId: ss.id,
        shopDomain: ss.integration?.externalIdentifier ?? null,
      });
    }

    // Get synced product info
    const productIds = items.map((p) => p.id);
    const syncedProductMap = new Map<
      string,
      { externalProductId: string; syncStatus: string }
    >();

    if (productIds.length > 0) {
      const syncSettingsIds = [...syncSettingsMap.values()].map((s) => s.syncSettingsId);
      if (syncSettingsIds.length > 0) {
        const syncedProducts = await db
          .selectDistinctOn([feedSyncedProducts.sourceProductId], {
            sourceProductId: feedSyncedProducts.sourceProductId,
            externalProductId: feedSyncedProducts.externalProductId,
            syncStatus: feedSyncedProducts.syncStatus,
          })
          .from(feedSyncedProducts)
          .where(
            and(
              inArray(feedSyncedProducts.syncSettingsId, syncSettingsIds),
              inArray(feedSyncedProducts.sourceProductId, productIds)
            )
          );

        for (const sp of syncedProducts) {
          if (sp.externalProductId) {
            syncedProductMap.set(sp.sourceProductId, {
              externalProductId: sp.externalProductId,
              syncStatus: sp.syncStatus,
            });
          }
        }
      }
    }

    // Transform products
    const transformedProducts = items.map((product) => {
      const imageUrls = Array.isArray(product.images)
        ? product.images
            .map((img: { url?: string } | string) =>
              typeof img === "string" ? img : img?.url
            )
            .filter((url): url is string => !!url)
        : [];

      const syncInfo = syncedProductMap.get(product.id);
      const feedSyncSettings = product.feedId
        ? syncSettingsMap.get(product.feedId)
        : null;
      const isSynced = !!syncInfo?.externalProductId;

      // Build Shopify admin URL
      let shopifyAdminUrl: string | null = null;
      if (isSynced && feedSyncSettings?.shopDomain && syncInfo?.externalProductId) {
        const storeName = feedSyncSettings.shopDomain.replace(".myshopify.com", "");
        const gidMatch = syncInfo.externalProductId.match(/\/Product\/(\d+)/);
        const productId = gidMatch ? gidMatch[1] : syncInfo.externalProductId;
        shopifyAdminUrl = `https://admin.shopify.com/store/${storeName}/products/${productId}`;
      }

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        brand: product.brand,
        productType: product.productType,
        tags: product.tags,
        images: imageUrls,
        variants: product.variants.map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          attributes: variant.attributes,
          price: variant.price ? Number(variant.price) : null,
          compareAtPrice: variant.compareAtPrice ? Number(variant.compareAtPrice) : null,
          currency: variant.currency,
          quantity: variant.inventory ? Number(variant.inventory.quantity) : 0,
          reserved: variant.inventory ? Number(variant.inventory.reserved) : 0,
          available: variant.inventory
            ? Number(variant.inventory.quantity) - Number(variant.inventory.reserved)
            : 0,
        })),
        feed: product.feed
          ? {
              id: product.feed.id,
              name: product.feed.name,
              logoUrl: product.feed.logoUrl,
            }
          : null,
        syncStatus: isSynced
          ? { synced: true, status: syncInfo?.syncStatus, shopifyAdminUrl }
          : null,
      };
    });

    return paginated(c, transformedProducts, {
      page,
      limit,
      total: countResult[0]?.count ?? 0,
    });
  }
);

// ============================================
// GET /internal/shop/facets
// ============================================

const facetsQuery = z.object({
  feedIds: z.string().optional(), // comma-separated list of feed IDs to filter brands/productTypes
});

app.get("/facets", zValidator("query", facetsQuery), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const { feedIds: feedIdsParam } = c.req.valid("query");

  // Get all active feed subscriptions for this retailer
  const subscriptions = await db.query.feedSubscriptions.findMany({
    where: and(
      eq(feedSubscriptions.retailerId, auth.organizationId),
      eq(feedSubscriptions.isActive, true)
    ),
  });

  if (subscriptions.length === 0) {
    return success(c, {
      feeds: [],
      brands: [],
      productTypes: [],
    });
  }

  const subscribedFeedIds = subscriptions.map((s) => s.feedId);

  // Parse selected feed IDs filter
  const selectedFeedIds = feedIdsParam ? feedIdsParam.split(",").filter(Boolean) : [];

  // For brands and product types, use selected feeds if provided, otherwise use all subscribed feeds
  const effectiveFeedIdsForFacets =
    selectedFeedIds.length > 0
      ? selectedFeedIds.filter((id) => subscribedFeedIds.includes(id))
      : subscribedFeedIds;

  // Get feeds with product counts (always show all subscribed feeds)
  const feedsWithCounts = await db
    .select({
      id: feeds.id,
      name: feeds.name,
      logoUrl: feeds.logoUrl,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(feeds)
    .leftJoin(
      products,
      and(
        eq(products.feedId, feeds.id),
        eq(products.isActive, "true"),
        isNull(products.deletedAt)
      )
    )
    .where(inArray(feeds.id, subscribedFeedIds))
    .groupBy(feeds.id, feeds.name, feeds.logoUrl)
    .orderBy(feeds.name);

  // Get brands with counts (filtered by selected feeds)
  const brands = await db
    .select({
      name: products.brand,
      productCount: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(
      and(
        inArray(products.feedId, effectiveFeedIdsForFacets),
        eq(products.isActive, "true"),
        isNull(products.deletedAt),
        sql`${products.brand} IS NOT NULL AND ${products.brand} != ''`
      )
    )
    .groupBy(products.brand)
    .orderBy(products.brand);

  // Get product types with counts (filtered by selected feeds)
  const productTypes = await db
    .select({
      name: products.productType,
      productCount: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(
      and(
        inArray(products.feedId, effectiveFeedIdsForFacets),
        eq(products.isActive, "true"),
        isNull(products.deletedAt),
        sql`${products.productType} IS NOT NULL AND ${products.productType} != ''`
      )
    )
    .groupBy(products.productType)
    .orderBy(products.productType);

  return success(c, {
    feeds: feedsWithCounts,
    brands: brands.filter((b) => b.name),
    productTypes: productTypes.filter((t) => t.name),
  });
});

// ============================================
// Compare Products Query Schema
// ============================================

const compareProductsQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  search: z.string().optional(),
  brands: z.string().optional(),
  productTypes: z.string().optional(),
  feedIds: z.string().optional(),
  showOnlyDifferences: z.coerce.boolean().default(false),
  sortBy: z.enum(["name", "updatedAt", "syncStatus"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================
// GET /internal/shop/products/compare
// ============================================

app.get(
  "/products/compare",
  zValidator("query", compareProductsQuery),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const env = c.env;
    const {
      page,
      limit,
      search,
      brands: brandsParam,
      productTypes: productTypesParam,
      feedIds: feedIdsParam,
      showOnlyDifferences,
      sortBy,
      sortOrder,
    } = c.req.valid("query");

    // Get organization's global sync settings (for fallback when feed-level settings are empty)
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, auth.organizationId),
      columns: { settings: true },
    });
    const globalSyncSettings = (org?.settings as { syncSettings?: {
      pricingMargin?: typeof feedSubscriptionSyncSettings.$inferSelect.pricingMargin;
      fieldLocks?: typeof feedSubscriptionSyncSettings.$inferSelect.fieldLocks;
    } } | undefined)?.syncSettings;

    // Get all active feed subscriptions for this retailer
    const subscriptions = await db.query.feedSubscriptions.findMany({
      where: and(
        eq(feedSubscriptions.retailerId, auth.organizationId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (subscriptions.length === 0) {
      return success(c, {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        summary: { total: 0, synced: 0, withDifferences: 0, failed: 0, pending: 0, neverSynced: 0 },
      });
    }

    const subscribedFeedIds = subscriptions.map((s) => s.feedId);

    // Parse filter arrays
    const brandFilters = brandsParam ? brandsParam.split(",").filter(Boolean) : [];
    const productTypeFilters = productTypesParam
      ? productTypesParam.split(",").filter(Boolean)
      : [];
    const feedIdFilters = feedIdsParam ? feedIdsParam.split(",").filter(Boolean) : [];

    const effectiveFeedIds =
      feedIdFilters.length > 0
        ? feedIdFilters.filter((id) => subscribedFeedIds.includes(id))
        : subscribedFeedIds;

    if (effectiveFeedIds.length === 0) {
      return success(c, {
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        summary: { total: 0, synced: 0, withDifferences: 0, failed: 0, pending: 0, neverSynced: 0 },
      });
    }

    // Get sync settings for Shopify ID search (needed before building conditions)
    const syncSettingsList = await db.query.feedSubscriptionSyncSettings.findMany({
      where: inArray(
        feedSubscriptionSyncSettings.subscriptionId,
        subscriptions.map((s) => s.id)
      ),
      with: {
        integration: true,
        subscription: {
          columns: {
            feedId: true,
          },
        },
      },
    });

    // Build a map: feedId -> { syncSettingsId, shopDomain, integration, settings }
    const syncSettingsMap = new Map<
      string,
      {
        syncSettingsId: string;
        shopDomain: string | null;
        integration: typeof syncSettingsList[0]["integration"] | null;
        settings: typeof syncSettingsList[0];
      }
    >();

    for (const ss of syncSettingsList) {
      syncSettingsMap.set(ss.subscription.feedId, {
        syncSettingsId: ss.id,
        shopDomain: ss.integration?.externalIdentifier ?? null,
        integration: ss.integration,
        settings: ss,
      });
    }

    // Build where conditions
    const conditions = [
      inArray(products.feedId, effectiveFeedIds),
      eq(products.isActive, "true"),
      isNull(products.deletedAt),
    ];

    // Handle search - include Shopify ID and handle search
    let shopifyIdMatchProductIds: string[] = [];
    if (search) {
      // Check if search looks like a Shopify ID (numeric) or GID
      const isShopifyIdSearch = /^\d+$/.test(search) || search.includes("gid://shopify");

      if (isShopifyIdSearch) {
        // Search in feed_synced_products for matching Shopify product IDs
        const syncSettingsIds = [...syncSettingsMap.values()].map((s) => s.syncSettingsId);
        if (syncSettingsIds.length > 0) {
          const shopifyMatches = await db
            .selectDistinct({ sourceProductId: feedSyncedProducts.sourceProductId })
            .from(feedSyncedProducts)
            .where(
              and(
                inArray(feedSyncedProducts.syncSettingsId, syncSettingsIds),
                // Match numeric ID anywhere in the GID
                ilike(feedSyncedProducts.externalProductId, `%${search}%`)
              )
            );
          shopifyIdMatchProductIds = shopifyMatches.map((m) => m.sourceProductId);
        }
      }

      // Build search condition - either match in product fields OR match Shopify ID
      const searchConditions = [
        ilike(products.name, `%${search}%`),
        ilike(products.sku, `%${search}%`),
        ilike(products.description, `%${search}%`),
      ];

      // If we found Shopify ID matches, include them
      if (shopifyIdMatchProductIds.length > 0) {
        searchConditions.push(inArray(products.id, shopifyIdMatchProductIds));
      }

      conditions.push(or(...searchConditions)!);
    }

    if (brandFilters.length > 0) {
      conditions.push(inArray(products.brand, brandFilters));
    }

    if (productTypeFilters.length > 0) {
      conditions.push(inArray(products.productType, productTypeFilters));
    }

    // Build orderBy
    const orderFn = sortOrder === "asc" ? asc : desc;
    let orderBy;
    switch (sortBy) {
      case "name":
        orderBy = [orderFn(products.name)];
        break;
      case "updatedAt":
      default:
        orderBy = [orderFn(products.updatedAt)];
        break;
    }

    // Fetch products with variants and feed info
    const [items, countResult] = await Promise.all([
      db.query.products.findMany({
        where: and(...conditions),
        with: {
          variants: {
            columns: {
              id: true,
              externalId: true,
              sku: true,
              name: true,
              barcode: true,
              attributes: true,
              price: true,
              compareAtPrice: true,
              currency: true,
            },
            with: {
              inventory: true,
            },
          },
          feed: {
            columns: {
              id: true,
              name: true,
              logoUrl: true,
            },
          },
        },
        orderBy,
        limit,
        offset: (page - 1) * limit,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(and(...conditions)),
    ]);

    // Get synced product info (including variant mappings)
    const productIds = items.map((p) => p.id);
    const syncedProductMap = new Map<
      string,
      {
        externalProductId: string;
        syncStatus: string;
        lastError: string | null;
        syncSettingsId: string;
      }
    >();
    const syncedVariantMap = new Map<
      string,
      { externalVariantId: string; sourceVariantId: string }
    >();

    if (productIds.length > 0) {
      const syncSettingsIds = [...syncSettingsMap.values()].map((s) => s.syncSettingsId);
      if (syncSettingsIds.length > 0) {
        const syncedProducts = await db
          .select({
            sourceProductId: feedSyncedProducts.sourceProductId,
            sourceVariantId: feedSyncedProducts.sourceVariantId,
            externalProductId: feedSyncedProducts.externalProductId,
            externalVariantId: feedSyncedProducts.externalVariantId,
            syncStatus: feedSyncedProducts.syncStatus,
            lastError: feedSyncedProducts.lastError,
            syncSettingsId: feedSyncedProducts.syncSettingsId,
          })
          .from(feedSyncedProducts)
          .where(
            and(
              inArray(feedSyncedProducts.syncSettingsId, syncSettingsIds),
              inArray(feedSyncedProducts.sourceProductId, productIds)
            )
          );

        for (const sp of syncedProducts) {
          if (sp.externalProductId && !syncedProductMap.has(sp.sourceProductId)) {
            syncedProductMap.set(sp.sourceProductId, {
              externalProductId: sp.externalProductId,
              syncStatus: sp.syncStatus,
              lastError: sp.lastError,
              syncSettingsId: sp.syncSettingsId,
            });
          }
          if (sp.externalVariantId && sp.sourceVariantId) {
            syncedVariantMap.set(sp.sourceVariantId, {
              externalVariantId: sp.externalVariantId,
              sourceVariantId: sp.sourceVariantId,
            });
          }
        }
      }
    }

    // Get unique external product IDs and their corresponding integrations
    const externalProductsByIntegration = new Map<string, string[]>();
    for (const [productId, syncInfo] of syncedProductMap) {
      const product = items.find((p) => p.id === productId);
      if (!product?.feedId) continue;

      const feedSettings = syncSettingsMap.get(product.feedId);
      if (!feedSettings?.integration?.id) continue;

      const integrationId = feedSettings.integration.id;
      if (!externalProductsByIntegration.has(integrationId)) {
        externalProductsByIntegration.set(integrationId, []);
      }
      externalProductsByIntegration.get(integrationId)!.push(syncInfo.externalProductId);
    }

    // Fetch Shopify products in bulk for each integration
    const shopifyProductsMap = new Map<string, Awaited<ReturnType<ShopifyAdapter["getProductsByIds"]>> extends Map<string, infer T> ? T : never>();

    for (const [integrationId, externalIds] of externalProductsByIntegration) {
      const feedSettings = [...syncSettingsMap.values()].find(
        (s) => s.integration?.id === integrationId
      );
      if (!feedSettings?.integration || !feedSettings.shopDomain) continue;

      try {
        const accessToken = await getCredentials<{ accessToken: string }>(
          env,
          feedSettings.integration.credentialsRef
        );

        if (!accessToken?.accessToken) continue;

        const adapter = new ShopifyAdapter({
          shopDomain: feedSettings.shopDomain,
          accessToken: accessToken.accessToken,
        });

        const shopifyProducts = await adapter.getProductsByIds(externalIds);

        for (const [externalId, product] of shopifyProducts) {
          shopifyProductsMap.set(externalId, product);
        }
      } catch (error) {
        console.error(`Failed to fetch Shopify products for integration ${integrationId}:`, error);
        // Continue with other integrations even if one fails
      }
    }

    // Helper to normalize text for comparison
    const normalizeText = (val: string | null | undefined): string =>
      (val ?? "").trim().toLowerCase();

    // Helper to strip HTML tags
    const stripHtml = (html: string | null | undefined): string =>
      (html ?? "").replace(/<[^>]*>/g, "").trim().toLowerCase();

    // Transform products with comparison data
    const transformedProducts = items.map((product) => {
      const syncInfo = syncedProductMap.get(product.id);
      const feedSettings = product.feedId ? syncSettingsMap.get(product.feedId) : null;

      // Get Shopify product data if synced
      let shopifyData = null;
      if (syncInfo?.externalProductId) {
        const shopifyProduct = shopifyProductsMap.get(
          syncInfo.externalProductId.replace("gid://shopify/Product/", "")
        );
        if (shopifyProduct) {
          const storeName = feedSettings?.shopDomain?.replace(".myshopify.com", "");
          shopifyData = {
            externalId: shopifyProduct.externalId,
            adminUrl: storeName
              ? `https://admin.shopify.com/store/${storeName}/products/${shopifyProduct.externalId}`
              : null,
            title: shopifyProduct.title,
            description: shopifyProduct.description,
            vendor: shopifyProduct.vendor,
            productType: shopifyProduct.productType,
            tags: shopifyProduct.tags,
            status: shopifyProduct.status,
            images: shopifyProduct.images?.map((img) => img.url).filter((url): url is string => !!url) ?? [],
            variants: shopifyProduct.variants.map((v) => ({
              externalId: v.externalId,
              sku: v.sku,
              title: v.title,
              barcode: v.barcode,
              price: v.price,
              compareAtPrice: v.compareAtPrice,
              inventoryQuantity: v.inventoryQuantity,
              attributes: v.attributes,
            })),
          };
        }
      }

      // Calculate differences
      const differences = {
        hasNameDiff: false,
        hasDescriptionDiff: false,
        hasVendorDiff: false,
        hasTypeDiff: false,
        hasPriceDiff: false,
        hasInventoryDiff: false,
        totalDiffCount: 0,
      };

      if (shopifyData) {
        // Compare product-level fields
        if (normalizeText(product.name) !== normalizeText(shopifyData.title)) {
          differences.hasNameDiff = true;
          differences.totalDiffCount++;
        }
        if (stripHtml(product.description) !== stripHtml(shopifyData.description)) {
          differences.hasDescriptionDiff = true;
          differences.totalDiffCount++;
        }
        if (normalizeText(product.brand) !== normalizeText(shopifyData.vendor)) {
          differences.hasVendorDiff = true;
          differences.totalDiffCount++;
        }
        if (normalizeText(product.productType) !== normalizeText(shopifyData.productType)) {
          differences.hasTypeDiff = true;
          differences.totalDiffCount++;
        }

        // Compare variants (by SKU matching)
        for (const feedVariant of product.variants) {
          const shopifyVariant = shopifyData.variants.find(
            (sv) => sv.sku === feedVariant.sku
          );
          if (shopifyVariant) {
            const feedPrice = feedVariant.price ? Number(feedVariant.price) : 0;
            const shopifyPrice = shopifyVariant.price;
            // Only flag price as an issue if:
            // - Shop price is LESS than feed price (margin applied incorrectly)
            // - Shop price equals feed price when margin should have been applied
            // Shop price > feed price is expected behavior (margin working correctly)
            if (shopifyPrice < feedPrice - 0.01) {
              // Shop price is lower than feed - definite issue
              differences.hasPriceDiff = true;
              differences.totalDiffCount++;
            } else if (Math.abs(feedPrice - shopifyPrice) < 0.01 && feedPrice > 0) {
              // Prices are the same - might be an issue if margin should have been applied
              // We'll flag this as a potential issue for review
              differences.hasPriceDiff = true;
              differences.totalDiffCount++;
            }
            // Note: shopifyPrice > feedPrice is expected (margin applied correctly)

            const feedQty = feedVariant.inventory ? Number(feedVariant.inventory.quantity) : 0;
            const shopifyQty = shopifyVariant.inventoryQuantity;
            if (feedQty !== shopifyQty) {
              differences.hasInventoryDiff = true;
              differences.totalDiffCount++;
            }
          }
        }
      }

      // Build Shopify admin URL
      let shopifyAdminUrl: string | null = null;
      if (syncInfo?.externalProductId && feedSettings?.shopDomain) {
        const storeName = feedSettings.shopDomain.replace(".myshopify.com", "");
        const gidMatch = syncInfo.externalProductId.match(/\/Product\/(\d+)/);
        const productId = gidMatch ? gidMatch[1] : syncInfo.externalProductId;
        shopifyAdminUrl = `https://admin.shopify.com/store/${storeName}/products/${productId}`;
      }

      // Determine sync status
      let syncStatus: "pending" | "success" | "failed" | "partial" | "never" = "never";
      if (syncInfo) {
        syncStatus = syncInfo.syncStatus as typeof syncStatus;
      }

      const imageUrls = Array.isArray(product.images)
        ? product.images
            .map((img: { url?: string } | string) =>
              typeof img === "string" ? img : img?.url
            )
            .filter((url): url is string => !!url)
        : [];

      return {
        id: product.id,
        feedId: product.feedId,
        feedName: product.feed?.name ?? null,
        feedLogo: product.feed?.logoUrl ?? null,

        // Feed data (source of truth)
        feed: {
          name: product.name,
          description: product.description,
          brand: product.brand,
          productType: product.productType,
          tags: product.tags,
          images: imageUrls,
          variants: product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            name: v.name,
            barcode: v.barcode,
            attributes: v.attributes,
            price: v.price ? Number(v.price) : null,
            compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
            currency: v.currency,
            quantity: v.inventory ? Number(v.inventory.quantity) : 0,
          })),
        },

        // Shopify data (if synced)
        shopify: shopifyData,

        // Sync metadata
        sync: {
          status: syncStatus,
          lastError: syncInfo?.lastError ?? null,
          shopifyAdminUrl,
        },

        // Computed differences
        differences,

        // Rules applied (showing effective rules - feed-level with global fallback)
        rulesApplied: {
          // Feed-level filter rules (no global fallback for filters - they're feed-specific)
          filterRules: feedSettings?.settings?.filterRules ?? {},
          // Pricing margin: feed-level overrides global, otherwise use global
          pricingMargin: feedSettings?.settings?.pricingMargin ?? globalSyncSettings?.pricingMargin ?? null,
          // Field mappings are feed-specific
          fieldMappings: feedSettings?.settings?.fieldMappings ?? [],
          // Field locks: feed-level overrides global, otherwise use global
          fieldLocks: feedSettings?.settings?.fieldLocks ?? globalSyncSettings?.fieldLocks ?? null,
          // SKU prefix is feed-specific
          skuPrefix: feedSettings?.settings?.skuPrefix ?? null,
          // Indicate source of pricing margin for clarity
          pricingMarginSource: feedSettings?.settings?.pricingMargin ? "feed" : (globalSyncSettings?.pricingMargin ? "global" : null),
        },
      };
    });

    // Filter to only show differences if requested
    type SyncStatus = "pending" | "success" | "failed" | "partial" | "never";
    let filteredProducts = transformedProducts;
    if (showOnlyDifferences) {
      filteredProducts = transformedProducts.filter(
        (p) => p.differences.totalDiffCount > 0 || (p.sync.status as SyncStatus) === "failed"
      );
    }

    // Calculate summary
    const summary = {
      total: transformedProducts.length,
      synced: transformedProducts.filter((p) => p.shopify !== null).length,
      withDifferences: transformedProducts.filter((p) => p.differences.totalDiffCount > 0).length,
      failed: transformedProducts.filter((p) => (p.sync.status as SyncStatus) === "failed").length,
      pending: transformedProducts.filter((p) => (p.sync.status as SyncStatus) === "pending").length,
      neverSynced: transformedProducts.filter((p) => (p.sync.status as SyncStatus) === "never").length,
    };

    const total = countResult[0]?.count ?? 0;

    return success(c, {
      items: filteredProducts,
      pagination: {
        page,
        limit,
        total: showOnlyDifferences ? filteredProducts.length : total,
        totalPages: Math.ceil((showOnlyDifferences ? filteredProducts.length : total) / limit),
      },
      summary,
    });
  }
);

// ============================================
// POST /internal/shop/products/:id/retry-sync
// Retry sync for a single product
// ============================================

app.post(
  "/products/:id/retry-sync",
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const env = c.env;
    const productId = c.req.param("id");

    // Find the product and verify it belongs to a feed the retailer has access to
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: { id: true, feedId: true, name: true },
    });

    if (!product || !product.feedId) {
      throw Errors.notFound("Product");
    }

    // Find the subscription for this feed
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.feedId, product.feedId),
        eq(feedSubscriptions.retailerId, auth.organizationId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (!subscription) {
      throw Errors.notFound("Subscription");
    }

    // Get sync settings for this subscription
    const settings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.subscriptionId, subscription.id),
    });

    if (!settings) {
      throw Errors.notFound("Sync settings");
    }

    // Trigger sync for just this one product
    const handle = await tasks.trigger(
      "store-push-products",
      {
        syncSettingsId: settings.id,
        syncType: "full" as const,
        productIds: [productId],
        triggeredBy: "manual" as const,
        forceFullSync: true,
      },
      {
        concurrencyKey: settings.integrationId,
      }
    );

    return success(c, {
      message: `Retry sync triggered for "${product.name}"`,
      productId,
      jobId: handle.id,
    });
  }
);

// ============================================
// PUT /internal/shop/products/:id/mapping
// Change the Shopify product a feed product is mapped to
// ============================================

const changeMappingSchema = z.object({
  shopifyProductId: z.string().min(1, "Shopify product ID is required"),
});

app.put(
  "/products/:id/mapping",
  zValidator("json", changeMappingSchema),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const productId = c.req.param("id");
    const { shopifyProductId } = c.req.valid("json");

    // Find the product and verify it belongs to a feed the retailer has access to
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: { id: true, feedId: true, name: true },
    });

    if (!product || !product.feedId) {
      throw Errors.notFound("Product");
    }

    // Find the subscription for this feed
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.feedId, product.feedId),
        eq(feedSubscriptions.retailerId, auth.organizationId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (!subscription) {
      throw Errors.notFound("Subscription");
    }

    // Get sync settings
    const settings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.subscriptionId, subscription.id),
    });

    if (!settings) {
      throw Errors.notFound("Sync settings");
    }

    // Normalize the Shopify product ID to GID format
    const externalProductId = shopifyProductId.startsWith("gid://")
      ? shopifyProductId
      : `gid://shopify/Product/${shopifyProductId}`;

    // Update all bindings for this product under these sync settings
    const updated = await db
      .update(feedSyncedProducts)
      .set({
        externalProductId,
        // Clear variant and inventory IDs — they'll be re-populated on next sync
        externalVariantId: null,
        externalInventoryItemId: null,
        // Reset sync state so next sync does a full push
        syncStatus: "pending",
        lastSyncedContentHash: null,
        lastSyncedSettingsHash: null,
        lastSyncedInventoryHash: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feedSyncedProducts.syncSettingsId, settings.id),
          eq(feedSyncedProducts.sourceProductId, productId)
        )
      )
      .returning({ id: feedSyncedProducts.id });

    if (updated.length === 0) {
      // No existing binding — create one for each variant
      // (This handles the case where the product was never synced)
      throw Errors.notFound("No existing binding found for this product");
    }

    return success(c, {
      message: `Mapping updated for "${product.name}"`,
      productId,
      newShopifyProductId: externalProductId,
      bindingsUpdated: updated.length,
    });
  }
);

export default app;
