"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

interface CustomFieldResponse {
  fieldId: string;
  value: string;
  fileUrl?: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
}

interface SubscribeToFeedData {
  feedId: string;
  requestMessage?: string;
  customFieldResponses?: CustomFieldResponse[];
}

interface SubscriptionResponse {
  id: string;
  feedId: string;
  organizationId: string;
  status: string;
  requestMessage: string | null;
  requestedAt: string;
}

export function useSubscribeToFeed() {
  const { getToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const subscribe = useCallback(
    async (data: SubscribeToFeedData): Promise<SubscriptionResponse | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        // Use the endpoint with custom fields if there are any
        const endpoint =
          data.customFieldResponses && data.customFieldResponses.length > 0
            ? "/internal/subscriptions/with-fields"
            : "/internal/subscriptions";

        const result = await apiClient<SubscriptionResponse>(endpoint, {
          method: "POST",
          token,
          body: JSON.stringify(data),
        });

        return result;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to submit subscription request", 500);
        setError(apiError);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [getToken]
  );

  const reset = useCallback(() => {
    setError(null);
    setIsSubmitting(false);
  }, []);

  return {
    subscribe,
    isSubmitting,
    error,
    reset,
  };
}
