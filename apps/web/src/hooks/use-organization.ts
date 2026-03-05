"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  website: string | null;
  description: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  defaultCurrency: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationData {
  name?: string;
  logoUrl?: string | null;
  website?: string | null;
  description?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  defaultCurrency?: string | null;
  settings?: Record<string, unknown>;
}

export function useOrganization() {
  const { getToken } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchOrganization = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) return;

      const data = await apiClient<Organization>(
        "/internal/organizations/me",
        { token }
      );
      setOrganization(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err
          : new ApiError("UNKNOWN", "Failed to fetch organization", 500)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  const updateOrganization = useCallback(
    async (data: UpdateOrganizationData): Promise<boolean> => {
      try {
        setIsSaving(true);
        setError(null);
        const token = await getToken();
        if (!token) return false;

        const result = await apiClient<Organization>(
          "/internal/organizations/me",
          {
            method: "PATCH",
            token,
            body: JSON.stringify(data),
          }
        );
        setOrganization(result);
        return true;
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to update organization", 500)
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [getToken]
  );

  return {
    organization,
    isLoading,
    isSaving,
    error,
    refresh: fetchOrganization,
    updateOrganization,
  };
}
