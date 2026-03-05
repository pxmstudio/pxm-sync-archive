"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface FeedSource {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  logoUrl: string | null;
  description: string | null;
  orderingUrl: string | null;
  orderingInstructions: string | null;
  orderingEmail: string | null;
  orderingPhone: string | null;
  status: "pending" | "mapping" | "active" | "paused" | "deprecated";
  metadata: Record<string, unknown> | null;
  createdAt: string;
  // Subscription info
  isSubscribed: boolean;
  subscriptionId: string | null;
  // Counts
  productCount: number;
  requestCount: number;
  subscriptionCount: number;
}

interface FeedSourcesResponse {
  items: FeedSource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface UseFeedSourcesOptions {
  page?: number;
  limit?: number;
  search?: string;
  subscribedOnly?: boolean;
}

export function useFeedSources(options: UseFeedSourcesOptions = {}) {
  const { getToken } = useAuth();
  const [feedSources, setFeedSources] = useState<FeedSource[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const { page = 1, limit = 12, search, subscribedOnly = false } = options;

  const fetchFeedSources = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const endpoint = subscribedOnly
        ? "/internal/feeds/sources/subscribed"
        : "/internal/feeds/sources";

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) {
        params.set("search", search);
      }

      const response = await apiClient<FeedSourcesResponse>(
        `${endpoint}?${params.toString()}`,
        { token }
      );
      setFeedSources(response.items);
      setPagination(response.pagination);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch feed sources", 500)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getToken, page, limit, search, subscribedOnly]);

  useEffect(() => {
    fetchFeedSources();
  }, [fetchFeedSources]);

  return {
    feedSources,
    pagination,
    isLoading,
    error,
    refresh: fetchFeedSources,
  };
}

// Hook for a single feed source
export function useFeedSource(id: string) {
  const { getToken } = useAuth();
  const [feedSource, setFeedSource] = useState<FeedSource | null>(null);
  const [subscription, setSubscription] = useState<{
    id: string;
    isActive: boolean;
    verifiedAt: string;
  } | null>(null);
  const [hasRequested, setHasRequested] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchFeedSource = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const response = await apiClient<{
        feedSource: FeedSource & { productCount: number };
        subscription: {
          id: string;
          isActive: boolean;
          verifiedAt: string;
        } | null;
        hasRequested: boolean;
        requestId: string | null;
      }>(`/internal/feeds/sources/${id}`, { token });

      setFeedSource(response.feedSource);
      setSubscription(response.subscription);
      setHasRequested(response.hasRequested);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch feed source details", 500)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getToken, id]);

  useEffect(() => {
    if (id) {
      fetchFeedSource();
    }
  }, [fetchFeedSource, id]);

  return {
    feedSource,
    subscription,
    hasRequested,
    isLoading,
    error,
    refresh: fetchFeedSource,
  };
}

// Hook for verifying and subscribing to a feed source
export function useFeedSourceSubscribe() {
  const { getToken } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const verifyPublicFeed = useCallback(
    async (feedSourceId: string, feedUrl: string) => {
      try {
        setIsVerifying(true);
        setVerifyError(null);
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");

        const response = await apiClient<{
          subscriptionId: string;
          verified: boolean;
          message: string;
        }>(`/internal/feeds/sources/${feedSourceId}/verify-public`, {
          method: "POST",
          token,
          body: JSON.stringify({ feedUrl }),
        });

        return response;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to verify feed access";
        setVerifyError(message);
        throw err;
      } finally {
        setIsVerifying(false);
      }
    },
    [getToken]
  );

  const verifyAuthenticatedFeed = useCallback(
    async (
      feedSourceId: string,
      feedUrl: string,
      credentials: {
        type: "basic" | "api_key" | "bearer" | "query_param";
        username?: string;
        password?: string;
        headerName?: string;
        headerValue?: string;
        paramName?: string;
        paramValue?: string;
      }
    ) => {
      try {
        setIsVerifying(true);
        setVerifyError(null);
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");

        const response = await apiClient<{
          subscriptionId: string;
          verified: boolean;
          message: string;
        }>(`/internal/feeds/sources/${feedSourceId}/verify-authenticated`, {
          method: "POST",
          token,
          body: JSON.stringify({ feedUrl, credentials }),
        });

        return response;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to verify feed access";
        setVerifyError(message);
        throw err;
      } finally {
        setIsVerifying(false);
      }
    },
    [getToken]
  );

  const unsubscribe = useCallback(
    async (feedSourceId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      await apiClient(`/internal/feeds/sources/${feedSourceId}/subscription`, {
        method: "DELETE",
        token,
      });
    },
    [getToken]
  );

  return {
    verifyPublicFeed,
    verifyAuthenticatedFeed,
    unsubscribe,
    isVerifying,
    verifyError,
    clearError: () => setVerifyError(null),
  };
}

// Hook for requesting a new feed source
export function useFeedSourceRequest() {
  const { getToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestNewFeedSource = useCallback(
    async (data: {
      feedName: string;
      feedWebsite?: string;
      feedUrl?: string;
      notes?: string;
      credentialsProvided?: boolean;
    }) => {
      try {
        setIsSubmitting(true);
        setError(null);
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");

        // Map to API expected field names
        const payload = {
          supplierName: data.feedName,
          supplierWebsite: data.feedWebsite,
          feedUrl: data.feedUrl,
          notes: data.notes,
          credentialsProvided: data.credentialsProvided,
        };

        const response = await apiClient<{ request: { id: string } }>(
          "/internal/feeds/requests/new",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          }
        );

        return response.request;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to submit request";
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getToken]
  );

  const requestExistingFeedSource = useCallback(
    async (
      feedId: string,
      data: {
        notes?: string;
        feedUrl?: string;
        credentialsProvided?: boolean;
      }
    ) => {
      try {
        setIsSubmitting(true);
        setError(null);
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");

        const response = await apiClient<{ request: { id: string } }>(
          `/internal/feeds/${feedId}/request`,
          {
            method: "POST",
            token,
            body: JSON.stringify(data),
          }
        );

        return response.request;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to submit request";
        setError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getToken]
  );

  return {
    requestNewFeedSource,
    requestExistingFeedSource,
    isSubmitting,
    error,
    clearError: () => setError(null),
  };
}
