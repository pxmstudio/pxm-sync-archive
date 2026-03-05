"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface ProductVariant {
  id: string;
  sku: string;
  name: string | null;
  price: number;
  originalPrice: number | null; // Original price before tier discount
  compareAtPrice: number | null;
  currency: string | null;
  quantity: number;
  reserved: number;
  attributes: Record<string, string> | null;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  productType: string | null;
  tags: string[] | null;
  images: string[] | null;
  variants: ProductVariant[];
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductFilters {
  search?: string;
  brand?: string;
  productType?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export function useProducts(supplierId: string, connectionId: string) {
  const { getToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchProducts = useCallback(
    async (filters: ProductFilters = {}) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const params = new URLSearchParams();
        if (filters.search) params.set("search", filters.search);
        if (filters.brand) params.set("brand", filters.brand);
        if (filters.productType) params.set("productType", filters.productType);
        if (filters.tags?.length) params.set("tags", filters.tags.join(","));
        params.set("page", String(filters.page || 1));
        params.set("limit", String(filters.limit || 20));

        const response = await apiClient<ProductsResponse>(
          `/internal/connections/${connectionId}/products?${params.toString()}`,
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
    [getToken, connectionId]
  );

  return {
    products,
    pagination,
    isLoading,
    error,
    fetchProducts,
  };
}
