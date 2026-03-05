/**
 * Migration routes for importing data from legacy systems
 *
 * These endpoints help migrate stores from older sync systems (e.g., gogobaby)
 * to PXM-Sync while preserving existing Shopify bindings.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql } from "drizzle-orm";
import {
  feedSubscriptionSyncSettings,
  feedSyncedProducts,
  feedSubscriptions,
  products,
  variants,
  integrations,
} from "@workspace/db";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";
import { z } from "zod";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// Binding Import Schema
// ============================================

/**
 * Schema for a single legacy binding.
 * Accepts numeric IDs from the legacy system.
 */
const legacyBindingSchema = z.object({
  // Legacy product ID (from legacy database)
  legacyProductId: z.union([z.string(), z.number()]),
  // Legacy variant ID (optional, from legacy database)
  legacyVariantId: z.union([z.string(), z.number()]).optional(),
  // SKU used to match products in PXM-Sync
  sku: z.string(),
  // Shopify product ID (numeric, e.g., 9319097008457)
  shopifyProductId: z.union([z.string(), z.number()]),
  // Shopify variant ID (numeric, e.g., 49079251820873)
  shopifyVariantId: z.union([z.string(), z.number()]).optional(),
  // Optional: sync status from legacy system
  status: z.enum(["synced", "pending", "failed"]).optional().default("synced"),
});

const importBindingsSchema = z.object({
  // The sync settings ID to import bindings into
  syncSettingsId: z.string(),
  // Array of legacy bindings to import
  bindings: z.array(legacyBindingSchema).min(1).max(1000),
  // Whether to overwrite existing bindings
  overwriteExisting: z.boolean().optional().default(false),
  // Whether to validate SKUs exist before importing
  validateSkus: z.boolean().optional().default(true),
});

// ============================================
// Helper Functions
// ============================================

/**
 * Convert a numeric Shopify ID to GID format
 */
function toShopifyGid(
  numericId: string | number,
  type: "Product" | "ProductVariant"
): string {
  const id = typeof numericId === "number" ? numericId.toString() : numericId;

  // If already a GID, return as-is
  if (id.startsWith("gid://")) {
    return id;
  }

  // Convert numeric ID to GID
  return `gid://shopify/${type}/${id}`;
}

/**
 * Extract numeric ID from a Shopify GID
 */
function fromShopifyGid(gid: string): string {
  if (!gid.startsWith("gid://")) {
    return gid;
  }
  const parts = gid.split("/");
  return parts[parts.length - 1] ?? gid;
}

// ============================================
// Routes
// ============================================

/**
 * POST /internal/migration/bindings/import
 *
 * Import product bindings from a legacy sync system.
 * This endpoint accepts legacy numeric Shopify IDs and converts them to GIDs
 * for storage in PXM-Sync.
 *
 * Used during migration to preserve existing Shopify product bindings.
 */
app.post(
  "/bindings/import",
  zValidator("json", importBindingsSchema),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const data = c.req.valid("json");

    // Verify sync settings exist and belong to user's organization
    const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.id, data.syncSettingsId),
    });

    if (!syncSettings) {
      throw Errors.notFound("Sync settings");
    }

    // Verify integration belongs to organization
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.id, syncSettings.integrationId),
        eq(integrations.organizationId, auth.organizationId)
      ),
    });

    if (!integration) {
      throw Errors.forbidden("Access denied to this sync settings");
    }

    // Get subscription to find the feed
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: eq(feedSubscriptions.id, syncSettings.subscriptionId),
    });

    if (!subscription) {
      throw Errors.notFound("Subscription");
    }

    // Build SKU lookup map if validation is enabled
    const skuToVariantMap = new Map<
      string,
      { productId: string; variantId: string }
    >();

    if (data.validateSkus) {
      // Fetch all variants for this feed by SKU
      const feedVariants = await db
        .select({
          productId: variants.productId,
          variantId: variants.id,
          sku: variants.sku,
        })
        .from(variants)
        .innerJoin(products, eq(products.id, variants.productId))
        .where(eq(products.feedId, subscription.feedId));

      for (const v of feedVariants) {
        if (v.sku) {
          skuToVariantMap.set(v.sku, {
            productId: v.productId,
            variantId: v.variantId,
          });
        }
      }
    }

    // Process bindings
    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ sku: string; error: string }>,
    };

    for (const binding of data.bindings) {
      try {
        // Look up product/variant by SKU
        let productId: string | null = null;
        let variantId: string | null = null;

        if (data.validateSkus) {
          const match = skuToVariantMap.get(binding.sku);
          if (!match) {
            results.failed++;
            results.errors.push({
              sku: binding.sku,
              error: `SKU not found in feed: ${binding.sku}`,
            });
            continue;
          }
          productId = match.productId;
          variantId = match.variantId;
        } else {
          // Without validation, try to find the variant directly
          const variant = await db.query.variants.findFirst({
            where: eq(variants.sku, binding.sku),
          });
          if (variant) {
            productId = variant.productId;
            variantId = variant.id;
          }
        }

        if (!productId || !variantId) {
          results.failed++;
          results.errors.push({
            sku: binding.sku,
            error: `Could not find product/variant for SKU: ${binding.sku}`,
          });
          continue;
        }

        // Convert numeric Shopify IDs to GIDs
        const externalProductId = toShopifyGid(
          binding.shopifyProductId,
          "Product"
        );
        const externalVariantId = binding.shopifyVariantId
          ? toShopifyGid(binding.shopifyVariantId, "ProductVariant")
          : null;

        // Check for existing binding
        const existing = await db.query.feedSyncedProducts.findFirst({
          where: and(
            eq(feedSyncedProducts.syncSettingsId, data.syncSettingsId),
            eq(feedSyncedProducts.sourceVariantId, variantId)
          ),
        });

        if (existing) {
          if (data.overwriteExisting) {
            // Update existing binding
            await db
              .update(feedSyncedProducts)
              .set({
                externalProductId,
                externalVariantId,
                syncStatus: binding.status || "synced",
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(feedSyncedProducts.id, existing.id));
            results.imported++;
          } else {
            results.skipped++;
          }
        } else {
          // Create new binding
          await db.insert(feedSyncedProducts).values({
            syncSettingsId: data.syncSettingsId,
            sourceProductId: productId,
            sourceVariantId: variantId,
            externalProductId,
            externalVariantId,
            syncStatus: binding.status || "synced",
            lastSyncedAt: new Date(),
          });
          results.imported++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          sku: binding.sku,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return success(c, {
      message: `Imported ${results.imported} bindings`,
      total: data.bindings.length,
      ...results,
    });
  }
);

/**
 * POST /internal/migration/bindings/export
 *
 * Export existing bindings in a format that can be used for backup
 * or migration to another system.
 */
app.post(
  "/bindings/export",
  zValidator(
    "json",
    z.object({
      syncSettingsId: z.string(),
      format: z.enum(["json", "csv"]).optional().default("json"),
    })
  ),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const data = c.req.valid("json");

    // Verify access
    const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.id, data.syncSettingsId),
    });

    if (!syncSettings) {
      throw Errors.notFound("Sync settings");
    }

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.id, syncSettings.integrationId),
        eq(integrations.organizationId, auth.organizationId)
      ),
    });

    if (!integration) {
      throw Errors.forbidden("Access denied");
    }

    // Fetch all bindings with variant SKU
    const bindings = await db
      .select({
        id: feedSyncedProducts.id,
        sourceProductId: feedSyncedProducts.sourceProductId,
        sourceVariantId: feedSyncedProducts.sourceVariantId,
        externalProductId: feedSyncedProducts.externalProductId,
        externalVariantId: feedSyncedProducts.externalVariantId,
        syncStatus: feedSyncedProducts.syncStatus,
        lastSyncedAt: feedSyncedProducts.lastSyncedAt,
        sku: variants.sku,
      })
      .from(feedSyncedProducts)
      .innerJoin(variants, eq(variants.id, feedSyncedProducts.sourceVariantId))
      .where(eq(feedSyncedProducts.syncSettingsId, data.syncSettingsId));

    // Convert GIDs to numeric for export (legacy format)
    const exportData = bindings.map((b) => ({
      sku: b.sku,
      sourceProductId: b.sourceProductId,
      sourceVariantId: b.sourceVariantId,
      shopifyProductId: b.externalProductId
        ? fromShopifyGid(b.externalProductId)
        : null,
      shopifyVariantId: b.externalVariantId
        ? fromShopifyGid(b.externalVariantId)
        : null,
      status: b.syncStatus,
      lastSyncedAt: b.lastSyncedAt?.toISOString() || null,
    }));

    if (data.format === "csv") {
      // Return as CSV
      const headers = [
        "sku",
        "sourceProductId",
        "sourceVariantId",
        "shopifyProductId",
        "shopifyVariantId",
        "status",
        "lastSyncedAt",
      ];
      const csvRows = [
        headers.join(","),
        ...exportData.map((row) =>
          headers.map((h) => JSON.stringify(row[h as keyof typeof row] ?? "")).join(",")
        ),
      ];
      return new Response(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="bindings-export-${data.syncSettingsId}.csv"`,
        },
      });
    }

    return success(c, {
      syncSettingsId: data.syncSettingsId,
      count: exportData.length,
      bindings: exportData,
    });
  }
);

/**
 * GET /internal/migration/bindings/stats
 *
 * Get statistics about bindings for a sync settings.
 */
app.get(
  "/bindings/stats",
  zValidator(
    "query",
    z.object({
      syncSettingsId: z.string(),
    })
  ),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const { syncSettingsId } = c.req.valid("query");

    // Verify access
    const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.id, syncSettingsId),
    });

    if (!syncSettings) {
      throw Errors.notFound("Sync settings");
    }

    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.id, syncSettings.integrationId),
        eq(integrations.organizationId, auth.organizationId)
      ),
    });

    if (!integration) {
      throw Errors.forbidden("Access denied");
    }

    // Get binding counts by status
    const stats = await db
      .select({
        syncStatus: feedSyncedProducts.syncStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(feedSyncedProducts)
      .where(eq(feedSyncedProducts.syncSettingsId, syncSettingsId))
      .groupBy(feedSyncedProducts.syncStatus);

    const total = stats.reduce((sum, s) => sum + s.count, 0);
    const byStatus = Object.fromEntries(stats.map((s) => [s.syncStatus, s.count]));

    return success(c, {
      syncSettingsId,
      total,
      byStatus,
    });
  }
);

export default app;
