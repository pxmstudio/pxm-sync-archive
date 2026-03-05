import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import { tasks } from "@trigger.dev/sdk";
import {
  feedSubscriptions,
  feedSubscriptionSyncSettings,
  feeds,
  products,
  integrations,
  computeSettingsHash,
} from "@workspace/db";
import { success, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// Validators
// ============================================

const filterRulesSchema = z.object({
  brands: z.array(z.string()).optional(),
  productTypes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  excludeBrands: z.array(z.string()).optional(),
  excludeProductTypes: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  requireStock: z.boolean().optional(),
  excludeTitleKeywords: z.array(z.string()).optional(),
  defaultToDraft: z.boolean().optional(),
});

const fieldMappingRuleSchema = z.object({
  id: z.string(),
  sourceField: z.enum(["brand", "productType", "tag"]),
  sourceValue: z.string(),
  targetField: z.enum(["brand", "productType", "tag"]),
  targetValue: z.string(),
});

const marginConditionSchema = z.object({
  field: z.enum([
    "brand",
    "productType",
    "tag",
    "sku",
    "price",
    "compareAtPrice",
    "costPrice",
  ]),
  operator: z.enum([
    "equals",
    "notEquals",
    "contains",
    "notContains",
    "startsWith",
    "endsWith",
    "greaterThan",
    "lessThan",
    "between",
  ]),
  value: z.union([z.string(), z.number(), z.tuple([z.number(), z.number()])]),
});

const marginRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  priority: z.number(),
  conditions: z.array(marginConditionSchema),
  marginType: z.enum(["percentage", "fixed"]),
  marginValue: z.number(),
});

const pricingMarginSchema = z.object({
  defaultMargin: z
    .object({
      type: z.enum(["percentage", "fixed"]),
      value: z.number(),
    })
    .nullable(),
  rules: z.array(marginRuleSchema),
  rounding: z
    .object({
      enabled: z.boolean(),
      strategy: z.enum(["none", "up", "down", "nearest"]),
      precision: z.number(),
      endWith: z.number().optional(),
    })
    .optional(),
  bounds: z
    .object({
      minPrice: z.number().optional(),
      maxMarkup: z.number().optional(),
    })
    .optional(),
});

const fieldLockConfigSchema = z.object({
  enabled: z.boolean(),
  namespace: z.string().default("custom"),
  mappings: z.record(
    z.enum([
      "images",
      "status",
      "quantity",
      "price",
      "compareAtPrice",
      "productType",
      "description",
      "title",
      "vendor",
      "tags",
    ]),
    z.string()
  ),
  lockInterpretation: z.enum(["lockWhenFalse", "lockWhenTrue"]).optional(),
});

const publicationOverrideSchema = z.object({
  mode: z.enum(["default", "override", "none"]),
  publicationIds: z.array(z.string()).optional(),
});

const productStatusSchema = z.enum(["active", "draft", "archived"]);

const exclusionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  field: z.enum(["brand", "productType", "tag", "sku", "price", "title", "stock"]),
  operator: z.enum([
    "equals",
    "notEquals",
    "contains",
    "notContains",
    "startsWith",
    "endsWith",
    "greaterThan",
    "lessThan",
  ]),
  value: z.string(),
  enabled: z.boolean(),
});

const createSyncSettingsSchema = z.object({
  integrationId: z.string(),
  syncEnabled: z.boolean().optional().default(false),
  syncIntervalHours: z.number().optional(),
  filterRules: filterRulesSchema.optional(),
  fieldMappings: z.array(fieldMappingRuleSchema).optional(),
  pricingMargin: pricingMarginSchema.nullable().optional(),
  skuPrefix: z.string().max(20).nullable().optional(), // e.g., "GGB-"
  fieldLocks: fieldLockConfigSchema.nullable().optional(),
  publicationOverride: publicationOverrideSchema.nullable().optional(),
  defaultProductStatus: productStatusSchema.nullable().optional(),
  exclusionRules: z.array(exclusionRuleSchema).nullable().optional(),
});

const updateSyncSettingsSchema = z.object({
  syncEnabled: z.boolean().optional(),
  syncIntervalHours: z.number().optional(),
  filterRules: filterRulesSchema.optional(),
  fieldMappings: z.array(fieldMappingRuleSchema).optional(),
  pricingMargin: pricingMarginSchema.nullable().optional(),
  skuPrefix: z.string().max(20).nullable().optional(),
  fieldLocks: fieldLockConfigSchema.nullable().optional(),
  publicationOverride: publicationOverrideSchema.nullable().optional(),
  defaultProductStatus: productStatusSchema.nullable().optional(),
  exclusionRules: z.array(exclusionRuleSchema).nullable().optional(),
});

const triggerSyncSchema = z.object({
  syncType: z.enum(["full", "incremental"]).default("incremental"),
  forceFullSync: z.boolean().optional().default(false),
});

// ============================================
// GET /internal/subscriptions/:id/sync-settings
// ============================================

app.get("/:id/sync-settings", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const subscriptionId = c.req.param("id");

  // Verify subscription exists and belongs to this retailer
  const subscription = await db.query.feedSubscriptions.findFirst({
    where: and(
      eq(feedSubscriptions.id, subscriptionId),
      eq(feedSubscriptions.retailerId, auth.organizationId)
    ),
    with: {
      feed: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!subscription) {
    throw Errors.notFound("Subscription");
  }

  // Get sync settings for this subscription
  const settings = await db.query.feedSubscriptionSyncSettings.findFirst({
    where: eq(feedSubscriptionSyncSettings.subscriptionId, subscriptionId),
    with: {
      integration: {
        columns: {
          id: true,
          name: true,
          provider: true,
          externalIdentifier: true,
          isActive: true,
        },
      },
    },
  });

  // Get available Shopify integrations for this retailer
  const availableIntegrations = await db
    .select({
      id: integrations.id,
      name: integrations.name,
      provider: integrations.provider,
      externalIdentifier: integrations.externalIdentifier,
      isActive: integrations.isActive,
    })
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, auth.organizationId),
        eq(integrations.provider, "shopify"),
        eq(integrations.isActive, "true")
      )
    );

  // Get filter options (brands, productTypes, tags) from feed products
  const feedId = subscription.feedId;

  const [brandsResult, productTypesResult, tagsResult] = await Promise.all([
    db
      .selectDistinct({ brand: products.brand })
      .from(products)
      .where(
        and(
          eq(products.feedId, feedId),
          eq(products.isActive, "true"),
          isNull(products.deletedAt),
          sql`${products.brand} IS NOT NULL AND ${products.brand} != ''`
        )
      ),
    db
      .selectDistinct({ productType: products.productType })
      .from(products)
      .where(
        and(
          eq(products.feedId, feedId),
          eq(products.isActive, "true"),
          isNull(products.deletedAt),
          sql`${products.productType} IS NOT NULL AND ${products.productType} != ''`
        )
      ),
    db
      .select({ tags: products.tags })
      .from(products)
      .where(
        and(
          eq(products.feedId, feedId),
          eq(products.isActive, "true"),
          isNull(products.deletedAt),
          sql`${products.tags} IS NOT NULL`
        )
      ),
  ]);

  // Extract unique tags from all products
  const allTags = new Set<string>();
  for (const row of tagsResult) {
    if (Array.isArray(row.tags)) {
      for (const tag of row.tags) {
        if (tag) allTags.add(tag);
      }
    }
  }

  return success(c, {
    settings: settings || null,
    subscription: {
      id: subscription.id,
      status: subscription.isActive ? "active" : "inactive",
      feed: subscription.feed,
    },
    availableIntegrations,
    filterOptions: {
      brands: brandsResult.map((r) => r.brand).filter(Boolean) as string[],
      productTypes: productTypesResult
        .map((r) => r.productType)
        .filter(Boolean) as string[],
      tags: Array.from(allTags).sort(),
    },
  });
});

// ============================================
// POST /internal/subscriptions/:id/sync-settings
// ============================================

app.post(
  "/:id/sync-settings",
  zValidator("json", createSyncSettingsSchema),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const subscriptionId = c.req.param("id");
    const data = c.req.valid("json");

    // Verify subscription exists and belongs to this retailer
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.id, subscriptionId),
        eq(feedSubscriptions.retailerId, auth.organizationId)
      ),
    });

    if (!subscription) {
      throw Errors.notFound("Subscription");
    }

    // Verify integration belongs to this retailer
    const integration = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.id, data.integrationId),
        eq(integrations.organizationId, auth.organizationId)
      ),
    });

    if (!integration) {
      throw Errors.notFound("Integration");
    }

    // Check if sync settings already exist
    const existing = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.subscriptionId, subscriptionId),
    });

    if (existing) {
      throw Errors.alreadyExists("Sync settings for this subscription");
    }

    // Compute settings hash for change detection
    const settingsHash = computeSettingsHash({
      filterRules: data.filterRules || {},
      pricingMargin: data.pricingMargin || null,
      fieldMappings: data.fieldMappings || [],
      fieldLocks: data.fieldLocks || null,
      skuPrefix: data.skuPrefix || null,
      defaultProductStatus: data.defaultProductStatus || null,
      exclusionRules: data.exclusionRules || null,
    });

    // Create sync settings
    const [settings] = await db
      .insert(feedSubscriptionSyncSettings)
      .values({
        subscriptionId,
        integrationId: data.integrationId,
        syncEnabled: data.syncEnabled ? "true" : "false",
        syncIntervalHours: data.syncIntervalHours?.toString() || "24",
        filterRules: data.filterRules || {},
        fieldMappings: data.fieldMappings || [],
        pricingMargin: data.pricingMargin || null,
        skuPrefix: data.skuPrefix || null,
        fieldLocks: data.fieldLocks || null,
        publicationOverride: data.publicationOverride || null,
        defaultProductStatus: data.defaultProductStatus || null,
        exclusionRules: data.exclusionRules || null,
        // Change detection
        settingsHash,
        settingsChangedAt: new Date(),
      })
      .returning();

    return success(c, settings, 201);
  }
);

// ============================================
// PATCH /internal/subscriptions/:id/sync-settings
// ============================================

app.patch(
  "/:id/sync-settings",
  zValidator("json", updateSyncSettingsSchema),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const subscriptionId = c.req.param("id");
    const data = c.req.valid("json");

    // Verify subscription exists and belongs to this retailer
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.id, subscriptionId),
        eq(feedSubscriptions.retailerId, auth.organizationId)
      ),
    });

    if (!subscription) {
      throw Errors.notFound("Subscription");
    }

    // Get existing sync settings
    const existing = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.subscriptionId, subscriptionId),
    });

    if (!existing) {
      throw Errors.notFound("Sync settings");
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.syncEnabled !== undefined) {
      updates.syncEnabled = data.syncEnabled ? "true" : "false";
    }
    if (data.syncIntervalHours !== undefined) {
      updates.syncIntervalHours = data.syncIntervalHours.toString();
    }
    if (data.filterRules !== undefined) {
      updates.filterRules = data.filterRules;
    }
    if (data.fieldMappings !== undefined) {
      updates.fieldMappings = data.fieldMappings;
    }
    if (data.pricingMargin !== undefined) {
      updates.pricingMargin = data.pricingMargin;
    }
    if (data.skuPrefix !== undefined) {
      updates.skuPrefix = data.skuPrefix;
    }
    if (data.fieldLocks !== undefined) {
      updates.fieldLocks = data.fieldLocks;
    }
    if (data.publicationOverride !== undefined) {
      updates.publicationOverride = data.publicationOverride;
    }
    if (data.defaultProductStatus !== undefined) {
      updates.defaultProductStatus = data.defaultProductStatus;
    }
    if (data.exclusionRules !== undefined) {
      updates.exclusionRules = data.exclusionRules;
    }

    // Check if any settings that affect product output changed
    const settingsFields = [
      "filterRules",
      "fieldMappings",
      "pricingMargin",
      "skuPrefix",
      "fieldLocks",
      "defaultProductStatus",
      "exclusionRules",
    ] as const;

    const settingsChanged = settingsFields.some(
      (field) => data[field] !== undefined
    );

    if (settingsChanged) {
      // Compute new settings hash with merged values
      const newSettingsHash = computeSettingsHash({
        filterRules: data.filterRules ?? existing.filterRules ?? {},
        pricingMargin: data.pricingMargin ?? existing.pricingMargin ?? null,
        fieldMappings: data.fieldMappings ?? existing.fieldMappings ?? [],
        fieldLocks: data.fieldLocks ?? existing.fieldLocks ?? null,
        skuPrefix: data.skuPrefix ?? existing.skuPrefix ?? null,
        defaultProductStatus: data.defaultProductStatus ?? existing.defaultProductStatus ?? null,
        exclusionRules: data.exclusionRules ?? existing.exclusionRules ?? null,
      });

      updates.settingsHash = newSettingsHash;
      updates.settingsChangedAt = new Date();
    }

    // Update sync settings
    const [settings] = await db
      .update(feedSubscriptionSyncSettings)
      .set(updates)
      .where(eq(feedSubscriptionSyncSettings.id, existing.id))
      .returning();

    return success(c, settings);
  }
);

// ============================================
// DELETE /internal/subscriptions/:id/sync-settings
// ============================================

app.delete("/:id/sync-settings", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const subscriptionId = c.req.param("id");

  // Verify subscription exists and belongs to this retailer
  const subscription = await db.query.feedSubscriptions.findFirst({
    where: and(
      eq(feedSubscriptions.id, subscriptionId),
      eq(feedSubscriptions.retailerId, auth.organizationId)
    ),
  });

  if (!subscription) {
    throw Errors.notFound("Subscription");
  }

  // Delete sync settings
  await db
    .delete(feedSubscriptionSyncSettings)
    .where(eq(feedSubscriptionSyncSettings.subscriptionId, subscriptionId));

  return success(c, { deleted: true });
});

// ============================================
// POST /internal/subscriptions/:id/sync-settings/trigger
// ============================================

app.post(
  "/:id/sync-settings/trigger",
  zValidator("json", triggerSyncSchema),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const env = c.env;
    const subscriptionId = c.req.param("id");
    const { syncType, forceFullSync } = c.req.valid("json");

    // Verify subscription exists and belongs to this retailer
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.id, subscriptionId),
        eq(feedSubscriptions.retailerId, auth.organizationId)
      ),
    });

    if (!subscription) {
      throw Errors.notFound("Subscription");
    }

    // Get sync settings
    const settings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.subscriptionId, subscriptionId),
    });

    if (!settings) {
      throw Errors.notFound("Sync settings");
    }

    // Trigger actual sync job via Trigger.dev
    // Use concurrencyKey per integration to prevent concurrent syncs to the same Shopify store
    const handle = await tasks.trigger(
      "store-push-products",
      {
        syncSettingsId: settings.id,
        syncType,
        triggeredBy: "manual" as const,
        forceFullSync,
      },
      {
        concurrencyKey: settings.integrationId,
      }
    );

    const syncDescription = forceFullSync
      ? "Force full sync"
      : syncType === "full"
        ? "Full sync"
        : "Incremental sync";

    return success(c, {
      message: `${syncDescription} triggered`,
      syncSettingsId: settings.id,
      jobId: handle.id,
      forceFullSync,
    });
  }
);

// ============================================
// POST /internal/subscriptions/:id/sync-settings/bulk-status
// ============================================

const bulkStatusSchema = z.object({
  status: z.enum(["active", "draft", "archived"]),
  publicationIds: z.array(z.string()).optional(),
});

app.post(
  "/:id/sync-settings/bulk-status",
  zValidator("json", bulkStatusSchema),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const subscriptionId = c.req.param("id");
    const { status, publicationIds } = c.req.valid("json");

    // Verify subscription exists and belongs to this retailer
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.id, subscriptionId),
        eq(feedSubscriptions.retailerId, auth.organizationId)
      ),
    });

    if (!subscription) {
      throw Errors.notFound("Subscription");
    }

    // Get sync settings
    const settings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.subscriptionId, subscriptionId),
    });

    if (!settings) {
      throw Errors.notFound("Sync settings");
    }

    // Map lowercase status to Shopify API format (uppercase)
    const statusMap: Record<string, "ACTIVE" | "DRAFT" | "ARCHIVED"> = {
      active: "ACTIVE",
      draft: "DRAFT",
      archived: "ARCHIVED",
    };
    const targetStatus = statusMap[status];

    // Trigger bulk status change task
    const handle = await tasks.trigger(
      "store-bulk-change-status",
      {
        syncSettingsId: settings.id,
        targetStatus,
        triggeredBy: "manual" as const,
        publicationIds: publicationIds && publicationIds.length > 0 ? publicationIds : undefined,
      },
      {
        concurrencyKey: settings.integrationId,
      }
    );

    return success(c, {
      message: `Bulk status change to ${status} triggered`,
      syncSettingsId: settings.id,
      jobId: handle.id,
    });
  }
);

export default app;
