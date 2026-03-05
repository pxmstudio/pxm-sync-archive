"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  sku: string;
  price: number;
  currency: string;
  quantity: number;
  imageUrl: string | null;
  supplierId: string;
  supplierName: string;
  connectionId: string;
  maxQuantity?: number;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: { variantId: string } }
  | { type: "UPDATE_QUANTITY"; payload: { variantId: string; quantity: number } }
  | { type: "CLEAR_CART" }
  | { type: "CLEAR_SUPPLIER"; payload: { supplierId: string } }
  | { type: "SET_CART"; payload: CartItem[] }
  | { type: "TOGGLE_CART" }
  | { type: "OPEN_CART" }
  | { type: "CLOSE_CART" };

const CART_STORAGE_KEY = "pxm-retailer-cart";

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existingIndex = state.items.findIndex(
        (item) => item.variantId === action.payload.variantId
      );
      if (existingIndex >= 0) {
        const newItems = [...state.items];
        const existing = newItems[existingIndex]!;
        const newQuantity = existing.quantity + action.payload.quantity;
        newItems[existingIndex] = {
          ...existing,
          quantity: existing.maxQuantity
            ? Math.min(newQuantity, existing.maxQuantity)
            : newQuantity,
        };
        return { ...state, items: newItems };
      }
      return { ...state, items: [...state.items, action.payload] };
    }
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter(
          (item) => item.variantId !== action.payload.variantId
        ),
      };
    case "UPDATE_QUANTITY": {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          items: state.items.filter(
            (item) => item.variantId !== action.payload.variantId
          ),
        };
      }
      return {
        ...state,
        items: state.items.map((item) =>
          item.variantId === action.payload.variantId
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    }
    case "CLEAR_CART":
      return { ...state, items: [] };
    case "CLEAR_SUPPLIER":
      return {
        ...state,
        items: state.items.filter(
          (item) => item.supplierId !== action.payload.supplierId
        ),
      };
    case "SET_CART":
      return { ...state, items: action.payload };
    case "TOGGLE_CART":
      return { ...state, isOpen: !state.isOpen };
    case "OPEN_CART":
      return { ...state, isOpen: true };
    case "CLOSE_CART":
      return { ...state, isOpen: false };
    default:
      return state;
  }
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  itemCount: number;
  subtotal: number;
  supplierGroups: Map<string, { supplierName: string; connectionId: string; items: CartItem[] }>;
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  clearSupplier: (supplierId: string) => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getItemQuantity: (variantId: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isOpen: false,
  });

  // Load cart from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    if (saved) {
      try {
        const items = JSON.parse(saved) as CartItem[];
        dispatch({ type: "SET_CART", payload: items });
      } catch {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    }
  }, []);

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: "ADD_ITEM", payload: item });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: { variantId } });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    dispatch({ type: "UPDATE_QUANTITY", payload: { variantId, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR_CART" });
  }, []);

  const clearSupplier = useCallback((supplierId: string) => {
    dispatch({ type: "CLEAR_SUPPLIER", payload: { supplierId } });
  }, []);

  const toggleCart = useCallback(() => {
    dispatch({ type: "TOGGLE_CART" });
  }, []);

  const openCart = useCallback(() => {
    dispatch({ type: "OPEN_CART" });
  }, []);

  const closeCart = useCallback(() => {
    dispatch({ type: "CLOSE_CART" });
  }, []);

  const getItemQuantity = useCallback(
    (variantId: string) => {
      const item = state.items.find((i) => i.variantId === variantId);
      return item?.quantity ?? 0;
    },
    [state.items]
  );

  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Group items by supplier for checkout
  const supplierGroups = new Map<
    string,
    { supplierName: string; connectionId: string; items: CartItem[] }
  >();
  for (const item of state.items) {
    const existing = supplierGroups.get(item.supplierId);
    if (existing) {
      existing.items.push(item);
    } else {
      supplierGroups.set(item.supplierId, {
        supplierName: item.supplierName,
        connectionId: item.connectionId,
        items: [item],
      });
    }
  }

  return (
    <CartContext.Provider
      value={{
        items: state.items,
        isOpen: state.isOpen,
        itemCount,
        subtotal,
        supplierGroups,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        clearSupplier,
        toggleCart,
        openCart,
        closeCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
