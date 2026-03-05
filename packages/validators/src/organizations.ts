import { z } from "zod";
import {
  organizationId,
  email,
  url,
  slug,
  phone,
  organizationRoles,
} from "./common.js";

// ============================================
// Organization Settings
// ============================================

export const organizationSettings = z.object({
  // Notification preferences
  notifications: z
    .object({
      inventoryLow: z.boolean().optional(),
      connectionRequest: z.boolean().optional(),
    })
    .optional(),
});

export type OrganizationSettings = z.infer<typeof organizationSettings>;

// ============================================
// Create Organization
// ============================================

export const createOrganization = z.object({
  roles: organizationRoles.default(["supplier"]),
  name: z.string().min(1).max(255),
  slug: slug,
  logoUrl: url.nullable().optional(),
  website: url.nullable().optional(),
  description: z.string().max(2000).nullable().optional(),

  // Contact
  contactFirstName: z.string().max(100).nullable().optional(),
  contactLastName: z.string().max(100).nullable().optional(),
  contactEmail: email.nullable().optional(),
  contactPhone: phone.nullable().optional(),

  // Default currency (ISO 4217)
  defaultCurrency: z.string().length(3).optional(),

  // Settings
  settings: organizationSettings.optional(),
});

export type CreateOrganization = z.infer<typeof createOrganization>;

// ============================================
// Update Organization
// ============================================

export const updateOrganization = createOrganization
  .omit({ roles: true, slug: true })
  .partial();

// Schema for adding a role to an organization
export const addOrganizationRole = z.object({
  role: z.enum(["supplier", "retailer"]),
});

export type UpdateOrganization = z.infer<typeof updateOrganization>;
export type AddOrganizationRole = z.infer<typeof addOrganizationRole>;

// ============================================
// Organization Response
// ============================================

export const organization = createOrganization.extend({
  id: organizationId,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Organization = z.infer<typeof organization>;

// ============================================
// Organization List Filters
// ============================================

export const organizationFilters = z.object({
  // Filter by organizations that have a specific role
  hasRole: z.enum(["supplier", "retailer"]).optional(),
  search: z.string().max(100).optional(),
});

export type OrganizationFilters = z.infer<typeof organizationFilters>;

// ============================================
// Supplier Visibility Settings
// ============================================

export const supplierVisibilitySettings = z.object({
  isPublic: z.boolean(),
  publicDescription: z.string().max(2000).nullable().optional(),
});

export type SupplierVisibilitySettings = z.infer<
  typeof supplierVisibilitySettings
>;

// ============================================
// Public Supplier (for discovery)
// ============================================

export const publicSupplier = z.object({
  id: organizationId,
  name: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable(),
  website: z.string().nullable(),
  publicDescription: z.string().nullable(),
  isPublic: z.boolean(),
});

export type PublicSupplier = z.infer<typeof publicSupplier>;
