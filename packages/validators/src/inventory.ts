import { z } from "zod";
import {
  inventoryId,
  variantId,
  productId,
} from "./common.js";

// ============================================
// Inventory
// ============================================

export const inventory = z.object({
  id: inventoryId,
  variantId: variantId,
  quantity: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().nullable(),
  updatedAt: z.coerce.date(),
});

export type Inventory = z.infer<typeof inventory>;

// Computed available quantity
export const inventoryWithAvailable = inventory.extend({
  available: z.number().int(), // quantity - reserved
});

export type InventoryWithAvailable = z.infer<typeof inventoryWithAvailable>;

// ============================================
// Update Inventory
// ============================================

export const updateInventory = z.object({
  quantity: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().nullable().optional(),
});

export type UpdateInventory = z.infer<typeof updateInventory>;

// ============================================
// Adjust Inventory
// ============================================

export const adjustInventory = z.object({
  variantId: variantId,
  delta: z.number().int(), // Can be positive or negative
  reason: z.string().max(255).optional(),
});

export type AdjustInventory = z.infer<typeof adjustInventory>;

// Bulk adjustment
export const bulkAdjustInventory = z.object({
  adjustments: z.array(adjustInventory).min(1).max(100),
});

export type BulkAdjustInventory = z.infer<typeof bulkAdjustInventory>;

// ============================================
// Set Inventory (absolute value)
// ============================================

export const setInventory = z.object({
  variantId: variantId,
  quantity: z.number().int().nonnegative(),
});

export type SetInventory = z.infer<typeof setInventory>;

// Bulk set
export const bulkSetInventory = z.object({
  items: z.array(setInventory).min(1).max(100),
});

export type BulkSetInventory = z.infer<typeof bulkSetInventory>;

// ============================================
// Inventory Response (with variant info)
// ============================================

export const inventoryItem = inventoryWithAvailable.extend({
  sku: z.string().nullable(),
  variantName: z.string(),
  productId: productId,
  productName: z.string(),
});

export type InventoryItem = z.infer<typeof inventoryItem>;

// ============================================
// Inventory Filters
// ============================================

export const inventoryFilters = z.object({
  lowStock: z.coerce.boolean().optional(), // Only show items below threshold
  outOfStock: z.coerce.boolean().optional(), // Only show items with 0 available
  search: z.string().max(100).optional(), // Search by SKU or product name
});

export type InventoryFilters = z.infer<typeof inventoryFilters>;

// ============================================
// Reserve Inventory (for pending syncs)
// ============================================

export const reserveInventory = z.object({
  variantId: variantId,
  quantity: z.number().int().positive(),
});

export type ReserveInventory = z.infer<typeof reserveInventory>;

export const releaseReservation = z.object({
  variantId: variantId,
  quantity: z.number().int().positive(),
});

export type ReleaseReservation = z.infer<typeof releaseReservation>;
