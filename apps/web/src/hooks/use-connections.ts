"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface Connection {
  id: string;
  supplierId: string;
  retailerId: string;
  status: "pending" | "active" | "suspended" | "terminated";
  commissionRate: string | null;
  supplier: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    website: string | null;
  };
  createdAt: string;
}

export function useConnections() {
  const { getToken } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchConnections = useCallback(
    async (status?: "active" | "pending" | "suspended" | "terminated") => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<{ items: Connection[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
          "/internal/connections",
          { token }
        );

        const filtered = status
          ? response.items.filter((c) => c.status === status)
          : response.items;

        setConnections(filtered);
        return filtered;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch connections", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    connections,
    isLoading,
    error,
    fetchConnections,
  };
}
