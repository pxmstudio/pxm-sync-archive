"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";
import type { PricingMargin, FieldLockConfig } from "./use-sync-settings";
import type { SyncExclusionRule } from "./use-field-mappings";

// ============================================
// Types
// ============================================

export type DefaultPublicationMode = "all" | "selected" | "none";

export interface DefaultPublications {
  mode: DefaultPublicationMode;
  publicationIds?: string[];
}

export interface ShopifyPublication {
  id: string;
  name: string;
  handle?: string;
  autoPublish: boolean;
}

export interface GlobalSyncSettings {
  // Pricing margin
  pricingMargin?: PricingMargin | null;

  // Publications / Sales Channels
  defaultPublications?: DefaultPublications | null;

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
  fieldLocks?: FieldLockConfig | null;

  // Exclusion rules
  exclusionRules?: SyncExclusionRule[];
}

export interface GlobalSyncSettingsResponse {
  syncSettings: GlobalSyncSettings;
}

export interface AvailablePublicationsResponse {
  publications: ShopifyPublication[];
  integrationId: string | null;
}

export type UpdateGlobalSyncSettingsData = Partial<GlobalSyncSettings>;

// ============================================
// Hook
// ============================================

export function useGlobalSyncSettings() {
  const { getToken } = useAuth();
  const [syncSettings, setSyncSettings] = useState<GlobalSyncSettings | null>(
    null
  );
  const [availablePublications, setAvailablePublications] = useState<ShopifyPublication[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPublications, setIsLoadingPublications] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchSyncSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const response = await apiClient<GlobalSyncSettingsResponse>(
        `/internal/organizations/me/sync-settings`,
        { token }
      );

      setSyncSettings(response.syncSettings);
      return response.syncSettings;
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
  }, [getToken]);

  const updateSyncSettings = useCallback(
    async (data: UpdateGlobalSyncSettingsData) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<GlobalSyncSettingsResponse>(
          `/internal/organizations/me/sync-settings`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify(data),
          }
        );

        setSyncSettings(response.syncSettings);
        return response.syncSettings;
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
    [getToken]
  );

  const fetchAvailablePublications = useCallback(async () => {
    setIsLoadingPublications(true);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const response = await apiClient<AvailablePublicationsResponse>(
        `/internal/organizations/me/available-publications`,
        { token }
      );

      setAvailablePublications(response.publications);
      return response;
    } catch (err) {
      console.error("Failed to fetch publications:", err);
      return { publications: [], integrationId: null };
    } finally {
      setIsLoadingPublications(false);
    }
  }, [getToken]);

  return {
    syncSettings,
    availablePublications,
    isLoading,
    isLoadingPublications,
    error,
    fetchSyncSettings,
    updateSyncSettings,
    fetchAvailablePublications,
  };
}
