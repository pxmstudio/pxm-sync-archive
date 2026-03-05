"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";

// ============================================
// Types
// ============================================

export interface StoreData {
  integrationId: string;
  currency: string | null;
  vendors: string[];
  productTypes: string[];
  tags: string[];
  productCount: number | null;
  lastRefreshedAt: string | null;
}

// Query key for store data
export const STORE_QUERY_KEY = ["store"] as const;

// ============================================
// Helper: Get currency symbol from currency code
// ============================================

/**
 * Convert a currency code to its symbol (e.g., "USD" -> "$", "EUR" -> "€", "RON" -> "RON")
 */
export function getCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    const symbolPart = parts.find((p) => p.type === "currency");
    return symbolPart?.value || currencyCode;
  } catch {
    return currencyCode;
  }
}

// ============================================
// Types for integrations
// ============================================

interface Integration {
  id: string;
  provider: string;
  isActive: string;
  settings?: { purpose?: string };
}

// ============================================
// Hook
// ============================================

/**
 * Loads and exposes store data (currency, vendors, product types, tags) for the active Shopify integration.
 *
 * Uses React Query for caching - data is fetched once and cached for 5 minutes.
 * Components can use this hook directly without needing a separate provider.
 *
 * @returns An object containing:
 * - `store`: the full store data or undefined
 * - `currency`: the store's currency code (e.g., "USD", "EUR", "RON")
 * - `currencySymbol`: the currency symbol (e.g., "$", "€", "RON")
 * - `vendors`, `productTypes`, `tags`: store metadata arrays
 * - query state: `isLoading`, `isError`, `error`
 * - actions: `invalidate()` to invalidate the cache, `refetch()` to re-fetch
 */
export function useStore() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  // First, fetch integrations to find the active Shopify one
  const integrationsQuery = useQuery({
    queryKey: ["integrations"],
    queryFn: async (): Promise<Integration[]> => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return apiClient<Integration[]>(
        "/internal/integrations",
        { token }
      );
    },
    enabled: isAuthLoaded && isSignedIn === true,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Find active Shopify export integration
  const activeIntegration = integrationsQuery.data?.find(
    (i) =>
      i.provider === "shopify" &&
      i.isActive === "true" &&
      i.settings?.purpose === "export"
  );
  const integrationId = activeIntegration?.id;

  // Then fetch store metadata
  const storeQuery = useQuery({
    queryKey: [...STORE_QUERY_KEY, integrationId],
    queryFn: async (): Promise<StoreData> => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      if (!integrationId) throw new Error("No active Shopify integration");
      return apiClient<StoreData>(
        `/internal/integrations/${integrationId}/store-metadata`,
        { token }
      );
    },
    enabled: isAuthLoaded && isSignedIn === true && !!integrationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Helper to invalidate store data
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: STORE_QUERY_KEY });
  };

  // Helper to refetch store data
  const refetch = () => {
    return storeQuery.refetch();
  };

  // Compute currency symbol
  const currency = storeQuery.data?.currency || "USD";
  const currencySymbol = getCurrencySymbol(currency);

  return {
    // Data
    store: storeQuery.data,
    currency,
    currencySymbol,
    vendors: storeQuery.data?.vendors ?? [],
    productTypes: storeQuery.data?.productTypes ?? [],
    tags: storeQuery.data?.tags ?? [],
    productCount: storeQuery.data?.productCount ?? null,

    // Query state
    isLoading: integrationsQuery.isLoading || storeQuery.isLoading,
    isPending: integrationsQuery.isPending || storeQuery.isPending,
    isError: integrationsQuery.isError || storeQuery.isError,
    error: integrationsQuery.error || storeQuery.error,

    // Actions
    invalidate,
    refetch,
  };
}
