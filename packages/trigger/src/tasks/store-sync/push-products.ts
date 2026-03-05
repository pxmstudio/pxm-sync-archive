/**
 * Store sync - Push products from feed subscriptions to Shopify stores
 *
 * This task handles syncing products from feed subscriptions to a store's Shopify,
 * applying all configured sync settings:
 * - Filter rules (brands, types, tags, price range, stock, keywords)
 * - Category mappings
 * - Pricing margins with conditional rules
 * - SKU prefix transformation
 * - Field locks (per-product metafield overrides)
 * - Publication/sales channel control
 */

import { task } from "@trigger.dev/sdk";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  createDb,
  products,
  variants,
  inventory,
  integrations,
  feedSubscriptions,
  feedSubscriptionSyncSettings,
  feedSyncedProducts,
  storeSyncRuns,
  retailerFieldMappings,
  organizations,
} from "@workspace/db";
import type {
  FilterRules,
  FieldMappingRule,
  PricingMargin,
  FieldLockConfig,
  PublicationOverride,
  LockableField,
  StoreSyncError,
  SyncExclusionRule,
  DefaultPublications,
  SyncChangeBreakdown,
} from "@workspace/db";
import { ShopifyAdapter } from "@workspace/adapters/ecommerce";
import type { CreateProductInput, EcommerceProduct, ProductSetInput, ProductSetVariantInput } from "@workspace/adapters/ecommerce";
import { getShopifyAccessToken } from "../../lib/credentials.js";
import { convertCurrency, isExchangeRateApiConfigured } from "../../lib/exchange-rates.js";
import { dispatchWebhooks } from "../../lib/webhooks.js";
// Import utilities from extracted modules
import type { StorePushProductsPayload, ProductWithVariants, GlobalSyncSettings, OrganizationSettings, SyncChangeType } from "./types.js";
import {
  withThrottleRetry,
  shouldExcludeProduct,
  matchesFilters,
  getFilterFailureReason,
  applyMappingRules,
  applyPricingMargin,
  applyRounding,
  applySkuPrefix,
  batchFetchProductMetafields,
  getLockedFieldsFromCache,
  publishToChannels,
  queryChangedProducts,
} from "./utils/index.js";
import type { MetafieldsCache } from "./utils/field-locks.js";
import { computeSettingsHash, computeInventoryHash } from "../../lib/change-detection/index.js";

// Re-export types for external use
export type { StorePushProductsPayload, ProductWithVariants, GlobalSyncSettings };

/**
 * Push products from feed subscription to store's Shopify
 */
export const storePushProducts = task({
  id: "store-push-products",
  retry: {
    maxAttempts: 3,
  },
  // Use a larger machine for processing thousands of products
  machine: "medium-1x",
  // Allow up to 2 hours for large feeds (3000+ products)
  maxDuration: 7200, // 2 hours in seconds
  // Queue with concurrency limit of 1 - use concurrencyKey per integration to prevent parallel syncs to the same store
  queue: {
    name: "store-sync",
    concurrencyLimit: 1,
  },
  run: async (payload: StorePushProductsPayload) => {
    console.log(`Starting product push for sync settings ${payload.syncSettingsId}`);

    const db = createDb(process.env.DATABASE_URL!);

    // Fetch sync settings with related data
    const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.id, payload.syncSettingsId),
    });

    if (!syncSettings) {
      throw new Error(`Sync settings not found: ${payload.syncSettingsId}`);
    }

    // Check if sync is enabled
    if (syncSettings.syncEnabled !== "true") {
      console.log(`Sync is disabled for settings ${payload.syncSettingsId}, skipping`);
      return {
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        message: "Sync is disabled",
        completedAt: new Date().toISOString(),
      };
    }

    // Fetch the integration (store's Shopify)
    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, syncSettings.integrationId),
    });

    if (!integration) {
      throw new Error(`Integration not found: ${syncSettings.integrationId}`);
    }

    // Fetch the subscription to get feed info
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: eq(feedSubscriptions.id, syncSettings.subscriptionId),
    });

    if (!subscription) {
      throw new Error(`Subscription not found: ${syncSettings.subscriptionId}`);
    }

    // Fetch organization to get externalAuthId (Clerk org ID) and settings
    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, integration.organizationId),
      columns: { externalAuthId: true, settings: true },
    });

    if (!organization) {
      throw new Error(`Organization not found: ${integration.organizationId}`);
    }

    // Fetch global settings from retailerFieldMappings (per-integration settings from /sync page)
    const globalMappings = await db.query.retailerFieldMappings.findFirst({
      where: eq(retailerFieldMappings.integrationId, integration.id),
    });

    // Get organization-level settings
    const orgSettings = organization.settings as OrganizationSettings | null;
    const orgGlobalSyncSettings = orgSettings?.syncSettings;

    // Build effective global settings (integration-level overrides organization-level)
    const integrationSyncSettings = globalMappings?.syncSettings;
    const globalSettings: GlobalSyncSettings = {
      syncEnabled: true, // Already checked above
      syncImages: integrationSyncSettings?.syncImages ?? orgGlobalSyncSettings?.syncImages ?? true,
      syncInventory: integrationSyncSettings?.syncInventory ?? orgGlobalSyncSettings?.syncInventory ?? true,
      createNewProducts: integrationSyncSettings?.createNewProducts ?? orgGlobalSyncSettings?.createNewProducts ?? true,
      deleteRemovedProducts: integrationSyncSettings?.deleteRemovedProducts ?? orgGlobalSyncSettings?.deleteRemovedProducts ?? false,
      defaultStatus: (integrationSyncSettings?.defaultStatus as GlobalSyncSettings["defaultStatus"]) ?? orgGlobalSyncSettings?.defaultStatus ?? "draft",
      publishToChannels: integrationSyncSettings?.publishToChannels ?? (orgGlobalSyncSettings?.defaultPublications?.mode !== "none"),
      skuPrefix: integrationSyncSettings?.skuPrefix ?? orgGlobalSyncSettings?.skuPrefix ?? undefined,
      defaultVendor: integrationSyncSettings?.defaultVendor ?? orgGlobalSyncSettings?.defaultVendor ?? undefined,
    };

    // Get integration-level settings for publications
    const integrationSettings = integration.settings as { publications?: Array<{ id: string; autoPublish: boolean }> } | null;

    // Get SKU prefix - priority: per-subscription > integration-level > global
    const skuPrefix = syncSettings.skuPrefix ?? globalSettings.skuPrefix ?? null;

    // Get exclusion rules - priority: per-feed override > global settings
    // If syncSettings.exclusionRules is set (not null), use it; otherwise fall back to global mappings
    const exclusionRules: SyncExclusionRule[] =
      (syncSettings.exclusionRules as SyncExclusionRule[] | null) ??
      (globalMappings?.exclusionRules || []) as SyncExclusionRule[];

    // Get filter rules from sync settings
    const filterRules: FilterRules = (syncSettings.filterRules || {}) as FilterRules;

    // Get field mappings from sync settings
    const fieldMappings: FieldMappingRule[] = (syncSettings.fieldMappings || []) as FieldMappingRule[];

    // Get pricing margin from sync settings, falling back to organization-level settings
    const pricingMargin: PricingMargin | null =
      (syncSettings.pricingMargin as PricingMargin | null) ??
      (orgGlobalSyncSettings?.pricingMargin as PricingMargin | null) ??
      null;

    // Get field locks from sync settings, falling back to organization-level settings
    const fieldLocks: FieldLockConfig | null =
      (syncSettings.fieldLocks as FieldLockConfig | null) ??
      (orgGlobalSyncSettings?.fieldLocks as FieldLockConfig | null) ??
      null;

    // Get publication override from sync settings (falls back to global if not set)
    const publicationOverride: PublicationOverride | null = syncSettings.publicationOverride as PublicationOverride | null;

    // Get effective publication override (per-subscription overrides integration-level)
    const effectivePublicationOverride: PublicationOverride | null = publicationOverride || null;

    // Compute settings hash for change tracking
    // IMPORTANT: Use effective pricingMargin (with org-level fallback) so that
    // changes to org-level pricing settings trigger product re-syncs
    const currentSettingsHash = computeSettingsHash({
      filterRules: syncSettings.filterRules,
      pricingMargin: pricingMargin,
      fieldMappings: syncSettings.fieldMappings,
      fieldLocks: syncSettings.fieldLocks,
      skuPrefix: syncSettings.skuPrefix,
    });

    // Get default status (for new products only - updates won't change status)
    // Priority: per-feed override > global setting > default "draft"
    const productStatus = syncSettings.defaultProductStatus || globalSettings.defaultStatus || "draft";

    // Get Shopify access token
    const accessToken = await getShopifyAccessToken({ credentialsRef: integration.credentialsRef });

    if (!accessToken) {
      throw new Error("Failed to get Shopify access token");
    }

    // Initialize Shopify adapter
    const shopifyAdapter = new ShopifyAdapter({
      shopDomain: integration.externalIdentifier!,
      accessToken,
    });

    // Get store currency for price conversion
    const storeCurrency = await shopifyAdapter.getStoreCurrency();
    console.log(`[Sync] Store currency: ${storeCurrency}`);

    // Check if exchange rate API is configured
    const canConvertCurrency = await isExchangeRateApiConfigured();
    if (!canConvertCurrency) {
      console.warn("[Sync] Exchange rate API not configured - prices will not be converted");
    }

    // Create sync run record
    const [syncRun] = await db
      .insert(storeSyncRuns)
      .values({
        syncSettingsId: syncSettings.id,
        subscriptionId: syncSettings.subscriptionId,
        integrationId: syncSettings.integrationId,
        feedId: subscription.feedId,
        status: "running",
        syncType: payload.syncType,
        triggeredBy: payload.triggeredBy || "manual",
        triggeredByUserId: payload.triggeredByUserId || null,
        startedAt: new Date(),
      })
      .returning();

    if (!syncRun) {
      throw new Error("Failed to create sync run record");
    }

    // Collection for sync errors
    const syncErrors: StoreSyncError[] = [];

    // Determine which products to sync
    let productIdsToSync: string[];

    if (payload.productIds && payload.productIds.length > 0) {
      // Fast path: product IDs provided by feed import trigger
      productIdsToSync = payload.productIds;
      console.log(`[Sync] Using ${productIdsToSync.length} product IDs from trigger`);
    } else if (payload.syncType === "full" || payload.forceFullSync) {
      // Full sync: get all matching products
      const allProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.feedId, subscription.feedId),
            eq(products.isActive, "true")
          )
        );
      productIdsToSync = allProducts.map((p) => p.id);
      console.log(`[Sync] Full sync: ${productIdsToSync.length} products`);
    } else {
      // Fallback: query for changed products (scheduled/manual incremental sync)
      const changedProducts = await queryChangedProducts(
        db,
        subscription.feedId,
        syncSettings.id,
        currentSettingsHash
      );
      productIdsToSync = changedProducts.map((p) => p.id);
      console.log(`[Sync] Queried ${productIdsToSync.length} changed products`);
    }

    // Skip if no products to sync
    if (productIdsToSync.length === 0) {
      console.log(`[Sync] No products to sync, completing early`);

      // Update sync run as completed with no changes
      await db
        .update(storeSyncRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          productsProcessed: 0,
          productsCreated: 0,
          productsUpdated: 0,
          productsSkipped: 0,
          productsFailed: 0,
        })
        .where(eq(storeSyncRuns.id, syncRun.id));

      return {
        syncRunId: syncRun.id,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        message: "No products to sync",
        completedAt: new Date().toISOString(),
      };
    }

    // Fetch full product data for products we need to sync
    const feedProducts = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        brand: products.brand,
        productType: products.productType,
        tags: products.tags,
        images: products.images,
        deletedAt: products.deletedAt,
        changeType: products.changeType,
        contentHash: products.contentHash,
      })
      .from(products)
      .where(inArray(products.id, productIdsToSync));

    console.log(`[Sync] Fetched ${feedProducts.length} products to sync`);

    // Pre-fetch all synced product/variant mappings for efficient lookup
    const existingSyncedProducts = await db
      .select({
        sourceProductId: feedSyncedProducts.sourceProductId,
        sourceVariantId: feedSyncedProducts.sourceVariantId,
        externalProductId: feedSyncedProducts.externalProductId,
        externalVariantId: feedSyncedProducts.externalVariantId,
        externalInventoryItemId: feedSyncedProducts.externalInventoryItemId,
        lastSyncedContentHash: feedSyncedProducts.lastSyncedContentHash,
        lastSyncedSettingsHash: feedSyncedProducts.lastSyncedSettingsHash,
        lastSyncedInventoryHash: feedSyncedProducts.lastSyncedInventoryHash,
      })
      .from(feedSyncedProducts)
      .where(eq(feedSyncedProducts.syncSettingsId, syncSettings.id));

    // Build a map for quick lookup: sourceProductId -> { externalProductId, variants, hashes }
    // variants: Map<sourceVariantId, { externalVariantId, externalInventoryItemId }>
    const productSyncMap = new Map<string, {
      externalProductId: string | null;
      variants: Map<string, { externalVariantId: string | null; externalInventoryItemId: string | null }>;
      lastSyncedContentHash: string | null;
      lastSyncedSettingsHash: string | null;
      lastSyncedInventoryHash: string | null;
    }>();

    for (const synced of existingSyncedProducts) {
      if (!productSyncMap.has(synced.sourceProductId)) {
        productSyncMap.set(synced.sourceProductId, {
          externalProductId: synced.externalProductId,
          variants: new Map(),
          lastSyncedContentHash: synced.lastSyncedContentHash,
          lastSyncedSettingsHash: synced.lastSyncedSettingsHash,
          lastSyncedInventoryHash: synced.lastSyncedInventoryHash,
        });
      }
      const entry = productSyncMap.get(synced.sourceProductId)!;
      // Update externalProductId if we have one (might be null for failed syncs)
      if (synced.externalProductId) {
        entry.externalProductId = synced.externalProductId;
      }
      entry.variants.set(synced.sourceVariantId, {
        externalVariantId: synced.externalVariantId,
        externalInventoryItemId: synced.externalInventoryItemId,
      });
    }

    console.log(`[Sync] Pre-fetched ${productSyncMap.size} existing synced product mappings`);

    // Pre-fetch metafields for all synced products (for field locks)
    // This is much more efficient than fetching one product at a time
    let metafieldsCache: MetafieldsCache = new Map();
    if (fieldLocks?.enabled) {
      const syncedProductIds = Array.from(productSyncMap.values())
        .map(p => p.externalProductId)
        .filter((id): id is string => id !== null);

      if (syncedProductIds.length > 0) {
        metafieldsCache = await batchFetchProductMetafields(
          integration.externalIdentifier!,
          accessToken,
          syncedProductIds
        );
      }
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    // Track change breakdown for incremental sync stats
    const changeBreakdownCounts = {
      new: 0,
      full: 0,
      price: 0,
      inventory: 0,
      inventoryFastPath: 0,
    };

    // ============================================
    // Single Product Sync Function (for parallel batching)
    /**
     * Syncs a single feed product to the connected Shopify store, creating, updating, deleting, or skipping the corresponding shop product according to sync rules and settings.
     *
     * @param product - The source feed product record (including its variants, metadata, content hash, and changeType) to be synchronized.
     * @returns An object describing the sync outcome:
     * - `action`: `"created" | "updated" | "skipped" | "failed"` indicating what happened.
     * - `changeType` (optional): the detected sync change type when applicable (e.g., `"new" | "full" | "price" | "inventory"`).
     * - `usedFastPath` (optional): `true` if the inventory fast-path was used for this update, `false` or omitted otherwise.
     * - `error` (optional): an error message when `action` is `"failed"`.
     */
    async function syncSingleProduct(
      product: typeof feedProducts[0]
    ): Promise<{ action: "created" | "updated" | "skipped" | "failed"; changeType?: SyncChangeType; usedFastPath?: boolean; error?: string }> {
      // Assert outer scope variables are defined (they are checked before this function is created)
      const _subscription = subscription!;
      const _integration = integration!;
      const _syncSettings = syncSettings!;

      try {
        console.log(`[Sync] Processing product ${product.id} (${product.name}), changeType: ${product.changeType}, forceFullSync: ${payload.forceFullSync}`);

        // Fetch variants with inventory for this product
        const productVariants = await db
          .select({
            id: variants.id,
            externalId: variants.externalId,
            name: variants.name,
            sku: variants.sku,
            barcode: variants.barcode,
            price: variants.price,
            compareAtPrice: variants.compareAtPrice,
            costPrice: variants.costPrice,
            currency: variants.currency,
            weight: variants.weight,
            weightUnit: variants.weightUnit,
            attributes: variants.attributes,
            inventoryQuantity: sql<number>`COALESCE(${inventory.quantity}, 0)::int`,
          })
          .from(variants)
          .leftJoin(inventory, eq(inventory.variantId, variants.id))
          .where(eq(variants.productId, product.id));

        const productWithVariants: ProductWithVariants = {
          ...product,
          deletedAt: product.deletedAt,
          variants: productVariants,
        };

        const totalInventory = productVariants.reduce((sum, v) => sum + v.inventoryQuantity, 0);
        console.log(`[Sync] Product ${product.id}: loaded ${productVariants.length} variants, total inventory: ${totalInventory}`);

        // Check if product should be excluded by global exclusion rules
        if (shouldExcludeProduct(productWithVariants, exclusionRules)) {
          console.log(`[Sync] Product ${product.id} (${product.name}): skipped by exclusion rules`);
          return { action: "skipped" };
        }

        // Check if product matches additional filter rules (from per-subscription settings)
        const filterFailureReason = getFilterFailureReason(productWithVariants, filterRules);
        if (filterFailureReason) {
          console.log(`[Sync] Product ${product.id} (${product.name}): skipped - ${filterFailureReason}`);
          return { action: "skipped" };
        }

        // Apply field mapping rules (transforms values based on configured rules)
        const mappingResult = applyMappingRules(productWithVariants, fieldMappings);

        // Check if we already have this product synced (using pre-fetched map)
        const existingSyncData = productSyncMap.get(product.id);
        const existingExternalProductId = existingSyncData?.externalProductId || null;

        // Get locked fields if product exists and field locks are enabled
        // Uses pre-fetched metafields cache for performance (batch fetched before the loop)
        let lockedFields = new Set<LockableField>();
        if (existingExternalProductId && fieldLocks?.enabled) {
          lockedFields = getLockedFieldsFromCache(
            existingExternalProductId,
            fieldLocks,
            metafieldsCache
          );
        }

        // Handle soft-deleted products
        const isDeleted = productWithVariants.deletedAt !== null;

        // If product is deleted and deleteRemovedProducts is enabled, delete from Shopify
        if (isDeleted && globalSettings.deleteRemovedProducts && existingExternalProductId) {
          console.log(`[Sync] Product ${product.id}: deleting from Shopify (deleteRemovedProducts enabled)`);

          try {
            await withThrottleRetry(
              () => shopifyAdapter.deleteProduct(existingExternalProductId),
              { label: `deleteProduct-${product.id}` }
            );

            // Clean up synced product records
            await db
              .delete(feedSyncedProducts)
              .where(
                and(
                  eq(feedSyncedProducts.syncSettingsId, _syncSettings.id),
                  eq(feedSyncedProducts.sourceProductId, product.id)
                )
              );

            // Dispatch webhook for product deletion
            dispatchWebhooks(db, _integration.organizationId, "product.deleted", {
              product: {
                id: product.id,
                externalId: existingExternalProductId,
                name: product.name,
              },
              source: "store_sync",
            }, { eventId: `product-deleted-${product.id}` }).catch((err) => {
              console.warn(`Failed to dispatch webhook for product deletion ${product.id}:`, err);
            });

            return { action: "updated", changeType: "full" }; // Count as update for stats
          } catch (deleteError) {
            console.error(`[Sync] Failed to delete product ${product.id} from Shopify:`, deleteError);
            // Fall through to regular handling (set to draft with 0 inventory)
          }
        }

        const effectiveStatus = isDeleted ? "draft" : productStatus;

        // Build product metafields
        const productMetafields: Array<{
          namespace: string;
          key: string;
          value: string;
          type: string;
        }> = [];

        // Partner metafield - identifies which feed/supplier the product came from
        if (_subscription.feedId) {
          productMetafields.push({
            namespace: "custom",
            key: "partner",
            value: _subscription.feedId,
            type: "single_line_text_field",
          });
        }

        // Promo date metafields (if available in product metadata)
        const productMetadata = (product as { metadata?: Record<string, unknown> }).metadata;
        if (productMetadata?.promoStart) {
          const promoStartStr = String(productMetadata.promoStart);
          // Ensure ISO 8601 format
          const promoStartDate = new Date(promoStartStr);
          if (!isNaN(promoStartDate.getTime())) {
            productMetafields.push({
              namespace: "custom",
              key: "promo_start",
              value: promoStartDate.toISOString(),
              type: "date_time",
            });
          }
        }
        if (productMetadata?.promoEnd) {
          const promoEndStr = String(productMetadata.promoEnd);
          // Ensure ISO 8601 format
          const promoEndDate = new Date(promoEndStr);
          if (!isNaN(promoEndDate.getTime())) {
            productMetafields.push({
              namespace: "custom",
              key: "promo_end",
              value: promoEndDate.toISOString(),
              type: "date_time",
            });
          }
        }

        // Prepare product data for Shopify (respecting field locks for updates)
        // Note: title is always required for createProduct, field locks only apply to updates

        // Build variants with currency conversion
        const mappedVariants = await Promise.all(
          productWithVariants.variants.map(async (v) => {
            // Step 1: Apply pricing margin (in source currency, no rounding yet)
            let adjustedPrice = applyPricingMargin(productWithVariants, v, pricingMargin) ?? undefined;
            let adjustedCompareAtPrice = v.compareAtPrice
              ? applyPricingMargin(
                  productWithVariants,
                  { ...v, price: v.compareAtPrice },
                  pricingMargin
                ) ?? undefined
              : undefined;

            // Cost is the original price from the feed (before markup) - this is the retailer's cost
            let cost = v.price ? parseFloat(v.price) : undefined;

            // Step 2: Convert currency if needed and API is configured
            const sourceCurrency = v.currency || "USD";
            if (canConvertCurrency && sourceCurrency !== storeCurrency) {
              try {
                if (adjustedPrice !== undefined) {
                  adjustedPrice = await convertCurrency(adjustedPrice, sourceCurrency, storeCurrency);
                }
                if (adjustedCompareAtPrice !== undefined) {
                  adjustedCompareAtPrice = await convertCurrency(adjustedCompareAtPrice, sourceCurrency, storeCurrency);
                }
                if (cost !== undefined) {
                  cost = await convertCurrency(cost, sourceCurrency, storeCurrency);
                  cost = Math.round(cost * 100) / 100;
                }
              } catch (conversionError) {
                console.warn(`Failed to convert currency for variant ${v.sku}:`, conversionError);
              }
            }

            // Step 3: Apply rounding AFTER currency conversion (so endWith works in store currency)
            if (adjustedPrice !== undefined && pricingMargin?.rounding) {
              adjustedPrice = applyRounding(adjustedPrice, pricingMargin.rounding, pricingMargin.bounds);
            } else if (adjustedPrice !== undefined) {
              // Just round to 2 decimal places if no rounding config
              adjustedPrice = Math.round(adjustedPrice * 100) / 100;
            }
            if (adjustedCompareAtPrice !== undefined && pricingMargin?.rounding) {
              adjustedCompareAtPrice = applyRounding(adjustedCompareAtPrice, pricingMargin.rounding, pricingMargin.bounds);
            } else if (adjustedCompareAtPrice !== undefined) {
              adjustedCompareAtPrice = Math.round(adjustedCompareAtPrice * 100) / 100;
            }

            // PRICE GUARD: Never allow the Shopify price to be lower than the feed base price
            // This is the #1 rule - selling below cost/feed price is never acceptable
            // `cost` here is the feed base price (already currency-converted if applicable)
            if (adjustedPrice !== undefined && cost !== undefined && adjustedPrice < cost) {
              console.error(
                `[PRICE GUARD] SKU ${v.sku}: adjusted price ${adjustedPrice} is below feed base price ${cost}. ` +
                `Clamping to feed base price to prevent selling below cost.`
              );
              adjustedPrice = cost;
            }

            // Don't set compare at price if it's less than or equal to the actual price
            // (compare at should be higher to show a discount)
            if (adjustedCompareAtPrice !== undefined && adjustedPrice !== undefined && adjustedCompareAtPrice <= adjustedPrice) {
              adjustedCompareAtPrice = undefined;
            }

            return {
              sku: applySkuPrefix(v.sku, skuPrefix ?? null),
              barcode: v.barcode || undefined,
              price: adjustedPrice,
              compareAtPrice: adjustedCompareAtPrice,
              cost,
              weight: v.weight ? parseFloat(v.weight) : undefined,
              weightUnit: v.weightUnit || undefined,
              options: v.attributes ? Object.values(v.attributes) : undefined,
              // Set inventory to 0 for soft-deleted products
              inventoryQuantity: isDeleted ? 0 : v.inventoryQuantity,
            };
          })
        );

        // Determine final field values with priority:
        // 1. Field mapping rules (value transformations)
        // 2. Original value / defaults
        const finalProductType = mappingResult.productType || product.productType || undefined;
        const finalVendor = mappingResult.vendor || product.brand || globalSettings.defaultVendor || undefined;

        // For tags: start with original tags and add any from mapping rules
        const finalTags = [
          ...(product.tags || []),
          ...(mappingResult.tags || []),
        ];

        const productInput: CreateProductInput = {
          title: product.name,
          description: product.description || undefined,
          vendor: finalVendor,
          productType: finalProductType,
          tags: finalTags,
          status: effectiveStatus,
          metafields: productMetafields.length > 0 ? productMetafields : undefined,
          variants: mappedVariants,
          // Only include images if syncImages is enabled in global settings
          images: globalSettings.syncImages
            ? (product.images || []).map((img) => ({
                url: img.url,
                altText: img.altText,
              }))
            : [],
        };

        let shopifyProduct: EcommerceProduct | undefined;
        let productWasDeleted = false;
        let resultAction: "created" | "updated" | "skipped" = "skipped";

        // Determine effective change type for routing
        // Use "full" if forceFullSync is set, otherwise use the product's stored changeType
        const effectiveChangeType: SyncChangeType = payload.forceFullSync
          ? "full"
          : (product.changeType as SyncChangeType) || "full";

        // Skip image sync for inventory-only or price-only changes
        const shouldSyncImages =
          globalSettings.syncImages &&
          !lockedFields.has("images") &&
          effectiveChangeType !== "inventory" &&
          effectiveChangeType !== "price";

        if (existingExternalProductId) {
          // Declare variables outside try block so they're accessible in catch block
          let variantInputs: ProductSetVariantInput[] = [];
          let productOptions: Array<{ name: string; values: Array<{ name: string }> }> = [];

          try {
            // ============================================
            // INVENTORY FAST-PATH
            // For inventory-only changes, use Shopify Inventory API directly
            // This is ~10x faster than productSet for large batches
            // ============================================
            if (globalSettings.syncInventory && effectiveChangeType === "inventory" && !lockedFields.has("quantity")) {
              // Check if all variants have inventory item IDs stored
              const variantsWithInventoryIds = productWithVariants.variants.filter((v) => {
                const variantData = existingSyncData?.variants.get(v.id);
                return variantData?.externalInventoryItemId != null;
              });
              const allHaveInventoryIds = variantsWithInventoryIds.length === productWithVariants.variants.length;

              if (allHaveInventoryIds) {
                console.log(`[Sync] Product ${product.id}: using inventory fast-path (${productWithVariants.variants.length} variants)`);

                let fastPathSuccess = true;
                let fastPathErrors: string[] = [];

                // Update inventory for each variant directly
                for (let i = 0; i < productWithVariants.variants.length; i++) {
                  const sourceVariant = productWithVariants.variants[i];
                  const mappedVariant = mappedVariants[i];
                  const variantData = existingSyncData?.variants.get(sourceVariant!.id);

                  if (sourceVariant && mappedVariant && variantData?.externalInventoryItemId) {
                    const quantity = mappedVariant.inventoryQuantity ?? 0;

                    try {
                      await withThrottleRetry(
                        () => shopifyAdapter.setInventory(
                          variantData.externalInventoryItemId!,
                          quantity
                        ),
                        { label: `setInventory-${sourceVariant.sku}` }
                      );

                      // Compute the actual inventory hash from the synced quantity
                      const inventoryHash = computeInventoryHash({
                        quantities: [{ variantId: sourceVariant.id, quantity }],
                      });

                      // Update the synced record with all hashes to maintain consistency
                      // This ensures the next sync correctly detects what changed
                      await db
                        .update(feedSyncedProducts)
                        .set({
                          lastSyncedContentHash: product.contentHash,
                          lastSyncedInventoryHash: inventoryHash,
                          lastSyncedSettingsHash: currentSettingsHash,
                          lastInventorySyncAt: new Date(),
                          updatedAt: new Date(),
                        })
                        .where(
                          and(
                            eq(feedSyncedProducts.syncSettingsId, _syncSettings.id),
                            eq(feedSyncedProducts.sourceVariantId, sourceVariant.id)
                          )
                        );
                    } catch (inventoryError) {
                      const errorMsg = inventoryError instanceof Error ? inventoryError.message : String(inventoryError);
                      console.warn(`[Sync] Fast-path inventory update failed for variant ${sourceVariant.sku}: ${errorMsg}`);
                      fastPathErrors.push(`${sourceVariant.sku}: ${errorMsg}`);
                      fastPathSuccess = false;
                    }
                  }
                }

                if (fastPathSuccess) {
                  console.log(`[Sync] Product ${product.id}: inventory fast-path completed successfully`);
                  return { action: "updated", changeType: "inventory", usedFastPath: true };
                } else {
                  // Log failures but don't fail the entire sync - the inventory was partially updated
                  console.warn(`[Sync] Product ${product.id}: inventory fast-path had ${fastPathErrors.length} errors, falling back to productSet`);
                  // Fall through to productSet for a full sync
                }
              } else {
                // Fall through to regular productSet if inventory IDs not available
                const missingCount = productWithVariants.variants.length - variantsWithInventoryIds.length;
                console.log(`[Sync] Product ${product.id}: inventory fast-path unavailable (${missingCount}/${productWithVariants.variants.length} missing inventory IDs), using productSet`);
              }
            }

            // ============================================
            // UPDATE EXISTING PRODUCT using productSet
            // Route based on change type for optimization
            // ============================================

            // Log the sync strategy for observability
            if (effectiveChangeType === "inventory") {
              console.log(`[Sync] Product ${product.id}: inventory-only update (skipping images)`);
            } else if (effectiveChangeType === "price") {
              console.log(`[Sync] Product ${product.id}: price-only update (skipping images)`);
            }

            // Build variant inputs with existing Shopify variant IDs
            // IMPORTANT: All variants must be included or they will be deleted
            variantInputs = productWithVariants.variants.map((v, i) => {
              const inputVariant = productInput.variants?.[i];
              const existingVariantData = existingSyncData?.variants.get(v.id);
              const existingVariantId = existingVariantData?.externalVariantId || null;

              // Build option values from variant attributes
              const optionValues: Array<{ optionName: string; name: string }> = [];
              if (v.attributes) {
                Object.entries(v.attributes).forEach(([key, value]) => {
                  optionValues.push({ optionName: key, name: value });
                });
              }
              // Default option if no attributes
              if (optionValues.length === 0) {
                optionValues.push({ optionName: "Title", name: "Default Title" });
              }

              return {
                id: existingVariantId || undefined, // Include ID for existing variants
                sku: inputVariant?.sku,
                barcode: inputVariant?.barcode || undefined,
                price: lockedFields.has("price") ? undefined : inputVariant?.price?.toString(),
                compareAtPrice: lockedFields.has("compareAtPrice")
                  ? undefined
                  : inputVariant?.compareAtPrice?.toString() ?? null,
                cost: inputVariant?.cost?.toString(),
                optionValues,
              };
            });

            // Build productOptions from variant optionValues
            // Required by Shopify API when updating variants
            const optionNamesMap = new Map<string, Set<string>>();
            for (const variant of variantInputs) {
              for (const ov of variant.optionValues) {
                if (!optionNamesMap.has(ov.optionName)) {
                  optionNamesMap.set(ov.optionName, new Set());
                }
                optionNamesMap.get(ov.optionName)!.add(ov.name);
              }
            }
            productOptions = Array.from(optionNamesMap.entries()).map(([name, values]) => ({
              name,
              values: Array.from(values).map(v => ({ name: v })),
            }));

            console.log(`[Sync] Product ${product.id} (${product.name}): updating existing Shopify product ${existingExternalProductId}`);

            // Build productSet input
            const productSetInput: ProductSetInput = {
              title: lockedFields.has("title") ? undefined : productInput.title,
              descriptionHtml: lockedFields.has("description") ? undefined : productInput.description,
              vendor: lockedFields.has("vendor") ? undefined : productInput.vendor,
              productType: lockedFields.has("productType") ? undefined : productInput.productType,
              tags: lockedFields.has("tags") ? undefined : productInput.tags,
              // Status: createOnly by default - only set on new products, not updates
              // This prevents overwriting manual status changes
              status: undefined,
              metafields: productMetafields.length > 0 ? productMetafields : undefined,
              variants: variantInputs,
              productOptions, // Required when updating variants
            };

            // Single API call for product + variants + metafields
            shopifyProduct = await withThrottleRetry(
              () => shopifyAdapter.productSet(existingExternalProductId, productSetInput),
              { label: `productSet ${product.name}` }
            );

            // Update media/images separately if not locked and syncImages is enabled
            // Skip for inventory-only and price-only changes (optimization)
            if (shouldSyncImages && productInput.images && productInput.images.length > 0) {
              try {
                await withThrottleRetry(
                  () => shopifyAdapter.updateProductMedia(
                    existingExternalProductId,
                    productInput.images!
                  ),
                  { label: `updateMedia-${product.id}` }
                );
              } catch (mediaError) {
                // Log but don't fail the entire sync for media update failures
                console.warn(`Failed to update media for product ${product.id}:`, mediaError);
              }
            }

            // Update inventory separately after productSet
            // productSet doesn't update inventory, so we need to call setInventory for each variant
            // Use inventory item IDs from productSet response (not stored IDs) to handle products
            // that were synced before we started tracking inventory item IDs
            if (globalSettings.syncInventory && !lockedFields.has("quantity") && shopifyProduct) {
              for (let i = 0; i < productWithVariants.variants.length; i++) {
                const sourceVariant = productWithVariants.variants[i];
                const mappedVariant = mappedVariants[i];
                const shopifyVariant = shopifyProduct.variants[i];

                if (sourceVariant && mappedVariant && shopifyVariant?.inventoryItemId) {
                  const quantity = mappedVariant.inventoryQuantity ?? 0;
                  try {
                    await withThrottleRetry(
                      () => shopifyAdapter.setInventory(
                        shopifyVariant.inventoryItemId!,
                        quantity
                      ),
                      { label: `setInventory-${sourceVariant.sku}` }
                    );
                  } catch (inventoryError) {
                    console.warn(`Failed to update inventory for variant ${sourceVariant.sku}:`, inventoryError);
                  }
                }
              }
            }

            resultAction = "updated";

            // Dispatch webhook for product update
            dispatchWebhooks(db, _integration.organizationId, "product.updated", {
              product: {
                id: product.id,
                externalId: shopifyProduct?.externalId,
                name: product.name,
                sku: productWithVariants.variants[0]?.sku,
              },
              source: "store_sync",
            }, { eventId: `product-updated-${product.id}-${Date.now()}` }).catch((err) => {
              console.warn(`Failed to dispatch webhook for product update ${product.id}:`, err);
            });
          } catch (updateError) {
            // Check if the product or variants were deleted from Shopify
            const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);

            // Check for variant not found error specifically
            // Error format from adapter: "productSet failed: variants.0.id: ... (PRODUCT_VARIANT_DOES_NOT_EXIST)"
            // Or legacy format: "Following variant ids do not exist: [52731268989257]"
            const isVariantNotFoundError =
              errorMessage.includes("PRODUCT_VARIANT_DOES_NOT_EXIST") ||
              errorMessage.includes("variant ids do not exist") ||
              errorMessage.includes("variant id does not exist");

            // Check for product not found error - be specific to avoid false positives from metafield/inventory errors
            // Error format from adapter: "productSet failed: id: Product not found (INVALID)"
            // We check for product-level errors by looking for error codes or specific product error patterns
            const isProductNotFoundError =
              // Shopify error codes for product not found
              errorMessage.includes("(PRODUCT_DOES_NOT_EXIST)") ||
              errorMessage.includes("(INVALID_PRODUCT)") ||
              // Product-level field errors (id field, not nested like metafields.0 or variants.0)
              /\bid\s*:\s*Product not found/i.test(errorMessage) ||
              /\bid\s*:\s*.*does not exist/i.test(errorMessage) ||
              // Direct product fetch errors (not from productSet)
              (errorMessage.includes("Product not found") && !errorMessage.includes("productSet failed:")) ||
              // HTTP 404 on product endpoint (not nested resource)
              (errorMessage.includes("404") && errorMessage.includes("products/"));

            if (isVariantNotFoundError) {
              // Variant was deleted from Shopify - clear variant mappings but keep product mapping
              // This will cause the sync to create new variants
              console.log(
                `Variant(s) deleted from Shopify for product ${product.id}, clearing variant mappings and retrying`
              );

              // Clear only the variant external IDs, keep the product ID
              await db
                .update(feedSyncedProducts)
                .set({
                  externalVariantId: null,
                  externalInventoryItemId: null,
                  syncStatus: "pending",
                  lastError: "Variant was deleted from Shopify, will recreate",
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(feedSyncedProducts.syncSettingsId, _syncSettings.id),
                    eq(feedSyncedProducts.sourceProductId, product.id)
                  )
                );

              // Retry the productSet without variant IDs - Shopify will create new variants
              const variantInputsWithoutIds = variantInputs.map(v => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...rest } = v;
                return rest;
              });

              const retryInput: ProductSetInput = {
                title: lockedFields.has("title") ? undefined : productInput.title,
                descriptionHtml: lockedFields.has("description") ? undefined : productInput.description,
                vendor: lockedFields.has("vendor") ? undefined : productInput.vendor,
                productType: lockedFields.has("productType") ? undefined : productInput.productType,
                tags: lockedFields.has("tags") ? undefined : productInput.tags,
                status: undefined,
                metafields: productMetafields.length > 0 ? productMetafields : undefined,
                variants: variantInputsWithoutIds,
                productOptions,
              };

              console.log(`[Sync] Retrying productSet for ${product.id} without variant IDs`);
              shopifyProduct = await withThrottleRetry(
                () => shopifyAdapter.productSet(existingExternalProductId, retryInput),
                { label: `productSet-retry ${product.name}` }
              );

              resultAction = "updated";
            } else if (isProductNotFoundError) {
              console.log(
                `Product ${existingExternalProductId} was deleted from Shopify, clearing mapping for product ${product.id}`
              );
              productWasDeleted = true;

              // Clear the external IDs from all feedSyncedProducts records for this product
              await db
                .update(feedSyncedProducts)
                .set({
                  externalProductId: null,
                  externalVariantId: null,
                  externalInventoryItemId: null,
                  syncStatus: "pending",
                  lastError: "Product was deleted from Shopify",
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(feedSyncedProducts.syncSettingsId, _syncSettings.id),
                    eq(feedSyncedProducts.sourceProductId, product.id)
                  )
                );
            } else {
              // Re-throw other errors
              throw updateError;
            }
          }
        }

        // Create new product if:
        // 1. No existing synced product record, OR
        // 2. Product was deleted from Shopify and we cleared the mapping
        if (!existingExternalProductId || productWasDeleted) {
          console.log(`[Sync] Product ${product.id} (${product.name}): no existing Shopify ID (wasDeleted: ${productWasDeleted}), attempting to create`);
          // Check if creating new products is allowed by global settings
          if (!globalSettings.createNewProducts) {
            console.log(`[Sync] Product ${product.id}: skipped - createNewProducts is disabled`);
            return { action: "skipped" };
          }

          // Create new product with retry on throttle
          shopifyProduct = await withThrottleRetry(
            () => shopifyAdapter.createProduct(productInput),
            { label: `createProduct ${product.name}` }
          );

          // Publish to sales channels if enabled
          // Use effectivePublicationOverride if set, otherwise fall back to legacy publishToChannels boolean
          const shouldPublish = effectivePublicationOverride
            ? effectivePublicationOverride.mode !== "none"
            : globalSettings.publishToChannels;

          if (shouldPublish) {
            await publishToChannels(
              _integration.externalIdentifier!,
              accessToken,
              shopifyProduct.externalId,
              effectivePublicationOverride,
              integrationSettings?.publications
            );
          }

          resultAction = "created";

          // Dispatch webhook for product creation
          dispatchWebhooks(db, _integration.organizationId, "product.created", {
            product: {
              id: product.id,
              externalId: shopifyProduct.externalId,
              name: product.name,
              sku: productWithVariants.variants[0]?.sku,
            },
            source: "store_sync",
          }, { eventId: `product-created-${product.id}` }).catch((err) => {
            console.warn(`Failed to dispatch webhook for product creation ${product.id}:`, err);
          });
        }

        // Skip tracking if no shopify product was created/updated
        // This happens when the product was deleted from Shopify and createNewProducts is disabled
        if (!shopifyProduct) {
          console.log(`[Sync] Product ${product.id} (${product.name}): skipped - no Shopify product returned (existingId: ${existingExternalProductId}, wasDeleted: ${productWasDeleted})`);
          return { action: "skipped" };
        }

        // Track synced products/variants
        for (let i = 0; i < productWithVariants.variants.length; i++) {
          const sourceVariant = productWithVariants.variants[i];
          const shopifyVariant = shopifyProduct.variants[i];

          if (!sourceVariant || !shopifyVariant) continue;

          // Upsert synced product record
          const existingRecord = await db.query.feedSyncedProducts.findFirst({
            where: and(
              eq(feedSyncedProducts.syncSettingsId, _syncSettings.id),
              eq(feedSyncedProducts.sourceVariantId, sourceVariant.id)
            ),
          });

          // Compute inventory hash for this variant
          const variantInventoryHash = computeInventoryHash({
            quantities: [{ variantId: sourceVariant.id, quantity: sourceVariant.inventoryQuantity }],
          });

          if (existingRecord) {
            await db
              .update(feedSyncedProducts)
              .set({
                externalProductId: shopifyProduct.externalId,
                externalVariantId: shopifyVariant.externalId,
                externalInventoryItemId: shopifyVariant.inventoryItemId,
                syncStatus: "synced",
                lastError: null,
                lastSyncedAt: new Date(),
                // Track hashes for incremental sync
                lastSyncedContentHash: product.contentHash,
                lastSyncedInventoryHash: variantInventoryHash,
                lastSyncedSettingsHash: currentSettingsHash,
                lastInventorySyncAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(feedSyncedProducts.id, existingRecord.id));
          } else {
            await db.insert(feedSyncedProducts).values({
              syncSettingsId: _syncSettings.id,
              sourceProductId: product.id,
              sourceVariantId: sourceVariant.id,
              externalProductId: shopifyProduct.externalId,
              externalVariantId: shopifyVariant.externalId,
              externalInventoryItemId: shopifyVariant.inventoryItemId,
              syncStatus: "synced",
              lastSyncedAt: new Date(),
              // Track hashes for incremental sync
              lastSyncedContentHash: product.contentHash,
              lastSyncedInventoryHash: variantInventoryHash,
              lastSyncedSettingsHash: currentSettingsHash,
              lastInventorySyncAt: new Date(),
            });
          }
        }

        return { action: resultAction, changeType: resultAction === "created" ? "new" : effectiveChangeType };
      } catch (error) {
        console.error(`Failed to sync product ${product.id}:`, error);

        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        // Collect error for activity log
        syncErrors.push({
          productId: product.id,
          productName: product.name,
          message: errorMessage,
        });

        // Mark variants as failed - query variants directly since productWithVariants might not be defined
        const failedVariants = await db
          .select({ id: variants.id, sku: variants.sku })
          .from(variants)
          .where(eq(variants.productId, product.id));

        for (const variant of failedVariants) {
          const existingRecord = await db.query.feedSyncedProducts.findFirst({
            where: and(
              eq(feedSyncedProducts.syncSettingsId, _syncSettings.id),
              eq(feedSyncedProducts.sourceVariantId, variant.id)
            ),
          });

          if (existingRecord) {
            await db
              .update(feedSyncedProducts)
              .set({
                syncStatus: "failed",
                lastError: errorMessage,
                updatedAt: new Date(),
              })
              .where(eq(feedSyncedProducts.id, existingRecord.id));
          } else {
            await db.insert(feedSyncedProducts).values({
              syncSettingsId: _syncSettings.id,
              sourceProductId: product.id,
              sourceVariantId: variant.id,
              syncStatus: "failed",
              lastError: errorMessage,
            });
          }
        }

        return { action: "failed", error: errorMessage };
      }
    }

    // ============================================
    // PARALLEL BATCH PROCESSING
    // Process 10 products at a time for ~10x speedup
    // ============================================
    const PARALLEL_BATCH_SIZE = 10;
    const totalProducts = feedProducts.length;

    console.log(`[Sync] Starting parallel batch processing: ${totalProducts} products in batches of ${PARALLEL_BATCH_SIZE}`);

    for (let i = 0; i < totalProducts; i += PARALLEL_BATCH_SIZE) {
      const batch = feedProducts.slice(i, i + PARALLEL_BATCH_SIZE);
      const batchNumber = Math.floor(i / PARALLEL_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(totalProducts / PARALLEL_BATCH_SIZE);

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(product => syncSingleProduct(product))
      );

      // Count results
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          const { action, changeType, usedFastPath } = result.value;
          switch (action) {
            case "created":
              created++;
              changeBreakdownCounts.new++;
              break;
            case "updated":
              updated++;
              // Track by change type for updates
              if (changeType === "full") changeBreakdownCounts.full++;
              else if (changeType === "price") changeBreakdownCounts.price++;
              else if (changeType === "inventory") {
                changeBreakdownCounts.inventory++;
                if (usedFastPath) changeBreakdownCounts.inventoryFastPath++;
              }
              else changeBreakdownCounts.full++; // Default to full for unspecified
              break;
            case "skipped":
              skipped++;
              break;
            case "failed":
              failed++;
              break;
          }
        } else {
          // Promise rejected (unexpected error)
          failed++;
          console.error(`[Sync] Unexpected batch error:`, result.reason);
        }
      }

      // Progress logging
      const processed = Math.min(i + PARALLEL_BATCH_SIZE, totalProducts);
      console.log(
        `[Sync] Batch ${batchNumber}/${totalBatches} complete: ${processed}/${totalProducts} products (${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed)`
      );

      // Small delay between batches to respect rate limits
      if (i + PARALLEL_BATCH_SIZE < totalProducts) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Determine final status
    const finalStatus =
      failed > 0 && created + updated === 0
        ? "failed"
        : failed > 0
          ? "partial"
          : "completed";

    // Build change breakdown for reporting
    const changeBreakdown: SyncChangeBreakdown = {
      new: changeBreakdownCounts.new,
      full: changeBreakdownCounts.full,
      price: changeBreakdownCounts.price,
      inventory: changeBreakdownCounts.inventory,
      unchanged: skipped,
      total: feedProducts.length,
      inventoryFastPath: changeBreakdownCounts.inventoryFastPath,
    };

    // Log fast-path usage for monitoring
    if (changeBreakdownCounts.inventoryFastPath > 0) {
      console.log(
        `[Sync] Inventory fast-path used for ${changeBreakdownCounts.inventoryFastPath}/${changeBreakdownCounts.inventory} inventory updates`
      );
    }

    // Update sync run with final results
    await db
      .update(storeSyncRuns)
      .set({
        status: finalStatus,
        completedAt: new Date(),
        productsProcessed: feedProducts.length,
        productsCreated: created,
        productsUpdated: updated,
        productsSkipped: skipped,
        productsFailed: failed,
        errorMessage: failed > 0 ? `${failed} products failed to sync` : null,
        errors: syncErrors.length > 0 ? syncErrors : null,
        changeBreakdown,
      })
      .where(eq(storeSyncRuns.id, syncRun.id));

    // Update sync settings with results
    await db
      .update(feedSubscriptionSyncSettings)
      .set({
        lastSyncAt: new Date(),
        lastSyncError: failed > 0 ? `${failed} products failed to sync` : null,
        lastSyncProductCount: (created + updated).toString(),
        lastSyncChangeBreakdown: changeBreakdown,
        updatedAt: new Date(),
      })
      .where(eq(feedSubscriptionSyncSettings.id, syncSettings.id));

    console.log(
      `Product push completed: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed`
    );

    return {
      syncRunId: syncRun.id,
      created,
      updated,
      skipped,
      failed,
      total: feedProducts.length,
      changeBreakdown,
      completedAt: new Date().toISOString(),
    };
  },
});