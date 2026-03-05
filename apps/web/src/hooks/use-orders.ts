"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { apiClient, ApiError } from "@/lib/api";

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface OrderItem {
  variantId: string;
  quantity: number;
  unitPrice?: number;
}

export interface CreateOrderData {
  connectionId: string;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress?: Address;
  retailerNote?: string;
  retailerOrderRef?: string;
  paymentMethod?: "card" | "bank_transfer";
}

export interface Order {
  id: string;
  orderNumber: string;
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  subtotal: string;
  shippingCost: string;
  taxAmount: string;
  commission: string;
  total: string;
  currency: string;
  shippingAddress: Address;
  billingAddress: Address;
  retailerNote: string | null;
  supplierNote: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  placedAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  items: {
    id: string;
    sku: string;
    name: string;
    variantName: string | null;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
  }[];
  supplier: {
    id: string;
    name: string;
    slug: string;
  };
}

export function useCreateOrder() {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const createOrder = useCallback(
    async (data: CreateOrderData): Promise<Order> => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const order = await apiClient<Order>("/internal/orders", {
          method: "POST",
          token,
          body: JSON.stringify(data),
        });

        return order;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to create order", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    createOrder,
    isLoading,
    error,
  };
}

export function useOrders() {
  const { getToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchOrders = useCallback(
    async (filters: { status?: string; supplierId?: string } = {}) => {
      setIsLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated", 401);

        const params = new URLSearchParams();
        if (filters.status) params.set("status", filters.status);
        if (filters.supplierId) params.set("supplierId", filters.supplierId);

        const response = await apiClient<{ items: Order[]; pagination: unknown }>(
          `/internal/orders?${params.toString()}`,
          { token }
        );

        setOrders(response.items);
        return response.items;
      } catch (err) {
        const apiError =
          err instanceof ApiError
            ? err
            : new ApiError("UNKNOWN", "Failed to fetch orders", 500);
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [getToken]
  );

  return {
    orders,
    isLoading,
    error,
    fetchOrders,
  };
}
