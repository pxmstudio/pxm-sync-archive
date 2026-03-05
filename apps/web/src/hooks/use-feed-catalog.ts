"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

// Types for catalog products
export interface CatalogVariant {
  id: string;
  sku: string;
  name: string | null;
  attributes: Record<string, string> | null;
  // Pricing (available for feed sources, may be null for regular feeds)
  price: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  // Inventory (available for feed sources)
  quantity: number | null;
  available: number | null;
}

export interface ProductSyncStatus {
  synced: boolean;
  status: string;
  shopifyAdminUrl: string | null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  productType: string | null;
  tags: string[] | null;
  images: string[] | null;
  variants: CatalogVariant[];
  // Sync status (if synced to Shopify)
  syncStatus: ProductSyncStatus | null;
}

export interface BrandFacet {
  name: string;
  productCount: number;
}

export interface ProductTypeFacet {
  name: string;
  productCount: number;
}

export interface CollectionFacet {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
}

export interface CatalogFacets {
  brands: BrandFacet[];
  productTypes: ProductTypeFacet[];
  collections: CollectionFacet[];
}

export interface CatalogFilters {
  brands?: string[];
  productTypes?: string[];
  collectionIds?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}

export interface CatalogProductsResponse {
  products: CatalogProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Hook for fetching feed catalog products
// Works for both feeds (feed_) and feed sources (fsrc_)
export function useFeedCatalogProducts(feedId: string) {
  const { getToken } = useAuth();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchProducts = useCallback(
    async (filters: CatalogFilters = {}) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const params = new URLSearchParams();
        if (filters.brands?.length) {
          params.set("brands", filters.brands.join(","));
        }
        if (filters.productTypes?.length) {
          params.set("productTypes", filters.productTypes.join(","));
        }
        if (filters.collectionIds?.length) {
          params.set("collectionIds", filters.collectionIds.join(","));
        }
        if (filters.search) {
          params.set("search", filters.search);
        }
        if (filters.sortBy) {
          params.set("sortBy", filters.sortBy);
        }
        if (filters.sortOrder) {
          params.set("sortOrder", filters.sortOrder);
        }
        params.set("page", String(filters.page || 1));
        params.set("limit", String(filters.limit || 20));

        // Both feeds and feed sources use the same products endpoint
        const endpoint = `/internal/feeds/${feedId}/products`;

        const response = await apiClient<CatalogProductsResponse>(
          `${endpoint}?${params.toString()}`,
          { token }
        );

        // Normalize response - feed sources API returns { items } instead of { products }
        const normalizedProducts = (response as { items?: CatalogProduct[] }).items || response.products;
        setProducts(normalizedProducts);
        setPagination(response.pagination);
        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch catalog", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken, feedId]
  );

  return {
    products,
    pagination,
    isLoading,
    error,
    fetchProducts,
  };
}

// Hook for fetching catalog facets
// Works for both feeds (feed_) and feed sources (fsrc_)
export function useFeedCatalogFacets(feedId: string) {
  const { getToken } = useAuth();
  const [facets, setFacets] = useState<CatalogFacets>({
    brands: [],
    productTypes: [],
    collections: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchFacets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      // Both feeds and feed sources use the same products/facets endpoint
      const endpoint = `/internal/feeds/${feedId}/products/facets`;

      const response = await apiClient<CatalogFacets>(
        endpoint,
        { token }
      );

      setFacets(response);
      return response;
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch facets", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken, feedId]);

  return {
    facets,
    isLoading,
    error,
    fetchFacets,
  };
}
