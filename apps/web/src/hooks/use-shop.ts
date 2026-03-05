"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

// Types
export interface ProductVariant {
  id: string;
  sku: string;
  name: string | null;
  price: number;
  originalPrice: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  quantity: number;
  reserved: number;
  available: number;
  attributes: Record<string, string> | null;
}

export interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  productType: string | null;
  tags: string[] | null;
  images: string[] | null;
  supplier: {
    id: string;
    name: string;
    isCustom: boolean;
  };
  connectionId: string | null;
  variants: ProductVariant[];
}

export interface Supplier {
  id: string;
  name: string;
  logoUrl: string | null;
  connectionId: string;
  isCustom: boolean;
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
  supplierId: string;
}

export interface ShopFacets {
  suppliers: Supplier[];
  brands: BrandFacet[];
  productTypes: ProductTypeFacet[];
  collections: CollectionFacet[];
}

export interface ShopFilters {
  supplierIds?: string[];
  brands?: string[];
  productTypes?: string[];
  collectionIds?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface ShopProductsResponse {
  products: ShopProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Hook for fetching shop products
export function useShopProducts() {
  const { getToken } = useAuth();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchProducts = useCallback(
    async (filters: ShopFilters = {}) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const params = new URLSearchParams();
        if (filters.supplierIds?.length) {
          params.set("supplierIds", filters.supplierIds.join(","));
        }
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
        params.set("page", String(filters.page || 1));
        params.set("limit", String(filters.limit || 20));

        const response = await apiClient<ShopProductsResponse>(
          `/internal/shop/products?${params.toString()}`,
          { token }
        );

        setProducts(response.products);
        setPagination(response.pagination);
        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch products", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    products,
    pagination,
    isLoading,
    error,
    fetchProducts,
  };
}

// Hook for fetching facets
export function useShopFacets() {
  const { getToken } = useAuth();
  const [facets, setFacets] = useState<ShopFacets>({
    suppliers: [],
    brands: [],
    productTypes: [],
    collections: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchFacets = useCallback(
    async (supplierIds?: string[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const params = new URLSearchParams();
        if (supplierIds?.length) {
          params.set("supplierIds", supplierIds.join(","));
        }

        const response = await apiClient<ShopFacets>(
          `/internal/shop/facets?${params.toString()}`,
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
    },
    [getToken]
  );

  return {
    facets,
    isLoading,
    error,
    fetchFacets,
  };
}
