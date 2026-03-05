"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";
import type { Integration } from "./use-integrations";
import type { SyncExclusionRule } from "./use-field-mappings";

// ============================================
// Types
// ============================================

export interface FilterRules {
  brands?: string[];
  productTypes?: string[];
  tags?: string[];
  excludeBrands?: string[];
  excludeProductTypes?: string[];
  excludeTags?: string[];
  minPrice?: number;
  maxPrice?: number;
  requireStock?: boolean;
  excludeTitleKeywords?: string[];
  defaultToDraft?: boolean;
}

export type MappableField = "brand" | "productType" | "tag";

export interface FieldMappingRule {
  id: string;
  // What to match in the feed
  sourceField: MappableField;
  sourceValue: string;
  // What to set in Shopify
  targetField: MappableField;
  targetValue: string;
}

export interface PriceAdjustment {
  type: "percentage" | "fixed";
  value: number;
}

// ============================================
// Pricing Margin Types
// ============================================

export type MarginConditionField =
  | "brand"
  | "productType"
  | "tag"
  | "sku"
  | "price"
  | "compareAtPrice"
  | "costPrice";

export type MarginConditionOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "between";

export interface MarginCondition {
  field: MarginConditionField;
  operator: MarginConditionOperator;
  value: string | number | [number, number];
}

export type MarginType = "percentage" | "fixed";

export interface MarginRule {
  id: string;
  name: string;
  priority: number;
  conditions: MarginCondition[];
  marginType: MarginType;
  marginValue: number;
}

export interface PricingMarginRounding {
  enabled: boolean;
  strategy: "none" | "up" | "down" | "nearest";
  precision: number;
  endWith?: number;
}

export interface PricingMarginBounds {
  minPrice?: number;
  maxMarkup?: number;
}

export interface PricingMargin {
  defaultMargin: {
    type: MarginType;
    value: number;
  } | null;
  rules: MarginRule[];
  rounding?: PricingMarginRounding;
  bounds?: PricingMarginBounds;
}

// ============================================
// Field Lock Types (Custom Metafield Overrides)
// ============================================

export type LockableField =
  | "images"
  | "status"
  | "quantity"
  | "price"
  | "compareAtPrice"
  | "productType"
  | "description"
  | "title"
  | "vendor"
  | "tags";

export interface FieldLockConfig {
  enabled: boolean;
  namespace: string;
  mappings: Partial<Record<LockableField, string>>;
  lockInterpretation?: "lockWhenFalse" | "lockWhenTrue";
}

export const DEFAULT_FIELD_LOCK_MAPPINGS: Record<LockableField, string> = {
  images: "custom_images",
  status: "custom_status",
  quantity: "custom_quantity",
  price: "custom_price",
  compareAtPrice: "custom_compare_at_price",
  productType: "custom_product_type",
  description: "custom_description",
  title: "custom_title",
  vendor: "custom_vendor",
  tags: "custom_tags",
};

// ============================================
// Publication Override Types
// ============================================

export type PublicationOverrideMode = "default" | "override" | "none";

export interface PublicationOverride {
  mode: PublicationOverrideMode;
  publicationIds?: string[];
}

export interface SyncChangeBreakdown {
  new: number;
  full: number;
  price: number;
  inventory: number;
  unchanged: number;
  total: number;
  inventoryFastPath?: number;
}

export interface ShopifyPublication {
  id: string;
  name: string;
  appTitle?: string;
}

export type ProductStatus = "active" | "draft" | "archived";

export interface SyncSettings {
  id: string;
  subscriptionId: string;
  integrationId: string;
  syncEnabled: string;
  syncIntervalHours: string | null;
  filterRules: FilterRules | null;
  fieldMappings: FieldMappingRule[] | null;
  pricingMargin: PricingMargin | null;
  skuPrefix: string | null;
  fieldLocks: FieldLockConfig | null;
  publicationOverride: PublicationOverride | null;
  defaultProductStatus: ProductStatus | null;
  exclusionRules: SyncExclusionRule[] | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncProductCount: string | null;
  lastSyncChangeBreakdown: SyncChangeBreakdown | null;
  createdAt: string;
  updatedAt: string;
  integration?: {
    id: string;
    name: string;
    provider: string;
    externalIdentifier: string | null;
    isActive: string;
  };
}

export interface FilterOptions {
  brands: string[];
  productTypes: string[];
  tags: string[];
}

export interface SyncSettingsResponse {
  settings: SyncSettings | null;
  subscription: {
    id: string;
    status: string;
    feed: {
      id: string;
      name: string;
    };
  };
  availableIntegrations: Integration[];
  filterOptions: FilterOptions;
}

export interface SyncedProduct {
  id: string;
  syncSettingsId: string;
  sourceProductId: string;
  sourceVariantId: string;
  externalProductId: string | null;
  externalVariantId: string | null;
  syncStatus: "pending" | "synced" | "failed" | "deleted";
  lastError: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceProduct?: {
    id: string;
    name: string;
    brand: string | null;
    productType: string | null;
  };
  sourceVariant?: {
    id: string;
    sku: string | null;
    name: string | null;
  };
}

export interface CreateSyncSettingsData {
  integrationId: string;
  syncEnabled?: boolean;
  syncIntervalHours?: number;
  filterRules?: FilterRules;
  fieldMappings?: FieldMappingRule[];
  pricingMargin?: PricingMargin | null;
  skuPrefix?: string | null;
  fieldLocks?: FieldLockConfig | null;
  publicationOverride?: PublicationOverride | null;
  defaultProductStatus?: ProductStatus | null;
  exclusionRules?: SyncExclusionRule[] | null;
}

export interface UpdateSyncSettingsData {
  syncEnabled?: boolean;
  syncIntervalHours?: number;
  filterRules?: FilterRules;
  fieldMappings?: FieldMappingRule[];
  pricingMargin?: PricingMargin | null;
  skuPrefix?: string | null;
  fieldLocks?: FieldLockConfig | null;
  publicationOverride?: PublicationOverride | null;
  defaultProductStatus?: ProductStatus | null;
  exclusionRules?: SyncExclusionRule[] | null;
}

// ============================================
// Hook
/**
 * Manages sync settings and synced products for a subscription.
 *
 * Provides functions to fetch, create, update, and delete sync settings, trigger sync jobs, and list synced products. Exposes current settings, filter options, available integrations, synced products with pagination, loading and syncing flags, and any API error.
 *
 * @param subscriptionId - The subscription ID whose sync settings are managed
 * @returns An object containing state (settings, filterOptions, availableIntegrations, subscription, syncedProducts, syncedProductsPagination, isLoading, isSyncing, error), computed flags (isSyncEnabled, hasSettings), and actions (fetchSyncSettings, createSyncSettings, updateSyncSettings, deleteSyncSettings, triggerSync, fetchSyncedProducts)
 */

export function useSyncSettings(subscriptionId: string) {
  const { getToken } = useAuth();
  const [data, setData] = useState<SyncSettingsResponse | null>(null);
  const [syncedProducts, setSyncedProducts] = useState<SyncedProduct[]>([]);
  const [syncedProductsPagination, setSyncedProductsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchSyncSettings = useCallback(async () => {
    if (!subscriptionId) return null;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const response = await apiClient<SyncSettingsResponse>(
        `/internal/subscriptions/${subscriptionId}/sync-settings`,
        { token }
      );

      setData(response);
      return response;
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch sync settings", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken, subscriptionId]);

  const createSyncSettings = useCallback(
    async (settingsData: CreateSyncSettingsData) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<SyncSettings>(
          `/internal/subscriptions/${subscriptionId}/sync-settings`,
          {
            token,
            method: "POST",
            body: JSON.stringify(settingsData),
          }
        );

        // Refresh data
        await fetchSyncSettings();

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to create sync settings", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, subscriptionId, fetchSyncSettings]
  );

  const updateSyncSettings = useCallback(
    async (settingsData: UpdateSyncSettingsData) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<SyncSettings>(
          `/internal/subscriptions/${subscriptionId}/sync-settings`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify(settingsData),
          }
        );

        // Update local state
        if (data) {
          setData({
            ...data,
            settings: response,
          });
        }

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to update sync settings", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, subscriptionId, data]
  );

  const deleteSyncSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      await apiClient(`/internal/subscriptions/${subscriptionId}/sync-settings`, {
        token,
        method: "DELETE",
      });

      // Clear local state
      if (data) {
        setData({
          ...data,
          settings: null,
        });
      }
      setSyncedProducts([]);
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to delete sync settings", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken, subscriptionId, data]);

  const triggerSync = useCallback(
    async (
      syncType: "full" | "incremental" = "incremental",
      options?: { forceFullSync?: boolean }
    ) => {
      setIsSyncing(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<{
          message: string;
          syncSettingsId: string;
          jobId: string;
        }>(`/internal/subscriptions/${subscriptionId}/sync-settings/trigger`, {
          token,
          method: "POST",
          body: JSON.stringify({
            syncType,
            forceFullSync: options?.forceFullSync ?? false,
          }),
        });

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to trigger sync", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsSyncing(false);
      }
    },
    [getToken, subscriptionId]
  );

  const changeBulkStatus = useCallback(
    async (status: "active" | "draft" | "archived", publicationIds?: string[]) => {
      setIsSyncing(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<{
          message: string;
          syncSettingsId: string;
          jobId: string;
        }>(`/internal/subscriptions/${subscriptionId}/sync-settings/bulk-status`, {
          token,
          method: "POST",
          body: JSON.stringify({
            status,
            ...(publicationIds && publicationIds.length > 0 && { publicationIds }),
          }),
        });

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to change bulk status", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsSyncing(false);
      }
    },
    [getToken, subscriptionId]
  );

  const fetchSyncedProducts = useCallback(
    async (page = 1, limit = 20) => {
      if (!subscriptionId) return null;

      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<{
          items: SyncedProduct[];
          pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
          };
        }>(
          `/internal/subscriptions/${subscriptionId}/synced-products?page=${page}&limit=${limit}`,
          { token }
        );

        setSyncedProducts(response.items);
        setSyncedProductsPagination(response.pagination);
        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch synced products", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, subscriptionId]
  );

  // Computed values
  const settings = data?.settings ?? null;
  const filterOptions = data?.filterOptions ?? { brands: [], productTypes: [], tags: [] };
  const availableIntegrations = data?.availableIntegrations ?? [];
  const subscription = data?.subscription ?? null;
  const isSyncEnabled = settings?.syncEnabled === "true";
  const hasSettings = settings !== null;

  return {
    // State
    settings,
    filterOptions,
    availableIntegrations,
    subscription,
    syncedProducts,
    syncedProductsPagination,
    isLoading,
    isSyncing,
    error,

    // Computed
    isSyncEnabled,
    hasSettings,

    // Actions
    fetchSyncSettings,
    createSyncSettings,
    updateSyncSettings,
    deleteSyncSettings,
    triggerSync,
    changeBulkStatus,
    fetchSyncedProducts,
  };
}