import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, isNull, inArray } from "drizzle-orm";
import {
  integrations,
  retailerFieldMappings,
  feedSubscriptions,
  products,
  DEFAULT_FIELD_MAPPINGS,
  SOURCE_FIELDS,
  SHOPIFY_FIELDS,
} from "@workspace/db";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// Validation Schemas
// ============================================

const fieldMappingSchema = z.object({
  id: z.string(),
  sourceField: z.string(),
  targetField: z.string(),
  syncMode: z.enum(["always", "createOnly", "ifEmpty"]),
  transform: z
    .object({
      type: z.enum(["prefix", "suffix", "replace", "template", "uppercase", "lowercase"]),
      value: z.string().optional(),
      pattern: z.string().optional(),
      replacement: z.string().optional(),
    })
    .optional(),
  enabled: z.boolean(),
});

const exclusionRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  field: z.enum(["brand", "productType", "tag", "sku", "price"]),
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

const syncSettingsSchema = z.object({
  syncEnabled: z.boolean(),
  syncImages: z.boolean(),
  syncInventory: z.boolean(),
  createNewProducts: z.boolean(),
  deleteRemovedProducts: z.boolean(),
  defaultStatus: z.enum(["active", "draft", "archived"]),
  publishToChannels: z.boolean(),
  skuPrefix: z.string().optional(),
  defaultVendor: z.string().optional(),
  fieldLocks: fieldLockConfigSchema.nullable().optional(),
});

const createFieldMappingsSchema = z.object({
  integrationId: z.string().min(1),
  fieldMappings: z.array(fieldMappingSchema).optional(),
  exclusionRules: z.array(exclusionRuleSchema).optional(),
  syncSettings: syncSettingsSchema.optional(),
});

const updateFieldMappingsSchema = z.object({
  fieldMappings: z.array(fieldMappingSchema).optional(),
  exclusionRules: z.array(exclusionRuleSchema).optional(),
  syncSettings: syncSettingsSchema.partial().optional(),
});

// ============================================
// Routes
// ============================================

// GET /internal/field-mappings - Get field mappings for the current organization
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  // Get retailer's export integrations
  const retailerIntegrations = await db.query.integrations.findMany({
    where: and(
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.isActive, "true")
    ),
  });

  const exportIntegrations = retailerIntegrations.filter(
    (i) => (i.settings as Record<string, unknown>)?.purpose === "export"
  );

  // Get field mappings for each integration
  const mappings = await db.query.retailerFieldMappings.findMany({
    where: eq(retailerFieldMappings.organizationId, auth.organizationId),
    with: {
      integration: {
        columns: {
          id: true,
          name: true,
          provider: true,
          externalIdentifier: true,
        },
      },
    },
  });

  return success(c, {
    mappings,
    availableIntegrations: exportIntegrations.map((i) => ({
      id: i.id,
      name: i.name,
      provider: i.provider,
      externalIdentifier: i.externalIdentifier,
      hasMappings: mappings.some((m) => m.integrationId === i.id),
    })),
    sourceFields: SOURCE_FIELDS,
    shopifyFields: SHOPIFY_FIELDS,
    defaultMappings: DEFAULT_FIELD_MAPPINGS,
  });
});

// GET /internal/field-mappings/:integrationId - Get field mappings for a specific integration
app.get("/:integrationId", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const integrationId = c.req.param("integrationId");

  // Verify integration belongs to retailer
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, integrationId),
      eq(integrations.organizationId, auth.organizationId)
    ),
  });

  if (!integration) {
    throw Errors.notFound("Integration");
  }

  // Get field mappings
  const mapping = await db.query.retailerFieldMappings.findFirst({
    where: and(
      eq(retailerFieldMappings.organizationId, auth.organizationId),
      eq(retailerFieldMappings.integrationId, integrationId)
    ),
  });

  // Get filter options from retailer's subscribed feeds
  const subscriptions = await db.query.feedSubscriptions.findMany({
    where: and(
      eq(feedSubscriptions.retailerId, auth.organizationId),
      eq(feedSubscriptions.isActive, true)
    ),
    columns: { feedId: true },
  });

  const feedIds = subscriptions.map((s) => s.feedId);

  let filterOptions = {
    brands: [] as string[],
    productTypes: [] as string[],
    tags: [] as string[],
  };

  if (feedIds.length > 0) {
    const [brandsResult, productTypesResult, tagsResult] = await Promise.all([
      db
        .selectDistinct({ brand: products.brand })
        .from(products)
        .where(
          and(
            inArray(products.feedId, feedIds),
            eq(products.isActive, "true"),
            isNull(products.deletedAt),
            sql`${products.brand} IS NOT NULL AND ${products.brand} != ''`
          )
        )
        .limit(500),
      db
        .selectDistinct({ productType: products.productType })
        .from(products)
        .where(
          and(
            inArray(products.feedId, feedIds),
            eq(products.isActive, "true"),
            isNull(products.deletedAt),
            sql`${products.productType} IS NOT NULL AND ${products.productType} != ''`
          )
        )
        .limit(500),
      db
        .select({ tags: products.tags })
        .from(products)
        .where(
          and(
            inArray(products.feedId, feedIds),
            eq(products.isActive, "true"),
            isNull(products.deletedAt),
            sql`${products.tags} IS NOT NULL`
          )
        )
        .limit(1000),
    ]);

    // Extract unique tags
    const allTags = new Set<string>();
    for (const row of tagsResult) {
      if (Array.isArray(row.tags)) {
        for (const tag of row.tags) {
          if (tag) allTags.add(tag);
        }
      }
    }

    filterOptions = {
      brands: brandsResult.map((r) => r.brand).filter(Boolean).sort() as string[],
      productTypes: productTypesResult.map((r) => r.productType).filter(Boolean).sort() as string[],
      tags: Array.from(allTags).sort(),
    };
  }

  return success(c, {
    mapping: mapping || null,
    integration: {
      id: integration.id,
      name: integration.name,
      provider: integration.provider,
      externalIdentifier: integration.externalIdentifier,
    },
    sourceFields: SOURCE_FIELDS,
    shopifyFields: SHOPIFY_FIELDS,
    defaultMappings: DEFAULT_FIELD_MAPPINGS,
    filterOptions,
  });
});

// POST /internal/field-mappings - Create field mappings
app.post("/", zValidator("json", createFieldMappingsSchema), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const data = c.req.valid("json");

  // Verify integration belongs to retailer
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.id, data.integrationId),
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.isActive, "true")
    ),
  });

  if (!integration) {
    throw Errors.notFound("Integration");
  }

  // Check if mapping already exists
  const existing = await db.query.retailerFieldMappings.findFirst({
    where: and(
      eq(retailerFieldMappings.organizationId, auth.organizationId),
      eq(retailerFieldMappings.integrationId, data.integrationId)
    ),
  });

  if (existing) {
    throw Errors.alreadyExists("Field mappings for this integration");
  }

  const [mapping] = await db
    .insert(retailerFieldMappings)
    .values({
      organizationId: auth.organizationId,
      integrationId: data.integrationId,
      fieldMappings: data.fieldMappings || DEFAULT_FIELD_MAPPINGS,
      exclusionRules: data.exclusionRules || [],
      syncSettings: data.syncSettings || {
        syncEnabled: false,
        syncImages: true,
        syncInventory: true,
        createNewProducts: true,
        deleteRemovedProducts: false,
        defaultStatus: "draft" as const,
        publishToChannels: false,
      },
    })
    .returning();

  return success(c, mapping, 201);
});

// PATCH /internal/field-mappings/:integrationId - Update field mappings
app.patch(
  "/:integrationId",
  zValidator("json", updateFieldMappingsSchema),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const integrationId = c.req.param("integrationId");
    const data = c.req.valid("json");

    // Get existing mapping
    const existing = await db.query.retailerFieldMappings.findFirst({
      where: and(
        eq(retailerFieldMappings.organizationId, auth.organizationId),
        eq(retailerFieldMappings.integrationId, integrationId)
      ),
    });

    if (!existing) {
      throw Errors.notFound("Field mappings");
    }

    // Build the update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.fieldMappings !== undefined) {
      updateData.fieldMappings = data.fieldMappings;
    }

    if (data.exclusionRules !== undefined) {
      updateData.exclusionRules = data.exclusionRules;
    }

    if (data.syncSettings !== undefined) {
      // Merge with existing sync settings to maintain required fields
      const existingSettings = (existing.syncSettings as Record<string, unknown>) || {
        syncImages: true,
        syncInventory: true,
        createNewProducts: true,
        deleteRemovedProducts: false,
        defaultStatus: "draft",
        publishToChannels: false,
      };
      updateData.syncSettings = {
        ...existingSettings,
        ...data.syncSettings,
      };
    }

    const [updated] = await db
      .update(retailerFieldMappings)
      .set(updateData)
      .where(eq(retailerFieldMappings.id, existing.id))
      .returning();

    return success(c, updated);
  }
);

// DELETE /internal/field-mappings/:integrationId - Delete field mappings
app.delete("/:integrationId", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const integrationId = c.req.param("integrationId");

  // Get existing mapping
  const existing = await db.query.retailerFieldMappings.findFirst({
    where: and(
      eq(retailerFieldMappings.organizationId, auth.organizationId),
      eq(retailerFieldMappings.integrationId, integrationId)
    ),
  });

  if (!existing) {
    throw Errors.notFound("Field mappings");
  }

  await db
    .delete(retailerFieldMappings)
    .where(eq(retailerFieldMappings.id, existing.id));

  return c.body(null, 204);
});

// POST /internal/field-mappings/:integrationId/reset - Reset to default mappings
app.post("/:integrationId/reset", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const integrationId = c.req.param("integrationId");

  // Get existing mapping
  const existing = await db.query.retailerFieldMappings.findFirst({
    where: and(
      eq(retailerFieldMappings.organizationId, auth.organizationId),
      eq(retailerFieldMappings.integrationId, integrationId)
    ),
  });

  if (!existing) {
    throw Errors.notFound("Field mappings");
  }

  const [updated] = await db
    .update(retailerFieldMappings)
    .set({
      fieldMappings: DEFAULT_FIELD_MAPPINGS,
      updatedAt: new Date(),
    })
    .where(eq(retailerFieldMappings.id, existing.id))
    .returning();

  return success(c, updated);
});

export default app;
