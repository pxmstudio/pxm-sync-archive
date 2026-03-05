"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export type AddressType =
  | "billing"
  | "shipping"
  | "warehouse"
  | "store"
  | "headquarters"
  | "fulfillment_center"
  | "return";

export interface Address {
  id: string;
  organizationId: string;
  label: string;
  type: AddressType;
  isDefault: boolean;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressInput {
  label: string;
  type: AddressType;
  isDefault?: boolean;
  firstName?: string;
  lastName?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export type UpdateAddressInput = Partial<CreateAddressInput>;

export function useAddresses() {
  const { getToken } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchAddresses = useCallback(
    async (type?: AddressType) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const url = type
          ? `/internal/addresses?type=${type}`
          : "/internal/addresses";

        const response = await apiClient<Address[]>(url, { token });
        setAddresses(response);
        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch addresses", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  const createAddress = useCallback(
    async (data: CreateAddressInput) => {
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<Address>("/internal/addresses", {
          method: "POST",
          token,
          body: JSON.stringify(data),
        });

        // Add to local state
        setAddresses((prev) => {
          // If new address is default, update other addresses of same type
          if (response.isDefault) {
            return [
              response,
              ...prev.map((a) =>
                a.type === response.type ? { ...a, isDefault: false } : a
              ),
            ];
          }
          return [response, ...prev];
        });

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to create address", 500);
        setError(apiError);
        throw apiError;
      }
    },
    [getToken]
  );

  const updateAddress = useCallback(
    async (id: string, data: UpdateAddressInput) => {
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<Address>(`/internal/addresses/${id}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(data),
        });

        // Update local state
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === id) return response;
            // If updated address is now default, update others of same type
            if (response.isDefault && a.type === response.type) {
              return { ...a, isDefault: false };
            }
            return a;
          })
        );

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to update address", 500);
        setError(apiError);
        throw apiError;
      }
    },
    [getToken]
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        await apiClient<{ deleted: boolean }>(`/internal/addresses/${id}`, {
          method: "DELETE",
          token,
        });

        // Remove from local state
        setAddresses((prev) => prev.filter((a) => a.id !== id));
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to delete address", 500);
        setError(apiError);
        throw apiError;
      }
    },
    [getToken]
  );

  const setDefaultAddress = useCallback(
    async (id: string) => {
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const response = await apiClient<Address>(
          `/internal/addresses/${id}/set-default`,
          {
            method: "POST",
            token,
          }
        );

        // Update local state
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === id) return response;
            // Update others of same type to not be default
            if (a.type === response.type) {
              return { ...a, isDefault: false };
            }
            return a;
          })
        );

        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to set default address", 500);
        setError(apiError);
        throw apiError;
      }
    },
    [getToken]
  );

  // Helper to get default address by type
  const getDefaultAddress = useCallback(
    (type: AddressType) => {
      return addresses.find((a) => a.type === type && a.isDefault) || null;
    },
    [addresses]
  );

  // Helper to get addresses by type
  const getAddressesByType = useCallback(
    (type: AddressType) => {
      return addresses.filter((a) => a.type === type);
    },
    [addresses]
  );

  return {
    addresses,
    isLoading,
    error,
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    getDefaultAddress,
    getAddressesByType,
  };
}
