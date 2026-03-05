import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, ilike, or, desc, isNull, count, inArray } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk";
import {
  feeds,
  feedRequests,
  feedSources,
  feedSubscriptions,
  feedSubscriptionSyncSettings,
  feedSyncedProducts,
  integrations,
  products,
  variants,
  organizations,
} from "@workspace/db";
import {
  paginationParams,
  feedStatus,
  feedFilters,
  requestNewFeed,
  requestExistingFeed,
  verifyPublicFeed,
  verifyAuthenticatedFeed,
  feedCredentials,
} from "@workspace/validators";
import { success, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// List Feeds (for Retailers)
// ============================================

// GET /internal/feeds - List available feeds in Feed Library
app.get("/", zValidator("query", feedFilters), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const { page, limit, search, status } = c.req.valid("query");

  // Build where conditions - only show active feeds in Feed Library
  const conditions = [
    eq(feeds.status, "active"),
  ];

  if (search) {
    conditions.push(
      or(
        ilike(feeds.name, `%${search}%`),
        ilike(feeds.description, `%${search}%`)
      )!
    );
  }

  // Get feeds with counts
  const [feedResults, countResult] = await Promise.all([
    db
      .select({
        id: feeds.id,
        name: feeds.name,
        slug: feeds.slug,
        website: feeds.website,
        logoUrl: feeds.logoUrl,
        description: feeds.description,
        orderingUrl: feeds.orderingUrl,
        orderingInstructions: feeds.orderingInstructions,
        orderingEmail: feeds.orderingEmail,
        orderingPhone: feeds.orderingPhone,
        status: feeds.status,
        metadata: feeds.metadata,
        createdAt: feeds.createdAt,
      })
      .from(feeds)
      .where(and(...conditions))
      .orderBy(desc(feeds.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(feeds)
      .where(and(...conditions)),
  ]);

  // Get subscription status for each feed
  const feedIds = feedResults.map((f) => f.id);

  // Get existing subscriptions for this retailer
  const existingSubscriptions = feedIds.length
    ? await db.query.feedSubscriptions.findMany({
        where: and(
          eq(feedSubscriptions.retailerId, auth.organizationId),
          inArray(feedSubscriptions.feedId, feedIds)
        ),
      })
    : [];

  // Get product counts for each feed
  const productCounts = feedIds.length
    ? await db
        .select({
          feedId: products.feedId,
          count: sql<number>`count(*)::int`,
        })
        .from(products)
        .where(
          and(
            inArray(products.feedId, feedIds),
            isNull(products.deletedAt),
            eq(products.isActive, "true")
          )
        )
        .groupBy(products.feedId)
    : [];

  // Get request counts per feed
  const requestCounts = feedIds.length
    ? await db
        .select({
          feedId: feedRequests.feedId,
          count: sql<number>`count(*)::int`,
        })
        .from(feedRequests)
        .where(
          and(
            inArray(feedRequests.feedId, feedIds)
          )
        )
        .groupBy(feedRequests.feedId)
    : [];

  // Get subscription counts per feed
  const subscriptionCounts = feedIds.length
    ? await db
        .select({
          feedId: feedSubscriptions.feedId,
          count: sql<number>`count(*)::int`,
        })
        .from(feedSubscriptions)
        .where(
          and(
            inArray(feedSubscriptions.feedId, feedIds),
            eq(feedSubscriptions.isActive, true)
          )
        )
        .groupBy(feedSubscriptions.feedId)
    : [];

  const subscriptionMap = new Map(
    existingSubscriptions.map((sub) => [sub.feedId, sub])
  );
  const productCountMap = new Map(
    productCounts.map((p) => [p.feedId, p.count])
  );
  const requestCountMap = new Map(
    requestCounts.map((r) => [r.feedId, r.count])
  );
  const subscriptionCountMap = new Map(
    subscriptionCounts.map((c) => [c.feedId, c.count])
  );

  const feedsWithStatus = feedResults.map((feedItem) => {
    const subscription = subscriptionMap.get(feedItem.id);
    return {
      ...feedItem,
      isSubscribed: subscription?.isActive ?? false,
      subscriptionId: subscription?.id ?? null,
      productCount: productCountMap.get(feedItem.id) ?? 0,
      requestCount: requestCountMap.get(feedItem.id) ?? 0,
      subscriptionCount: subscriptionCountMap.get(feedItem.id) ?? 0,
    };
  });

  return paginated(c, feedsWithStatus, {
    page,
    limit,
    total: countResult[0]?.count ?? 0,
  });
});

// GET /internal/feeds/subscribed - List only subscribed feeds
app.get("/subscribed", zValidator("query", paginationParams), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const { page, limit } = c.req.valid("query");


  // Query subscribed feeds via join
  const [subscribedFeeds, countResult] = await Promise.all([
    db
      .select({
        id: feeds.id,
        name: feeds.name,
        slug: feeds.slug,
        website: feeds.website,
        logoUrl: feeds.logoUrl,
        description: feeds.description,
        orderingUrl: feeds.orderingUrl,
        orderingInstructions: feeds.orderingInstructions,
        orderingEmail: feeds.orderingEmail,
        orderingPhone: feeds.orderingPhone,
        status: feeds.status,
        subscriptionId: feedSubscriptions.id,
        verifiedAt: feedSubscriptions.verifiedAt,
      })
      .from(feedSubscriptions)
      .innerJoin(
        feeds,
        eq(feedSubscriptions.feedId, feeds.id)
      )
      .where(
        and(
          eq(feedSubscriptions.retailerId, auth.organizationId),
          eq(feedSubscriptions.isActive, true)
        )
      )
      .orderBy(desc(feedSubscriptions.verifiedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedSubscriptions)
      .where(
        and(
          eq(feedSubscriptions.retailerId, auth.organizationId),
          eq(feedSubscriptions.isActive, true)
        )
      ),
  ]);

  // Get product counts for each feed
  const feedIds = subscribedFeeds.map((f) => f.id);
  const productCounts = feedIds.length
    ? await db
        .select({
          feedId: products.feedId,
          count: sql<number>`count(*)::int`,
        })
        .from(products)
        .where(
          and(
            inArray(products.feedId, feedIds),
            isNull(products.deletedAt),
            eq(products.isActive, "true")
          )
        )
        .groupBy(products.feedId)
    : [];

  const productCountMap = new Map(
    productCounts.map((p) => [p.feedId, p.count])
  );

  const feedsWithCounts = subscribedFeeds.map((feedItem) => ({
    ...feedItem,
    isSubscribed: true,
    productCount: productCountMap.get(feedItem.id) ?? 0,
  }));

  return paginated(c, feedsWithCounts, {
    page,
    limit,
    total: countResult[0]?.count ?? 0,
  });
});

// ============================================
// Get Single Feed
// ============================================

// GET /internal/feeds/:id - Get feed details
app.get("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");


  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, id),
    with: {
      sources: {
        where: eq(feedSources.isActive, true),
        columns: {
          id: true,
          feedType: true,
          requiresAuth: true,
          schedule: true,
          lastSyncAt: true,
          lastSyncStatus: true,
        },
      },
    },
  });

  if (!feed) {
    throw Errors.notFound("Feed");
  }

  // Check subscription status
  const subscription = await db.query.feedSubscriptions.findFirst({
    where: and(
      eq(feedSubscriptions.feedId, id),
      eq(feedSubscriptions.retailerId, auth.organizationId)
    ),
  });

  // Get product count
  const [productCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.feedId, id),
        isNull(products.deletedAt),
        eq(products.isActive, "true")
      )
    );

  // Check if retailer has requested this feed
  const existingRequest = await db.query.feedRequests.findFirst({
    where: and(
      eq(feedRequests.feedId, id),
      eq(feedRequests.retailerId, auth.organizationId)
    ),
  });

  return success(c, {
    feed: {
      ...feed,
      productCount: productCount?.count ?? 0,
    },
    subscription: subscription
      ? {
          id: subscription.id,
          isActive: subscription.isActive,
          verifiedAt: subscription.verifiedAt,
        }
      : null,
    hasRequested: !!existingRequest,
    requestId: existingRequest?.id ?? null,
  });
});

// GET /internal/feeds/by-slug/:slug - Get feed by slug
app.get("/by-slug/:slug", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const slug = c.req.param("slug");


  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.slug, slug),
    columns: { id: true },
  });

  if (!feed) {
    throw Errors.notFound("Feed");
  }

  // Redirect to ID-based endpoint
  return c.redirect(`/internal/feeds/${feed.id}`);
});

// ============================================
// List Pending Feed Requests
// ============================================

// GET /internal/feeds/requests - List retailer's pending feed requests
app.get("/requests", zValidator("query", paginationParams), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const { page, limit } = c.req.valid("query");

  // Query pending feed requests with their associated feed info
  const [requests, countResult] = await Promise.all([
    db
      .select({
        id: feedRequests.id,
        feedId: feedRequests.feedId,
        supplierName: feedRequests.supplierName,
        supplierWebsite: feedRequests.supplierWebsite,
        feedUrl: feedRequests.feedUrl,
        createdAt: feedRequests.createdAt,
        // Feed info (if linked to existing feed)
        feedName: feeds.name,
        feedSlug: feeds.slug,
        feedLogoUrl: feeds.logoUrl,
        feedDescription: feeds.description,
        feedWebsite: feeds.website,
      })
      .from(feedRequests)
      .leftJoin(feeds, eq(feedRequests.feedId, feeds.id))
      .where(eq(feedRequests.retailerId, auth.organizationId))
      .orderBy(desc(feedRequests.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedRequests)
      .where(eq(feedRequests.retailerId, auth.organizationId)),
  ]);

  // Transform to match Feed interface expected by frontend
  const feedsWithStatus = requests.map((req) => ({
    id: req.feedId || req.id, // Use feedId if available, otherwise request id
    name: req.feedName || req.supplierName,
    slug: req.feedSlug || "",
    logoUrl: req.feedLogoUrl || null,
    website: req.feedWebsite || req.supplierWebsite,
    description: req.feedDescription || null,
    isSubscribed: false,
    subscriptionId: null,
    productCount: 0,
    requestCount: 0,
    subscriptionCount: 0,
    // Additional request info
    requestId: req.id,
    requestStatus: "pending" as const,
    requestCreatedAt: req.createdAt,
  }));

  return paginated(c, feedsWithStatus, {
    page,
    limit,
    total: countResult[0]?.count ?? 0,
  });
});

// ============================================
// Request New Feed
// ============================================

// POST /internal/feeds/requests/new - Request a new feed
app.post(
  "/requests/new",
  zValidator("json", requestNewFeed),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const data = c.req.valid("json");


    // Create request for NEW feed (feedId is null)
    const [request] = await db
      .insert(feedRequests)
      .values({
        retailerId: auth.organizationId,
        supplierName: data.supplierName,
        supplierWebsite: data.supplierWebsite,
        feedUrl: data.feedUrl,
        notes: data.notes,
        credentialsProvided: data.credentialsProvided ?? false,
      })
      .returning();

    // Send admin notification
    console.log("Triggering feed request notification for:", data.supplierName);
    try {
      const handle = await tasks.trigger("notification-feed-request", {
        requestId: request.id,
        organizationId: auth.organizationId,
        supplierName: data.supplierName,
        supplierWebsite: data.supplierWebsite,
        feedUrl: data.feedUrl,
        notes: data.notes,
        credentialsProvided: data.credentialsProvided ?? false,
        createdAt: request.createdAt.toISOString(),
      });
      console.log("Feed request notification triggered:", handle.id);
    } catch (err) {
      console.error("Failed to trigger feed request notification:", err);
    }

    return success(c, { request }, 201);
  }
);

// POST /internal/feeds/:id/request - Request access to existing feed
app.post(
  "/:id/request",
  zValidator("json", requestExistingFeed.omit({ feedId: true })),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const id = c.req.param("id");
    const data = c.req.valid("json");


    // Verify feed exists
    const feed = await db.query.feeds.findFirst({
      where: eq(feeds.id, id),
    });

    if (!feed) {
      throw Errors.notFound("Feed");
    }

    // Check if already requested
    const existingRequest = await db.query.feedRequests.findFirst({
      where: and(
        eq(feedRequests.feedId, id),
        eq(feedRequests.retailerId, auth.organizationId)
      ),
    });

    if (existingRequest) {
      throw Errors.alreadyExists("Request for this feed");
    }

    // Check if already subscribed
    const existingSubscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.feedId, id),
        eq(feedSubscriptions.retailerId, auth.organizationId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (existingSubscription) {
      throw Errors.badRequest("Already subscribed to this feed");
    }

    // Create request
    const [request] = await db
      .insert(feedRequests)
      .values({
        feedId: id,
        retailerId: auth.organizationId,
        supplierName: feed.name,
        notes: data.notes,
        feedUrl: data.feedUrl,
        credentialsProvided: data.credentialsProvided ?? false,
      })
      .returning();

    return success(c, { request }, 201);
  }
);

// ============================================
// Verify Feed Access (Subscription Flow)
// ============================================

// POST /internal/feeds/:id/verify-public - Verify public feed access
app.post(
  "/:id/verify-public",
  zValidator("json", verifyPublicFeed),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const id = c.req.param("id");
    const { feedUrl: providedUrl } = c.req.valid("json");


    // Get supplier and its feed sources
    const supplier = await db.query.feeds.findFirst({
      where: and(
        eq(feeds.id, id),
        eq(feeds.status, "active")
      ),
      with: {
        sources: {
          where: and(
            eq(feedSources.isActive, true),
            eq(feedSources.requiresAuth, false)
          ),
        },
      },
    });

    if (!supplier) {
      throw Errors.notFound("Feed");
    }

    // Check if already subscribed
    const existingSubscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.feedId, id),
        eq(feedSubscriptions.retailerId, auth.organizationId)
      ),
    });

    if (existingSubscription?.isActive) {
      throw Errors.badRequest("Already subscribed to this feed");
    }

    // Find a feed source with matching URL
    const normalizedProvidedUrl = normalizeUrl(providedUrl);
    const matchingSource = supplier.sources.find((source) => {
      if (!source.feedUrl) return false;
      return normalizeUrl(source.feedUrl) === normalizedProvidedUrl;
    });

    if (!matchingSource) {
      throw Errors.badRequest(
        "Feed URL does not match. Please verify you have the correct URL."
      );
    }

    // Create or reactivate subscription
    if (existingSubscription) {
      // Reactivate
      await db
        .update(feedSubscriptions)
        .set({
          isActive: true,
          verifiedAt: new Date(),
          disconnectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(feedSubscriptions.id, existingSubscription.id));


      return success(c, {
        subscriptionId: existingSubscription.id,
        verified: true,
        message: "Subscription reactivated successfully",
      });
    }

    // Create new subscription
    const [subscription] = await db
      .insert(feedSubscriptions)
      .values({
        feedId: id,
        retailerId: auth.organizationId,
        isActive: true,
        verifiedAt: new Date(),
      })
      .returning();


    return success(c, {
      subscriptionId: subscription.id,
      verified: true,
      message: "Successfully subscribed to feed",
    });
  }
);

// POST /internal/feeds/:id/verify-authenticated - Verify authenticated feed access
app.post(
  "/:id/verify-authenticated",
  zValidator("json", verifyAuthenticatedFeed),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const id = c.req.param("id");
    const { feedUrl, credentials } = c.req.valid("json");


    // Get feed and its sources
    const feed = await db.query.feeds.findFirst({
      where: and(
        eq(feeds.id, id),
        eq(feeds.status, "active")
      ),
      with: {
        sources: {
          where: and(
            eq(feedSources.isActive, true),
            eq(feedSources.requiresAuth, true)
          ),
        },
      },
    });

    if (!feed) {
      throw Errors.notFound("Feed");
    }

    // Check if already subscribed
    const existingSubscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.feedId, id),
        eq(feedSubscriptions.retailerId, auth.organizationId)
      ),
    });

    if (existingSubscription?.isActive) {
      throw Errors.badRequest("Already subscribed to this feed");
    }

    // Verify by actually fetching the feed with provided credentials
    const isValid = await verifyFeedAccess(feedUrl, credentials);

    if (!isValid) {
      throw Errors.badRequest(
        "Could not verify feed access. Please check your credentials and try again."
      );
    }

    // Create or reactivate subscription
    if (existingSubscription) {
      await db
        .update(feedSubscriptions)
        .set({
          isActive: true,
          verifiedAt: new Date(),
          disconnectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(feedSubscriptions.id, existingSubscription.id));


      return success(c, {
        subscriptionId: existingSubscription.id,
        verified: true,
        message: "Subscription reactivated successfully",
      });
    }

    // Create new subscription
    const [subscription] = await db
      .insert(feedSubscriptions)
      .values({
        feedId: id,
        retailerId: auth.organizationId,
        isActive: true,
        verifiedAt: new Date(),
      })
      .returning();


    return success(c, {
      subscriptionId: subscription.id,
      verified: true,
      message: "Successfully subscribed to feed",
    });
  }
);

// ============================================
// Manage Subscription
// ============================================

// DELETE /internal/feeds/:id/subscription - Unsubscribe from feed
app.delete("/:id/subscription", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");


  const subscription = await db.query.feedSubscriptions.findFirst({
    where: and(
      eq(feedSubscriptions.feedId, id),
      eq(feedSubscriptions.retailerId, auth.organizationId),
      eq(feedSubscriptions.isActive, true)
    ),
  });

  if (!subscription) {
    throw Errors.notFound("Subscription");
  }

  // Soft unsubscribe
  await db
    .update(feedSubscriptions)
    .set({
      isActive: false,
      disconnectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(feedSubscriptions.id, subscription.id));

  return success(c, { unsubscribed: true });
});

// ============================================
// Products from Feed
// ============================================

const catalogQuery = z.object({
  search: z.string().optional(),
  brand: z.string().optional(),
  productType: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// GET /internal/feeds/:id/products - Get products from feed
app.get(
  "/:id/products",
  zValidator("query", catalogQuery),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const id = c.req.param("id");
    const { search, brand, productType, page, limit } = c.req.valid("query");


    // Verify feed exists
    const feed = await db.query.feeds.findFirst({
      where: eq(feeds.id, id),
    });

    if (!feed) {
      throw Errors.notFound("Feed");
    }

    // Check if subscribed (only show products if subscribed)
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.feedId, id),
        eq(feedSubscriptions.retailerId, auth.organizationId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (!subscription) {
      throw Errors.forbidden("Subscription required to view products");
    }

    // Get sync settings and integration for this subscription (to check sync status)
    const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.subscriptionId, subscription.id),
      with: {
        integration: {
          columns: {
            id: true,
            externalIdentifier: true, // shop domain
          },
        },
      },
    });

    // Build conditions
    const conditions = [
      eq(products.feedId, id),
      eq(products.isActive, "true"),
      isNull(products.deletedAt),
    ];

    if (search) {
      // Find products that have variants with matching SKU
      const variantSkuMatches = db
        .selectDistinct({ productId: variants.productId })
        .from(variants)
        .where(ilike(variants.sku, `%${search}%`));

      conditions.push(
        or(
          ilike(products.name, `%${search}%`),
          ilike(products.sku, `%${search}%`),
          ilike(products.description, `%${search}%`),
          inArray(products.id, variantSkuMatches)
        )!
      );
    }

    if (brand) {
      conditions.push(eq(products.brand, brand));
    }

    if (productType) {
      conditions.push(eq(products.productType, productType));
    }

    // Fetch products with variants
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
        },
        orderBy: [desc(products.createdAt)],
        limit,
        offset: (page - 1) * limit,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(and(...conditions)),
    ]);

    // Get synced product info if sync settings exist
    let syncedProductMap = new Map<string, { externalProductId: string; syncStatus: string }>();
    if (syncSettings) {
      const productIds = items.map((p) => p.id);
      if (productIds.length > 0) {
        const syncedProducts = await db
          .selectDistinctOn([feedSyncedProducts.sourceProductId], {
            sourceProductId: feedSyncedProducts.sourceProductId,
            externalProductId: feedSyncedProducts.externalProductId,
            syncStatus: feedSyncedProducts.syncStatus,
          })
          .from(feedSyncedProducts)
          .where(
            and(
              eq(feedSyncedProducts.syncSettingsId, syncSettings.id),
              inArray(feedSyncedProducts.sourceProductId, productIds)
            )
          );

        syncedProductMap = new Map(
          syncedProducts
            .filter((sp) => sp.externalProductId)
            .map((sp) => [
              sp.sourceProductId,
              { externalProductId: sp.externalProductId!, syncStatus: sp.syncStatus },
            ])
        );
      }
    }

    // Build shop admin URL base
    const shopDomain = syncSettings?.integration?.externalIdentifier;

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
      const isSynced = !!syncInfo?.externalProductId;

      // Build Shopify admin URL for the product
      let shopifyAdminUrl: string | null = null;
      if (isSynced && shopDomain && syncInfo?.externalProductId) {
        // Extract store name from domain (pxmdev.myshopify.com -> pxmdev)
        const storeName = shopDomain.replace(".myshopify.com", "");
        // externalProductId can be either a GID (gid://shopify/Product/123456) or just the numeric ID
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
        // Sync status
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

// GET /internal/feeds/:id/products/facets - Get facets for filtering
app.get("/:id/products/facets", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");


  // Verify subscription
  const subscription = await db.query.feedSubscriptions.findFirst({
    where: and(
      eq(feedSubscriptions.feedId, id),
      eq(feedSubscriptions.retailerId, auth.organizationId),
      eq(feedSubscriptions.isActive, true)
    ),
  });

  if (!subscription) {
    throw Errors.forbidden("Subscription required");
  }

  // Get brands with counts
  const brands = await db
    .select({
      name: products.brand,
      productCount: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(
      and(
        eq(products.feedId, id),
        eq(products.isActive, "true"),
        isNull(products.deletedAt),
        sql`${products.brand} IS NOT NULL AND ${products.brand} != ''`
      )
    )
    .groupBy(products.brand)
    .orderBy(products.brand);

  // Get product types with counts
  const productTypes = await db
    .select({
      name: products.productType,
      productCount: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(
      and(
        eq(products.feedId, id),
        eq(products.isActive, "true"),
        isNull(products.deletedAt),
        sql`${products.productType} IS NOT NULL AND ${products.productType} != ''`
      )
    )
    .groupBy(products.productType)
    .orderBy(products.productType);

  return success(c, {
    brands: brands.filter((b) => b.name),
    productTypes: productTypes.filter((t) => t.name),
    collections: [], // Feeds don't have collections
  });
});

// ============================================
// Helper Functions
// ============================================

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slashes, lowercase hostname
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, "")}${parsed.search}`;
  } catch {
    return url.toLowerCase().trim();
  }
}

async function verifyFeedAccess(
  feedUrl: string,
  credentials: z.infer<typeof feedCredentials>
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "PXM-Sync-FeedVerifier/1.0",
    };

    let url = feedUrl;

    switch (credentials.type) {
      case "basic":
        if (credentials.username && credentials.password) {
          const encoded = btoa(`${credentials.username}:${credentials.password}`);
          headers["Authorization"] = `Basic ${encoded}`;
        }
        break;

      case "bearer":
        if (credentials.headerValue) {
          headers["Authorization"] = `Bearer ${credentials.headerValue}`;
        }
        break;

      case "api_key":
        if (credentials.headerName && credentials.headerValue) {
          headers[credentials.headerName] = credentials.headerValue;
        }
        break;

      case "query_param":
        if (credentials.paramName && credentials.paramValue) {
          const parsedUrl = new URL(feedUrl);
          parsedUrl.searchParams.set(
            credentials.paramName,
            credentials.paramValue
          );
          url = parsedUrl.toString();
        }
        break;
    }

    // Make a HEAD request first to avoid downloading entire feed
    const response = await fetch(url, {
      method: "HEAD",
      headers,
    });

    // If HEAD is not supported, try GET with range header
    if (response.status === 405) {
      const getResponse = await fetch(url, {
        method: "GET",
        headers: {
          ...headers,
          Range: "bytes=0-1024", // Just get first 1KB
        },
      });
      return getResponse.ok || getResponse.status === 206;
    }

    return response.ok;
  } catch (error) {
    console.error("Feed verification failed:", error);
    return false;
  }
}

export default app;
