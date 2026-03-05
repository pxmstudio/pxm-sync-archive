import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, sql, and } from "drizzle-orm";
import { z } from "zod";
import { organizations, integrations } from "@workspace/db";
import type { OrganizationSettings, GlobalSyncSettings } from "@workspace/db";
import { createClerkClient } from "@clerk/backend";
import {
  updateOrganization,
  addOrganizationRole,
  supplierVisibilitySettings,
  globalSyncSettings,
} from "@workspace/validators";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

// Notification settings validator
const notificationSettings = z.object({
  inventoryLow: z.boolean().optional(),
  connectionRequest: z.boolean().optional(),
  // Digest email preferences
  weeklyDigest: z.boolean().optional(),
  monthlyDigest: z.boolean().optional(),
});

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /internal/organizations/me - Get current organization
app.get("/me", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, auth.organizationId),
  });

  if (!org) {
    throw Errors.notFound("Organization");
  }

  return success(c, org);
});

// PATCH /internal/organizations/me - Update organization
app.patch("/me", zValidator("json", updateOrganization, (result, c) => {
  if (!result.success) {
    console.error("Validation failed for organization update:", JSON.stringify(result.error.errors, null, 2));
    return c.json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: result.error.errors,
      },
    }, 400);
  }
}), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const data = c.req.valid("json");

  // Require admin or owner role
  if (auth.membershipRole !== "admin" && auth.membershipRole !== "owner") {
    throw Errors.forbidden("Admin access required");
  }

  const [updated] = await db
    .update(organizations)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, auth.organizationId))
    .returning();

  if (!updated) {
    throw Errors.notFound("Organization");
  }

  return success(c, updated);
});

// GET /internal/organizations/me/members - List organization members
app.get("/me/members", async (c) => {
  const auth = c.get("auth")!;

  const clerkClient = createClerkClient({
    secretKey: c.env.CLERK_SECRET_KEY,
  });

  // Get organization members from Clerk (source of truth)
  const { data: memberships } = await clerkClient.organizations.getOrganizationMembershipList({
    organizationId: auth.clerkOrgId,
  });

  // Map Clerk role to internal role
  const mapRole = (clerkRole: string) => {
    if (clerkRole === "org:admin" || clerkRole.includes("admin")) {
      return "admin";
    }
    return "member";
  };

  return success(
    c,
    memberships.map((m) => ({
      id: m.id,
      clerkUserId: m.publicUserData?.userId || "",
      role: mapRole(m.role),
      user: {
        id: m.publicUserData?.userId || "",
        email: m.publicUserData?.identifier || "",
        name: [m.publicUserData?.firstName, m.publicUserData?.lastName]
          .filter(Boolean)
          .join(" ") || null,
        avatarUrl: m.publicUserData?.imageUrl || null,
      },
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    }))
  );
});

// POST /internal/organizations/me/roles - Add a role to the organization
app.post("/me/roles", zValidator("json", addOrganizationRole), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const { role } = c.req.valid("json");

  // Require admin or owner role
  if (auth.membershipRole !== "admin" && auth.membershipRole !== "owner") {
    throw Errors.forbidden("Admin access required");
  }

  // Check if org already has this role
  if (auth.organizationRoles.includes(role)) {
    throw Errors.badRequest(`Organization already has ${role} role`);
  }

  // Add the role to the organization
  const [updated] = await db
    .update(organizations)
    .set({
      roles: sql`array_append(${organizations.roles}, ${role})`,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, auth.organizationId))
    .returning();

  if (!updated) {
    throw Errors.notFound("Organization");
  }

  return success(c, {
    roles: updated.roles,
    message: `${role} role added successfully`,
  });
});

// PATCH /internal/organizations/me/visibility - Update visibility settings (supplier only)
app.patch(
  "/me/visibility",
  zValidator("json", supplierVisibilitySettings),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const data = c.req.valid("json");

    // Require admin or owner role
    if (auth.membershipRole !== "admin" && auth.membershipRole !== "owner") {
      throw Errors.forbidden("Admin access required");
    }

    const [updated] = await db
      .update(organizations)
      .set({
        isPublic: data.isPublic,
        publicDescription: data.publicDescription ?? null,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, auth.organizationId))
      .returning();

    if (!updated) {
      throw Errors.notFound("Organization");
    }

    return success(c, {
      isPublic: updated.isPublic,
      publicDescription: updated.publicDescription,
    });
  }
);

// GET /internal/organizations/me/visibility - Get visibility settings (supplier only)
app.get("/me/visibility", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, auth.organizationId),
    columns: {
      isPublic: true,
      publicDescription: true,
    },
  });

  if (!org) {
    throw Errors.notFound("Organization");
  }

  return success(c, org);
});

// ============================================
// Global Sync Settings (Retailer only)
// ============================================

// Default global sync settings
const DEFAULT_GLOBAL_SYNC_SETTINGS: GlobalSyncSettings = {
  pricingMargin: undefined,
  defaultPublications: undefined,
  defaultStatus: "draft",
  createNewProducts: true,
  deleteRemovedProducts: false,
  syncImages: true,
  syncInventory: true,
  skuPrefix: undefined,
  defaultVendor: undefined,
  fieldLocks: undefined,
};

// GET /internal/organizations/me/sync-settings - Get global sync settings
app.get("/me/sync-settings", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, auth.organizationId),
    columns: {
      settings: true,
    },
  });

  if (!org) {
    throw Errors.notFound("Organization");
  }

  const settings = org.settings as OrganizationSettings | undefined;
  const syncSettings: GlobalSyncSettings = {
    ...DEFAULT_GLOBAL_SYNC_SETTINGS,
    ...settings?.syncSettings,
  };

  return success(c, { syncSettings });
});

// PATCH /internal/organizations/me/sync-settings - Update global sync settings
app.patch(
  "/me/sync-settings",
  zValidator("json", globalSyncSettings),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const data = c.req.valid("json");

    // Require admin or owner role
    if (auth.membershipRole !== "admin" && auth.membershipRole !== "owner") {
      throw Errors.forbidden("Admin access required");
    }

    // Get current settings
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, auth.organizationId),
      columns: {
        settings: true,
      },
    });

    if (!org) {
      throw Errors.notFound("Organization");
    }

    const currentSettings = (org.settings as OrganizationSettings) || {};

    // Merge new sync settings with existing
    const updatedSyncSettings: GlobalSyncSettings = {
      ...currentSettings.syncSettings,
      ...data,
      // Handle nullable fields explicitly
      pricingMargin: data.pricingMargin !== undefined ? (data.pricingMargin ?? undefined) : currentSettings.syncSettings?.pricingMargin,
      defaultPublications: data.defaultPublications !== undefined ? (data.defaultPublications ?? undefined) : currentSettings.syncSettings?.defaultPublications,
      fieldLocks: data.fieldLocks !== undefined ? (data.fieldLocks ?? undefined) : currentSettings.syncSettings?.fieldLocks,
    };

    // Update settings
    const updatedSettings: OrganizationSettings = {
      ...currentSettings,
      syncSettings: updatedSyncSettings,
    };

    const [updated] = await db
      .update(organizations)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, auth.organizationId))
      .returning();

    if (!updated) {
      throw Errors.notFound("Organization");
    }

    return success(c, { syncSettings: updatedSyncSettings });
  }
);

// GET /internal/organizations/me/available-publications - Get available publications from Shopify
app.get("/me/available-publications", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  // Find the active Shopify integration for this organization
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.organizationId, auth.organizationId),
      eq(integrations.provider, "shopify"),
      eq(integrations.isActive, "true")
    ),
  });

  if (!integration) {
    return success(c, { publications: [], integrationId: null });
  }

  // Get publications from integration settings
  const settings = integration.settings as { publications?: Array<{ id: string; name: string; handle?: string; autoPublish: boolean }> } | null;
  const publications = settings?.publications || [];

  return success(c, {
    publications,
    integrationId: integration.id,
  });
});

// ============================================
// Notification Settings
// ============================================

// GET /internal/organizations/me/notifications - Get notification settings
app.get("/me/notifications", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, auth.organizationId),
    columns: {
      settings: true,
    },
  });

  if (!org) {
    throw Errors.notFound("Organization");
  }

  const settings = org.settings as OrganizationSettings | undefined;
  const notifications = {
    inventoryLow: true,
    connectionRequest: true,
    weeklyDigest: false,
    monthlyDigest: false,
    ...settings?.notifications,
  };

  return success(c, { notifications });
});

// PATCH /internal/organizations/me/notifications - Update notification settings
app.patch(
  "/me/notifications",
  zValidator("json", notificationSettings),
  async (c) => {
    const auth = c.get("auth")!;
    const db = c.get("db");
    const data = c.req.valid("json");

    // Require admin or owner role
    if (auth.membershipRole !== "admin" && auth.membershipRole !== "owner") {
      throw Errors.forbidden("Admin access required");
    }

    // Get current settings
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, auth.organizationId),
      columns: {
        settings: true,
      },
    });

    if (!org) {
      throw Errors.notFound("Organization");
    }

    const currentSettings = (org.settings as OrganizationSettings) || {};

    // Update settings with new notification config
    const updatedSettings: OrganizationSettings = {
      ...currentSettings,
      notifications: {
        ...currentSettings.notifications,
        ...data,
      },
    };

    const [updated] = await db
      .update(organizations)
      .set({
        settings: updatedSettings,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, auth.organizationId))
      .returning();

    if (!updated) {
      throw Errors.notFound("Organization");
    }

    return success(c, {
      notifications: updatedSettings.notifications,
    });
  }
);

export default app;
