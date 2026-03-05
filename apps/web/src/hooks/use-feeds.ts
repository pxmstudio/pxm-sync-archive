"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface Feed {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  isSubscribed: boolean;
  subscriptionId: string | null;
  productCount: number;
  requestCount: number;
  subscriptionCount: number;
}

interface FeedsResponse {
  items: Feed[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type FeedFilter = "all" | "subscribed" | "pending";

interface UseFeedsOptions {
  page?: number;
  limit?: number;
  search?: string;
  filter?: FeedFilter;
}

export function useFeeds(options: UseFeedsOptions = {}) {
  const { getToken } = useAuth();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const { page = 1, limit = 12, search, filter } = options;

  const fetchFeeds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) {
        params.set("search", search);
      }

      // Use different endpoints based on filter
      let endpoint = "/internal/feeds";
      if (filter === "subscribed") {
        endpoint = "/internal/feeds/subscribed";
      } else if (filter === "pending") {
        endpoint = "/internal/feeds/requests";
      }

      const response = await apiClient<FeedsResponse>(
        `${endpoint}?${params.toString()}`,
        { token }
      );
      setFeeds(response.items);
      setPagination(response.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch feeds", 500)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getToken, page, limit, search, filter]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  return {
    feeds,
    pagination,
    isLoading,
    error,
    refresh: fetchFeeds,
  };
}
