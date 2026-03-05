"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { apiClient } from "@/lib/api";

// ============================================
// Types
// ============================================

export interface BootstrapRoles {
  hasRole: boolean;
  hasSupplierRole: boolean;
  hasRetailerRole: boolean;
  roles: string[];
}

export interface BootstrapOrganization {
  id: string;
  name: string;
}

export interface BootstrapData {
  roles: BootstrapRoles;
  organization: BootstrapOrganization;
}

// Query key for bootstrap data
export const BOOTSTRAP_QUERY_KEY = ["bootstrap"] as const;

// ============================================
// Hook

export function useBootstrap() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...BOOTSTRAP_QUERY_KEY, userId],
    queryFn: async (): Promise<BootstrapData> => {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }
      return apiClient<BootstrapData>("/internal/bootstrap", { token });
    },
    // Only run when auth is loaded and user is signed in
    enabled: isAuthLoaded && isSignedIn === true && !!userId,
    // Bootstrap data is critical - keep it fresh
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    // Retry on failure
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Helper to invalidate bootstrap data
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: BOOTSTRAP_QUERY_KEY });
  };

  // Helper to refetch bootstrap data
  const refetch = () => {
    return query.refetch();
  };

  return {
    // Data
    data: query.data,
    roles: query.data?.roles,
    organization: query.data?.organization,

    // Query state
    isLoading: query.isLoading,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,

    // Auth state (needed for guards)
    isAuthLoaded,
    isSignedIn,

    // Actions
    invalidate,
    refetch,
  };
}

// ============================================
// Helper to prefetch bootstrap on the server side (if needed)

export function useBootstrapPrefetch() {
  const queryClient = useQueryClient();
  const { getToken, userId } = useAuth();

  return async () => {
    const token = await getToken();
    if (!token || !userId) return;

    await queryClient.prefetchQuery({
      queryKey: [...BOOTSTRAP_QUERY_KEY, userId],
      queryFn: async () => {
        return apiClient<BootstrapData>("/internal/bootstrap", { token });
      },
    });
  };
}
