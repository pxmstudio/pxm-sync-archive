"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

// ============================================
// Types
// ============================================

export type FieldSyncMode = "always" | "createOnly" | "ifEmpty";

export interface FieldMappingTransform {
  type: "prefix" | "suffix" | "replace" | "template" | "uppercase" | "lowercase";
  value?: string;
  pattern?: string;
  replacement?: string;
}

export interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  syncMode: FieldSyncMode;
  transform?: FieldMappingTransform;
  enabled: boolean;
}

export interface SyncExclusionRule {
  id: string;
  name: string;
  field: "brand" | "productType" | "tag" | "sku" | "price" | "title" | "stock";
  operator:
    | "equals"
    | "notEquals"
    | "contains"
    | "notContains"
    | "startsWith"
    | "endsWith"
    | "greaterThan"
    | "lessThan";
  value: string;
  enabled: boolean;
}

export interface FieldLockConfig {
  enabled: boolean;
  namespace: string;
  mappings: Partial<Record<string, string>>;
  lockInterpretation?: "lockWhenFalse" | "lockWhenTrue";
}

export type DefaultPublicationMode = "all" | "selected" | "none";

export interface DefaultPublications {
  mode: DefaultPublicationMode;
  publicationIds?: string[];
}

export interface SyncSettings {
  syncEnabled: boolean;
  syncImages: boolean;
  syncInventory: boolean;
  createNewProducts: boolean;
  deleteRemovedProducts: boolean;
  defaultStatus: "active" | "draft" | "archived";
  publishToChannels: boolean; // Legacy - kept for backward compatibility
  defaultPublications?: DefaultPublications | null; // New: proper publications config
  skuPrefix?: string;
  defaultVendor?: string;
  fieldLocks?: FieldLockConfig | null;
}

export interface RetailerFieldMapping {
  id: string;
  organizationId: string;
  integrationId: string;
  fieldMappings: FieldMapping[];
  exclusionRules: SyncExclusionRule[];
  syncSettings: SyncSettings;
  createdAt: string;
  updatedAt: string;
  integration?: {
    id: string;
    name: string;
    provider: string;
    externalIdentifier: string | null;
  };
}

export interface SourceFieldDefinition {
  field: string;
  label: string;
  type: "product" | "variant";
}

export interface ShopifyFieldDefinition {
  field: string;
  label: string;
  type: "product" | "variant";
}

export interface AvailableIntegration {
  id: string;
  name: string;
  provider: string;
  externalIdentifier: string | null;
  hasMappings: boolean;
}

export interface FieldMappingsListResponse {
  mappings: RetailerFieldMapping[];
  availableIntegrations: AvailableIntegration[];
  sourceFields: SourceFieldDefinition[];
  shopifyFields: ShopifyFieldDefinition[];
  defaultMappings: FieldMapping[];
}

export interface FilterOptions {
  brands: string[];
  productTypes: string[];
  tags: string[];
}

export interface FieldMappingsDetailResponse {
  mapping: RetailerFieldMapping | null;
  integration: {
    id: string;
    name: string;
    provider: string;
    externalIdentifier: string | null;
  };
  sourceFields: SourceFieldDefinition[];
  shopifyFields: ShopifyFieldDefinition[];
  defaultMappings: FieldMapping[];
  filterOptions?: FilterOptions;
}

export interface CreateFieldMappingsData {
  integrationId: string;
  fieldMappings?: FieldMapping[];
  exclusionRules?: SyncExclusionRule[];
  syncSettings?: Partial<SyncSettings>;
}

export interface UpdateFieldMappingsData {
  fieldMappings?: FieldMapping[];
  exclusionRules?: SyncExclusionRule[];
  syncSettings?: Partial<SyncSettings>;
}

// ============================================
// Hook
// ============================================

export function useFieldMappings(integrationId?: string) {
  const { getToken } = useAuth();
  const [listData, setListData] = useState<FieldMappingsListResponse | null>(null);
  const [detailData, setDetailData] = useState<FieldMappingsDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Fetch all field mappings for the organization
  const fetchFieldMappings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const response = await apiClient<FieldMappingsListResponse>(
        `/internal/field-mappings`,
        { token }
      );

      setListData(response);
      return response;
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch field mappings", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  // Fetch field mappings for a specific integration
  const fetchIntegrationMappings = useCallback(
    async (targetIntegrationId?: string) => {
      const id = targetIntegrationId || integrationId;
      if (!id) return null;

      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<FieldMappingsDetailResponse>(
          `/internal/field-mappings/${id}`,
          { token }
        );

        setDetailData(response);
        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch field mappings", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, integrationId]
  );

  // Create field mappings
  const createFieldMappings = useCallback(
    async (data: CreateFieldMappingsData) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<RetailerFieldMapping>(
          `/internal/field-mappings`,
          {
            token,
            method: "POST",
            body: JSON.stringify(data),
          }
        );

        // Refresh list data
        await fetchFieldMappings();

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to create field mappings", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, fetchFieldMappings]
  );

  // Update field mappings
  const updateFieldMappings = useCallback(
    async (targetIntegrationId: string, data: UpdateFieldMappingsData) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<RetailerFieldMapping>(
          `/internal/field-mappings/${targetIntegrationId}`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify(data),
          }
        );

        // Update detail data if we're looking at this integration
        if (detailData && detailData.integration.id === targetIntegrationId) {
          setDetailData({
            ...detailData,
            mapping: response,
          });
        }

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to update field mappings", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, detailData]
  );

  // Delete field mappings
  const deleteFieldMappings = useCallback(
    async (targetIntegrationId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        await apiClient(`/internal/field-mappings/${targetIntegrationId}`, {
          token,
          method: "DELETE",
        });

        // Clear detail data if we're looking at this integration
        if (detailData && detailData.integration.id === targetIntegrationId) {
          setDetailData({
            ...detailData,
            mapping: null,
          });
        }

        // Refresh list data
        await fetchFieldMappings();
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to delete field mappings", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, detailData, fetchFieldMappings]
  );

  // Reset to default mappings
  const resetToDefaults = useCallback(
    async (targetIntegrationId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<RetailerFieldMapping>(
          `/internal/field-mappings/${targetIntegrationId}/reset`,
          {
            token,
            method: "POST",
          }
        );

        // Update detail data if we're looking at this integration
        if (detailData && detailData.integration.id === targetIntegrationId) {
          setDetailData({
            ...detailData,
            mapping: response,
          });
        }

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to reset field mappings", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, detailData]
  );

  // Computed values
  const mappings = listData?.mappings ?? [];
  const availableIntegrations = listData?.availableIntegrations ?? [];
  const sourceFields = listData?.sourceFields ?? detailData?.sourceFields ?? [];
  const shopifyFields = listData?.shopifyFields ?? detailData?.shopifyFields ?? [];
  const defaultMappings = listData?.defaultMappings ?? detailData?.defaultMappings ?? [];
  const currentMapping = detailData?.mapping ?? null;
  const currentIntegration = detailData?.integration ?? null;
  const filterOptions = detailData?.filterOptions ?? { brands: [], productTypes: [], tags: [] };
  const hasMappings = currentMapping !== null;

  return {
    // State
    mappings,
    availableIntegrations,
    sourceFields,
    shopifyFields,
    defaultMappings,
    currentMapping,
    currentIntegration,
    filterOptions,
    isLoading,
    error,

    // Computed
    hasMappings,

    // Actions
    fetchFieldMappings,
    fetchIntegrationMappings,
    createFieldMappings,
    updateFieldMappings,
    deleteFieldMappings,
    resetToDefaults,
  };
}
