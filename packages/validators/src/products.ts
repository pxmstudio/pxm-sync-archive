import { z } from "zod";
import {
  productId,
  variantId,
  organizationId,
  url,
  money,
} from "./common.js";

// ============================================
// Product Image
// ============================================

export const productImage = z.object({
  url: url,
  altText: z.string().max(255).optional(),
  position: z.number().int().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type ProductImage = z.infer<typeof productImage>;

// ============================================
// Variant Attributes
// ============================================

export const variantAttributes = z.record(z.string().max(255));

export type VariantAttributes = z.infer<typeof variantAttributes>;

// ============================================
// Create Variant
// ============================================

export const createVariant = z.object({
  externalId: z.string().max(255).optional(),
  sku: z.string().max(255).optional(),
  name: z.string().min(1).max(255),
  barcode: z.string().max(255).optional(),

  // Pricing
  price: money,
  compareAtPrice: money.optional(),
  costPrice: money.optional(),
  currency: z.string().length(3).default("USD"),

  // Weight
  weight: z.number().nonnegative().optional(),
  weightUnit: z.enum(["kg", "g", "lb", "oz"]).default("kg"),

  // Attributes
  attributes: variantAttributes.optional(),

  // Position
  position: z.number().int().nonnegative().optional(),
});

export type CreateVariant = z.infer<typeof createVariant>;

// ============================================
// Update Variant
// ============================================

export const updateVariant = createVariant.partial();

export type UpdateVariant = z.infer<typeof updateVariant>;

// ============================================
// Variant Response
// ============================================

export const variant = createVariant.extend({
  id: variantId,
  productId: productId,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Variant = z.infer<typeof variant>;

// ============================================
// Create Product
// ============================================

export const createProduct = z.object({
  externalId: z.string().max(255).optional(),
  sku: z.string().max(255).optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional(),
  brand: z.string().max(255).optional(),
  productType: z.string().max(255).optional(),
  tags: z.array(z.string().max(100)).default([]),
  images: z.array(productImage).default([]),
  metadata: z.record(z.unknown()).optional(),

  // Optionally create variants inline
  variants: z.array(createVariant).optional(),
});

export type CreateProduct = z.infer<typeof createProduct>;

// ============================================
// Update Product
// ============================================

export const updateProduct = createProduct.omit({ variants: true }).partial();

export type UpdateProduct = z.infer<typeof updateProduct>;

// ============================================
// Product Response
// ============================================

export const product = createProduct.omit({ variants: true }).extend({
  id: productId,
  supplierId: organizationId,
  isActive: z.string(),
  syncedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type Product = z.infer<typeof product>;

// Product with variants
export const productWithVariants = product.extend({
  variants: z.array(variant),
});

export type ProductWithVariants = z.infer<typeof productWithVariants>;

// ============================================
// Product List Filters
// ============================================

export const productFilters = z.object({
  search: z.string().max(100).optional(),
  brand: z.string().max(255).optional(),
  productType: z.string().max(255).optional(),
  tags: z.array(z.string()).optional(),
  collectionId: z.string().max(255).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type ProductFilters = z.infer<typeof productFilters>;

// ============================================
// Product Sync (from external source)
// ============================================

export const syncProduct = createProduct.extend({
  externalId: z.string().min(1).max(255), // Required for sync
  variants: z.array(
    createVariant.extend({
      externalId: z.string().min(1).max(255), // Required for sync
      inventoryQuantity: z.number().int().nonnegative().optional(),
    })
  ),
});

export type SyncProduct = z.infer<typeof syncProduct>;
