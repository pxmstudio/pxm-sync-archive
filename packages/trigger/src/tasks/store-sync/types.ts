/**
 * Type definitions for store sync
 */

import type { GlobalSyncSettings as OrgGlobalSyncSettings } from "@workspace/db";

export interface StorePushProductsPayload {
  /** The sync settings ID for this push */
  syncSettingsId: string;
  /** Type of sync: full = all matching products, incremental = only changed products */
  syncType: "full" | "incremental";
  /** Optional: specific product IDs to sync (for targeted sync) */
  productIds?: string[];
  /** How the sync was triggered */
  triggeredBy?: "schedule" | "manual" | "feed_import";
  /** User who triggered manual sync */
  triggeredByUserId?: string;
  /** Integration ID for concurrency control - only one sync per store at a time */
  integrationId?: string;
  /** Force full sync even in incremental mode */
  forceFullSync?: boolean;
  /** Breakdown of change types for optimization routing */
  changeBreakdown?: {
    new: number;
    inventory: number;
    price: number;
    full: number;
  };
}

/** Change type for incremental sync routing */
export type SyncChangeType = "new" | "full" | "price" | "inventory";

export interface ProductWithVariants {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  productType: string | null;
  tags: string[] | null;
  images: Array<{
    url: string;
    altText?: string;
    width?: number;
    height?: number;
    position?: number;
  }> | null;
  /** Soft delete timestamp - if set, product should be drafted/inactive */
  deletedAt: Date | null;
  variants: Array<{
    id: string;
    externalId: string | null;
    name: string | null;
    sku: string | null;
    barcode: string | null;
    price: string | null;
    compareAtPrice: string | null;
    costPrice: string | null;
    currency: string;
    weight: string | null;
    weightUnit: string | null;
    attributes: Record<string, string> | null;
    inventoryQuantity: number;
  }>;
}

export interface GlobalSyncSettings {
  syncEnabled: boolean;
  syncImages: boolean;
  syncInventory: boolean;
  createNewProducts: boolean;
  deleteRemovedProducts: boolean;
  defaultStatus: "active" | "draft" | "archived";
  publishToChannels: boolean;
  skuPrefix?: string;
  defaultVendor?: string;
}

/** Organization-level settings (from organizations.settings) */
export interface OrganizationSettings {
  syncSettings?: OrgGlobalSyncSettings;
}
