"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface ApplicationField {
  id: string;
  name: string;
  label: string;
  description: string | null;
  type: "text" | "textarea" | "number" | "email" | "phone" | "url" | "file" | "select" | "checkbox";
  isRequired: boolean;
  options: string[];
  allowedFileTypes: string[];
  maxFileSizeMb: number;
  sortOrder: number;
}

export interface FeedDetail {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  publicDescription: string | null;
  isPublic: boolean;
}

interface FeedDetailResponse {
  feed: FeedDetail & { productCount?: number };
  subscription: {
    id: string;
    isActive: boolean;
    verifiedAt: string | null;
  } | null;
  hasRequested: boolean;
  requestId: string | null;
}

export function useFeedDetail(feedId: string | null) {
  const { getToken } = useAuth();
  const [feed, setFeed] = useState<FeedDetail | null>(null);
  const [applicationFields, setApplicationFields] = useState<ApplicationField[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchFeed = useCallback(async () => {
    if (!feedId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const data = await apiClient<FeedDetailResponse>(
        `/internal/feeds/${feedId}`,
        { token }
      );
      setFeed(data.feed);
      setApplicationFields([]);
      // Derive subscription status from the subscription object
      if (data.subscription) {
        setSubscriptionStatus(data.subscription.isActive ? "active" : "suspended");
        setSubscriptionId(data.subscription.id);
      } else {
        setSubscriptionStatus(null);
        setSubscriptionId(null);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch feed", 500)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getToken, feedId]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return {
    feed,
    applicationFields,
    subscriptionStatus,
    subscriptionId,
    isLoading,
    error,
    refresh: fetchFeed,
  };
}
