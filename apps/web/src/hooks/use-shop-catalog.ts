"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";
import type {
  CatalogProduct,
  CatalogVariant,
  ProductSyncStatus,
  BrandFacet,
  ProductTypeFacet,
} from "./use-feed-catalog";

// Re-export shared types
export type {
  CatalogProduct,
  CatalogVariant,
  ProductSyncStatus,
  BrandFacet,
  ProductTypeFacet,
};

// Shop-specific types
export interface FeedFacet {
  id: string;
  name: string;
  logoUrl: string | null;
  productCount: number;
}

export interface ShopFacets {
  feeds: FeedFacet[];
  brands: BrandFacet[];
  productTypes: ProductTypeFacet[];
}

export interface ShopFilters {
  page?: number;
  limit?: number;
  search?: string;
  brands?: string[];
  productTypes?: string[];
  feedIds?: string[];
  sortBy?: "name" | "price" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface ShopProduct extends CatalogProduct {
  feed: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
}

interface ShopProductsResponse {
  items: ShopProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Hook for fetching shop products across all subscribed feeds
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
        if (filters.brands?.length) {
          params.set("brands", filters.brands.join(","));
        }
        if (filters.productTypes?.length) {
          params.set("productTypes", filters.productTypes.join(","));
        }
        if (filters.feedIds?.length) {
          params.set("feedIds", filters.feedIds.join(","));
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

        const response = await apiClient<ShopProductsResponse>(
          `/internal/shop/products?${params.toString()}`,
          { token }
        );

        setProducts(response.items);
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

// Hook for fetching shop facets
export function useShopFacets() {
  const { getToken } = useAuth();
  const [facets, setFacets] = useState<ShopFacets>({
    feeds: [],
    brands: [],
    productTypes: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchFacets = useCallback(async (feedIds?: string[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const params = new URLSearchParams();
      if (feedIds?.length) {
        params.set("feedIds", feedIds.join(","));
      }

      const url = params.toString()
        ? `/internal/shop/facets?${params.toString()}`
        : "/internal/shop/facets";

      const response = await apiClient<ShopFacets>(url, { token });

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
  }, [getToken]);

  return {
    facets,
    isLoading,
    error,
    fetchFacets,
  };
}

// Compare mode types
export interface CompareVariant {
  id: string;
  sku: string | null;
  name: string | null;
  barcode: string | null;
  attributes: Record<string, string> | null;
  price: number | null;
  compareAtPrice: number | null;
  currency: string | null;
  quantity: number;
}

export interface ShopifyVariant {
  externalId: string;
  sku: string | null;
  title: string;
  barcode: string | null;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number;
  attributes: Record<string, string>;
}

// Sync rules types (matching backend schema)
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

export interface PricingMarginRule {
  id: string;
  name: string;
  priority: number;
  conditions: {
    field: string;
    operator: string;
    value: string | number | [number, number];
  }[];
  marginType: "percentage" | "fixed";
  marginValue: number;
}

export interface PricingMargin {
  defaultMargin: {
    type: "percentage" | "fixed";
    value: number;
  } | null;
  rules: PricingMarginRule[];
  rounding?: {
    enabled: boolean;
    strategy: "none" | "up" | "down" | "nearest";
    precision: number;
    endWith?: number;
  };
  bounds?: {
    minPrice?: number;
    maxMarkup?: number;
  };
}

export interface FieldMappingRule {
  id: string;
  sourceField: "brand" | "productType" | "tag";
  sourceValue: string;
  targetField: "brand" | "productType" | "tag";
  targetValue: string;
}

export interface FieldLockConfig {
  enabled: boolean;
  namespace: string;
  mappings: Record<string, string>;
  lockInterpretation?: "lockWhenFalse" | "lockWhenTrue";
}

export interface RulesApplied {
  filterRules: FilterRules;
  pricingMargin: PricingMargin | null;
  pricingMarginSource: "feed" | "global" | null;
  fieldMappings: FieldMappingRule[];
  fieldLocks: FieldLockConfig | null;
  skuPrefix: string | null;
}

export interface CompareProduct {
  id: string;
  feedId: string | null;
  feedName: string | null;
  feedLogo: string | null;

  feed: {
    name: string | null;
    description: string | null;
    brand: string | null;
    productType: string | null;
    tags: string[] | null;
    images: string[];
    variants: CompareVariant[];
  };

  shopify: {
    externalId: string;
    adminUrl: string | null;
    title: string;
    description: string | null;
    vendor: string | null;
    productType: string | null;
    tags: string[];
    status: string;
    images: string[];
    variants: ShopifyVariant[];
  } | null;

  sync: {
    status: "pending" | "success" | "synced" | "failed" | "partial" | "never";
    lastError: string | null;
    shopifyAdminUrl: string | null;
  };

  differences: {
    hasNameDiff: boolean;
    hasDescriptionDiff: boolean;
    hasVendorDiff: boolean;
    hasTypeDiff: boolean;
    hasPriceDiff: boolean;
    hasInventoryDiff: boolean;
    totalDiffCount: number;
  };

  rulesApplied: RulesApplied | null;
}

export interface CompareSummary {
  total: number;
  synced: number;
  withDifferences: number;
  failed: number;
  pending: number;
  neverSynced: number;
}

export interface CompareFilters extends ShopFilters {
  showOnlyDifferences?: boolean;
}

interface CompareProductsResponse {
  items: CompareProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: CompareSummary;
}

// Hook for fetching compare products
export function useShopCompare() {
  const { getToken } = useAuth();
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [summary, setSummary] = useState<CompareSummary>({
    total: 0,
    synced: 0,
    withDifferences: 0,
    failed: 0,
    pending: 0,
    neverSynced: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchCompareProducts = useCallback(
    async (filters: CompareFilters = {}) => {
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
        if (filters.feedIds?.length) {
          params.set("feedIds", filters.feedIds.join(","));
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
        if (filters.showOnlyDifferences) {
          params.set("showOnlyDifferences", "true");
        }
        params.set("page", String(filters.page || 1));
        params.set("limit", String(filters.limit || 20));

        const response = await apiClient<CompareProductsResponse>(
          `/internal/shop/products/compare?${params.toString()}`,
          { token }
        );

        setProducts(response.items);
        setPagination(response.pagination);
        setSummary(response.summary);
        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch compare products", 500);
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
    summary,
    isLoading,
    error,
    fetchCompareProducts,
  };
}
