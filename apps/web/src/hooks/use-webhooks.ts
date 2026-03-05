"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export type EventType =
  | "product.created"
  | "product.updated"
  | "product.deleted";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  "product.created": "Product Created",
  "product.updated": "Product Updated",
  "product.deleted": "Product Deleted",
};

export const EVENT_TYPE_CATEGORIES = {
  Products: ["product.created", "product.updated", "product.deleted"] as EventType[],
};

export interface WebhookSubscription {
  id: string;
  url: string;
  eventTypes: EventType[];
  isActive: boolean;
  failureCount: string;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookSubscriptionCreated extends Omit<WebhookSubscription, "failureCount" | "lastFailureAt" | "lastFailureReason" | "updatedAt"> {
  secret: string;
}

export interface WebhookDelivery {
  id: string;
  eventType: string;
  success: boolean;
  statusCode: string | null;
  responseTimeMs: string | null;
  errorMessage: string | null;
  attempt: string;
  createdAt: string;
}

export interface CreateWebhookData {
  url: string;
  eventTypes: EventType[];
}

export interface UpdateWebhookData {
  url?: string;
  eventTypes?: EventType[];
  isActive?: boolean;
}

export function useWebhooks() {
  const { getToken } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchWebhooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const response = await apiClient<WebhookSubscription[]>("/internal/webhooks", {
        token,
      });

      setWebhooks(response);
      return response;
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch webhooks", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  return {
    webhooks,
    isLoading,
    error,
    fetchWebhooks,
  };
}

export function useCreateWebhook() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const createWebhook = useCallback(
    async (data: CreateWebhookData): Promise<WebhookSubscriptionCreated> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<WebhookSubscriptionCreated>("/internal/webhooks", {
          method: "POST",
          token,
          body: JSON.stringify(data),
        });

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to create webhook", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    createWebhook,
    isLoading,
    error,
  };
}

export function useUpdateWebhook() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const updateWebhook = useCallback(
    async (id: string, data: UpdateWebhookData): Promise<WebhookSubscription> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<WebhookSubscription>(`/internal/webhooks/${id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(data),
        });

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to update webhook", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    updateWebhook,
    isLoading,
    error,
  };
}

export function useDeleteWebhook() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const deleteWebhook = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787"}/internal/webhooks/${id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "X-Active-Role": "retailer",
            },
          }
        );
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to delete webhook", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    deleteWebhook,
    isLoading,
    error,
  };
}

export function useWebhookDeliveries() {
  const { getToken } = useAuth();
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchDeliveries = useCallback(
    async (webhookId: string, page = 1, limit = 20) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<{ items: WebhookDelivery[]; pagination: unknown }>(
          `/internal/webhooks/${webhookId}/deliveries?page=${page}&limit=${limit}`,
          { token }
        );

        setDeliveries(response.items);
        return response.items;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch deliveries", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    deliveries,
    isLoading,
    error,
    fetchDeliveries,
  };
}

export function useTestWebhook() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const testWebhook = useCallback(
    async (id: string): Promise<{ delivered: boolean; statusCode: number | null; responseTimeMs: number }> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<{ delivered: boolean; statusCode: number | null; responseTimeMs: number }>(
          `/internal/webhooks/${id}/test`,
          {
            method: "POST",
            token,
          }
        );

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to test webhook", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    testWebhook,
    isLoading,
    error,
  };
}
