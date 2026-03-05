"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface SyncChangeBreakdown {
  new: number;
  full: number;
  price: number;
  inventory: number;
  unchanged: number;
  total: number;
  inventoryFastPath?: number;
}

export interface SyncRun {
  id: string;
  feed: { id: string; name: string };
  integration: { id: string; name: string; shopDomain: string | null };
  syncType: string;
  status: "pending" | "running" | "completed" | "failed" | "partial";
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  productsFailed: number;
  errorMessage: string | null;
  triggeredBy: string;
  changeBreakdown: SyncChangeBreakdown | null;
}

export interface SyncRunDetail extends SyncRun {
  productsProcessed: number;
  errors: SyncError[];
  triggeredByUserId: string | null;
  triggerRunId: string | null;
}

export interface SyncError {
  productId?: string;
  sku?: string;
  productName?: string;
  action?: "create" | "update" | "delete";
  message: string;
  code?: string;
}

export interface FilterOption {
  id: string;
  name: string;
}

export interface ActivityFilters {
  integrations: FilterOption[];
  feeds: FilterOption[];
  statuses: FilterOption[];
}

interface ActivityResponse {
  items: SyncRun[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface UseActivityOptions {
  page?: number;
  limit?: number;
  feedId?: string;
  integrationId?: string;
  status?: string;
}

export function useActivity(options: UseActivityOptions = {}) {
  const { getToken } = useAuth();
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const { page = 1, limit = 20, feedId, integrationId, status } = options;

  const fetchActivity = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (feedId) {
        params.set("feedId", feedId);
      }
      if (integrationId) {
        params.set("integrationId", integrationId);
      }
      if (status) {
        params.set("status", status);
      }

      const response = await apiClient<ActivityResponse>(
        `/internal/activity?${params.toString()}`,
        { token }
      );
      setRuns(response.items);
      setPagination(response.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch activity", 500)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getToken, page, limit, feedId, integrationId, status]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    runs,
    pagination,
    isLoading,
    error,
    refresh: fetchActivity,
  };
}

export function useActivityFilters() {
  const { getToken } = useAuth();
  const [filters, setFilters] = useState<ActivityFilters>({
    integrations: [],
    feeds: [],
    statuses: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchFilters = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const response = await apiClient<ActivityFilters>(
        "/internal/activity/filters/options",
        { token }
      );
      setFilters(response);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch filters", 500)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  return {
    filters,
    isLoading,
    error,
    refresh: fetchFilters,
  };
}

export function useActivityDetail(runId: string | null) {
  const { getToken } = useAuth();
  const [run, setRun] = useState<SyncRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!runId) {
      setRun(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const response = await apiClient<SyncRunDetail>(
        `/internal/activity/${runId}`,
        { token }
      );
      setRun(response);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch sync run details", 500)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getToken, runId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    run,
    isLoading,
    error,
    refresh: fetchDetail,
  };
}
