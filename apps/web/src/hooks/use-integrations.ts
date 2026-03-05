"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface IntegrationSettings {
  shopifyApiVersion?: string;
  shopifyLocationIds?: string[];
  purpose?: "import" | "export";
  exportEnabled?: boolean;
  defaultSyncInterval?: number;
  defaultPriceAdjustment?: {
    type: "percentage" | "fixed";
    value: number;
  };
  webhooksRegistered?: boolean;
  webhooksRegisteredAt?: string;
  webhooksError?: string;
}

export interface Integration {
  id: string;
  organizationId: string;
  provider: "shopify" | "custom";
  name: string;
  externalIdentifier: string | null;
  scopes: string[];
  settings: IntegrationSettings | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectShopifyData {
  shopDomain: string;
  accessToken: string;
}

export interface ConnectShopifyResponse extends Integration {
  shopName: string;
  purpose: "import" | "export";
  webhooksRegistered?: boolean;
  webhooksError?: string;
}

export interface MetafieldDefinition {
  id: string;
  namespace: string;
  key: string;
  name: string;
  type: string;
  fullKey: string; // namespace.key
}

export function useIntegrations() {
  const { getToken } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const response = await apiClient<Integration[]>(
        "/internal/integrations",
        { token }
      );

      setIntegrations(response);
      return response;
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch integrations", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  const connectShopify = useCallback(
    async (data: ConnectShopifyData) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<ConnectShopifyResponse>(
          "/internal/integrations/shopify/connect",
          {
            token,
            method: "POST",
            body: JSON.stringify(data),
          }
        );

        // Refresh the list
        await fetchIntegrations();

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to connect Shopify", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, fetchIntegrations]
  );

  const updateIntegration = useCallback(
    async (
      id: string,
      data: { name?: string; settings?: Partial<IntegrationSettings>; isActive?: boolean }
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<Integration>(
          `/internal/integrations/${id}`,
          {
            token,
            method: "PATCH",
            body: JSON.stringify(data),
          }
        );

        // Update local state
        setIntegrations((prev) =>
          prev.map((i) => (i.id === id ? response : i))
        );

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to update integration", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  const disconnectIntegration = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        await apiClient(`/internal/integrations/${id}`, {
          token,
          method: "DELETE",
        });

        // Remove from local state
        setIntegrations((prev) => prev.filter((i) => i.id !== id));
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to disconnect integration", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  // Filter to get only export integrations (for retailers)
  const exportIntegrations = integrations.filter(
    (i) => i.settings?.purpose === "export"
  );

  // Get active Shopify integration for export
  const activeShopifyIntegration = exportIntegrations.find(
    (i) => i.provider === "shopify" && i.isActive === "true"
  );

  const fetchMetafieldDefinitions = useCallback(
    async (integrationId: string, namespace?: string) => {
      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const url = namespace
          ? `/internal/integrations/${integrationId}/metafield-definitions?namespace=${encodeURIComponent(namespace)}`
          : `/internal/integrations/${integrationId}/metafield-definitions`;

        const response = await apiClient<{
          metafieldDefinitions: MetafieldDefinition[];
          integrationId: string;
        }>(url, { token });

        return response.metafieldDefinitions;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch metafield definitions", 500);
        throw apiError;
      }
    },
    [getToken]
  );

  return {
    integrations,
    exportIntegrations,
    activeShopifyIntegration,
    isLoading,
    error,
    fetchIntegrations,
    connectShopify,
    updateIntegration,
    disconnectIntegration,
    fetchMetafieldDefinitions,
  };
}

/**
 * Hook to fetch metafield definitions for a specific integration
 */
export function useMetafieldDefinitions(integrationId: string | undefined, namespace?: string) {
  const { getToken } = useAuth();
  const [definitions, setDefinitions] = useState<MetafieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchDefinitions = useCallback(async () => {
    if (!integrationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const url = namespace
        ? `/internal/integrations/${integrationId}/metafield-definitions?namespace=${encodeURIComponent(namespace)}`
        : `/internal/integrations/${integrationId}/metafield-definitions`;

      const response = await apiClient<{
        metafieldDefinitions: MetafieldDefinition[];
        integrationId: string;
      }>(url, { token });

      setDefinitions(response.metafieldDefinitions);
      return response.metafieldDefinitions;
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch metafield definitions", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken, integrationId, namespace]);

  return {
    definitions,
    isLoading,
    error,
    fetchDefinitions,
  };
}

/**
 * Store metadata cached from Shopify
 */
export interface StoreMetadata {
  integrationId: string;
  vendors: string[];
  productTypes: string[];
  tags: string[];
  productCount: number | null;
  lastRefreshedAt: string | null;
  refreshError: string | null;
  currency: string | null;
}

/**
 * Hook to fetch cached Shopify store metadata (vendors, product types, tags)
 */
export function useStoreMetadata(integrationId: string | undefined) {
  const { getToken } = useAuth();
  const [metadata, setMetadata] = useState<StoreMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchMetadata = useCallback(async () => {
    if (!integrationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const response = await apiClient<StoreMetadata>(
        `/internal/integrations/${integrationId}/store-metadata`,
        { token }
      );

      setMetadata(response);
      return response;
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch store metadata", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken, integrationId]);

  return {
    metadata,
    isLoading,
    error,
    fetchMetadata,
  };
}
