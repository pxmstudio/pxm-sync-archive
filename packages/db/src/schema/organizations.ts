import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { idGenerator } from "../lib/typeid";
import type { PricingMargin, FieldLockConfig } from "./sync-settings";

// ============================================
// Global Sync Settings Types
// ============================================

export type DefaultPublicationMode = "all" | "selected" | "none";

export interface DefaultPublications {
  /** Mode: "all" = use integration defaults, "selected" = specific channels, "none" = don't publish */
  mode: DefaultPublicationMode;
  /** When mode="selected", these publication IDs will be used */
  publicationIds?: string[];
}

export interface GlobalSyncSettings {
  // Pricing margin (existing)
  pricingMargin?: PricingMargin;

  // Publications / Sales Channels
  defaultPublications?: DefaultPublications;

  // Product behavior
  defaultStatus?: "active" | "draft" | "archived";
  createNewProducts?: boolean;
  deleteRemovedProducts?: boolean;

  // Data sync
  syncImages?: boolean;
  syncInventory?: boolean;

  // Defaults
  skuPrefix?: string;
  defaultVendor?: string;

  // Field locks
  fieldLocks?: FieldLockConfig;
}

// Valid organization roles
export const ORGANIZATION_ROLES = ["supplier", "retailer"] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const organizations = pgTable(
  "organizations",
  {
    id: text("id").primaryKey().$defaultFn(idGenerator("organization")),

    // External auth provider ID (Clerk, Auth0, etc.)
    externalAuthId: text("external_auth_id").notNull().unique(),

    // Organization roles (can be both supplier and retailer, empty = pending selection)
    roles: text("roles")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    // Basic info (from Clerk)
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logoUrl: text("logo_url"),
    website: text("website"),
    description: text("description"),

    // Contact person info
    contactFirstName: text("contact_first_name"),
    contactLastName: text("contact_last_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    // Supplier discovery (visibility)
    isPublic: boolean("is_public").default(false),
    publicDescription: text("public_description"),

    // Default currency (ISO 4217 code)
    defaultCurrency: text("default_currency").default("USD"),

    // Flexible settings storage
    settings: jsonb("settings").$type<OrganizationSettings>().default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (_table) => [
    // Roles array can be empty (pending role selection during onboarding)
  ]
);

// Type-safe settings interface
export interface OrganizationSettings {
  // Global sync settings (retailer only)
  // These apply to all feed syncs unless overridden per-subscription
  syncSettings?: GlobalSyncSettings;

  // Notification preferences
  notifications?: {
    inventoryLow?: boolean;
    connectionRequest?: boolean;
    // Digest email preferences
    weeklyDigest?: boolean;
    monthlyDigest?: boolean;
    // Sync notification preferences
    syncCompleted?: boolean;
    syncFailed?: boolean;
    newProducts?: boolean;
    integrationIssues?: boolean;
  };

  // Onboarding state
  onboarding?: {
    completedAt?: string;
    currentStep?:
      | "role-selection"
      | "integrations"
      | "profile"
      | "team"
      | "complete";
    steps?: {
      integrations?: {
        shopify?: boolean;
        completedAt?: string;
      };
      profile?: {
        completed?: boolean;
        completedAt?: string;
      };
      team?: {
        completed?: boolean;
        completedAt?: string;
      };
    };
  };

  // Newsletter subscription
  newsletterSubscribed?: boolean;
}

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
