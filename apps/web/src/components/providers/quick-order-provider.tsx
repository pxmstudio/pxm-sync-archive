"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

export interface QuickOrderItem {
  // Product info
  productId: string;
  productName: string;
  productImage: string | null;
  brand: string | null;
  productType: string | null;
  // Variant info
  variantId: string;
  variantName: string | null;
  sku: string;
  price: number;
  originalPrice: number | null;
  currency: string;
  // Selection
  quantity: number;
  available: number;
  // Supplier info
  supplierId: string;
  supplierName: string;
  connectionId: string;
  // Timestamp for sorting
  addedAt: number;
}

interface QuickOrderContextType {
  items: QuickOrderItem[];
  addItem: (item: Omit<QuickOrderItem, "addedAt">) => void;
  updateItem: (variantId: string, updates: Partial<QuickOrderItem>) => void;
  removeItem: (variantId: string) => void;
  clearAll: () => void;
  getItem: (variantId: string) => QuickOrderItem | undefined;
  hasItem: (variantId: string) => boolean;
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
}

const QuickOrderContext = createContext<QuickOrderContextType | null>(null);

const STORAGE_KEY = "quick-order-list";

export function QuickOrderProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuickOrderItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load quick order list:", error);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when items change
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.error("Failed to save quick order list:", error);
      }
    }
  }, [items, isHydrated]);

  const addItem = useCallback((item: Omit<QuickOrderItem, "addedAt">) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.variantId === item.variantId);

      if (existingIndex >= 0) {
        // Update existing item - add to quantity
        const newItems = [...prev];
        const existing = newItems[existingIndex]!;
        const newQuantity = Math.min(
          existing.quantity + item.quantity,
          item.available
        );
        newItems[existingIndex] = {
          ...existing,
          ...item,
          quantity: newQuantity,
          addedAt: existing.addedAt,
        };
        return newItems;
      }

      // Add new item
      return [...prev, { ...item, addedAt: Date.now() }];
    });
  }, []);

  const updateItem = useCallback(
    (variantId: string, updates: Partial<QuickOrderItem>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.variantId === variantId ? { ...item, ...updates } : item
        )
      );
    },
    []
  );

  const removeItem = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((item) => item.variantId !== variantId));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const getItem = useCallback(
    (variantId: string) => items.find((item) => item.variantId === variantId),
    [items]
  );

  const hasItem = useCallback(
    (variantId: string) => items.some((item) => item.variantId === variantId),
    [items]
  );

  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <QuickOrderContext.Provider
      value={{
        items,
        addItem,
        updateItem,
        removeItem,
        clearAll,
        getItem,
        hasItem,
        totalItems,
        totalQuantity,
        totalValue,
      }}
    >
      {children}
    </QuickOrderContext.Provider>
  );
}

export function useQuickOrder() {
  const context = useContext(QuickOrderContext);
  if (!context) {
    throw new Error("useQuickOrder must be used within a QuickOrderProvider");
  }
  return context;
}
