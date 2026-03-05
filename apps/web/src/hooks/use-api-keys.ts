"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";
import type { ApiScope } from "@workspace/validators/api-keys";

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreated extends ApiKey {
  key: string; // Full key, only returned on creation
}

export interface CreateApiKeyData {
  name: string;
  scopes: ApiScope[];
  expiresAt?: Date;
}

export interface UpdateApiKeyData {
  name?: string;
  scopes?: ApiScope[];
}

export function useApiKeys() {
  const { getToken } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

      const response = await apiClient<ApiKey[]>("/internal/api-keys", {
        token,
      });

      setKeys(response);
      return response;
    } catch (err) {
      const apiError =
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch API keys", 500);
      setError(apiError);
      throw apiError;
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  return {
    keys,
    isLoading,
    error,
    fetchKeys,
  };
}

export function useCreateApiKey() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const createKey = useCallback(
    async (data: CreateApiKeyData): Promise<ApiKeyCreated> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<ApiKeyCreated>("/internal/api-keys", {
          method: "POST",
          token,
          body: JSON.stringify(data),
        });

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to create API key", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    createKey,
    isLoading,
    error,
  };
}

export function useUpdateApiKey() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const updateKey = useCallback(
    async (id: string, data: UpdateApiKeyData): Promise<ApiKey> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<ApiKey>(`/internal/api-keys/${id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(data),
        });

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to update API key", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    updateKey,
    isLoading,
    error,
  };
}

export function useRevokeApiKey() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const revokeKey = useCallback(
    async (id: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787"}/internal/api-keys/${id}`,
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
            : new ApiError("UNKNOWN", "Failed to revoke API key", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    revokeKey,
    isLoading,
    error,
  };
}
