import { eq, and, inArray } from "drizzle-orm";
import { inventory, variants, products } from "@workspace/db";
import { paginationParams } from "@workspace/validators/common";
import { inventoryFilters } from "@workspace/validators/inventory";
import { paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { requireScopes, supplierContext, requireSingleSupplier } from "../../middleware/index.js";
import type { Env, Variables, SingleSupplierContext } from "../../types.js";
import {
  createOpenAPIApp,
  createRoute,
  z,
  commonErrorResponses,
  createPaginatedResponse,
  createSuccessResponse,
  optionalSupplierIdParam,
  requiredSupplierIdParam,
} from "./openapi.js";

const app = createOpenAPIApp();

// ============================================
// Response Schemas
// ============================================

const supplierInfoSchema = z.object({
  id: z.string().openapi({ example: "org_01234567890abcdefghijklmno" }),
  name: z.string().openapi({ example: "Example Supplier" }),
  slug: z.string().nullable().openapi({ example: "example-supplier" }),
}).openapi("InventorySupplierInfo");

const inventoryItemSchema = z.object({
  variantId: z.string().openapi({ example: "var_01234567890abcdefghijklmno" }),
  sku: z.string().nullable().openapi({ example: "SKU-001" }),
  variantName: z.string().openapi({ example: "Size M / Blue" }),
  productId: z.string().openapi({ example: "prd_01234567890abcdefghijklmno" }),
  productName: z.string().openapi({ example: "Premium T-Shirt" }),
  quantity: z.number().int().openapi({ example: 100, description: "Total quantity in stock" }),
  reserved: z.number().int().openapi({ example: 10, description: "Quantity reserved for pending orders" }),
  available: z.number().int().openapi({ example: 90, description: "Available quantity (quantity - reserved)" }),
  lowStockThreshold: z.number().int().nullable().openapi({ example: 20 }),
  isLowStock: z.boolean().openapi({ example: false, description: "True if available <= lowStockThreshold" }),
  supplier: supplierInfoSchema.openapi({ description: "Supplier information" }),
  updatedAt: z.string().datetime().openapi({ example: "2024-01-15T10:30:00Z" }),
}).openapi("InventoryItem");

const batchInventoryItemSchema = z.object({
  variantId: z.string().openapi({ example: "var_01234567890abcdefghijklmno" }),
  sku: z.string().nullable().openapi({ example: "SKU-001" }),
  quantity: z.number().int().openapi({ example: 100 }),
  reserved: z.number().int().openapi({ example: 10 }),
  available: z.number().int().openapi({ example: 90 }),
  supplier: supplierInfoSchema.openapi({ description: "Supplier information" }),
}).openapi("BatchInventoryItem");

// ============================================
// Routes
// ============================================

// GET /v1/inventory - Get inventory levels (optional supplierId)
const listInventoryRoute = createRoute({
  operationId: "listInventory",
  method: "get",
  path: "/",
  tags: ["Inventory"],
  summary: "List inventory",
  description: "Get a paginated list of inventory levels. If supplierId is provided, returns inventory from that supplier only. If omitted, returns inventory from all connected suppliers.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("inventory:read"), supplierContext] as const,
  request: {
    query: paginationParams.merge(inventoryFilters.partial()).merge(optionalSupplierIdParam).openapi({
      example: { page: 1, limit: 20, lowStock: true },
    }),
  },
  responses: {
    200: {
      description: "List of inventory items",
      content: {
        "application/json": {
          schema: createPaginatedResponse(inventoryItemSchema, "ListInventoryResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(listInventoryRoute, async (c) => {
  const supplier = c.get("supplier")!;
  const db = c.get("db");
  const { page, limit, lowStock, outOfStock, search } = c.req.valid("query");

  // Get supplier IDs to query
  const supplierIds = supplier.mode === "single"
    ? [supplier.supplierId]
    : supplier.supplierIds;

  // Get all variants for these suppliers' products
  const supplierProducts = await db.query.products.findMany({
    where: and(
      inArray(products.supplierId, supplierIds),
      eq(products.isActive, "true")
    ),
    columns: { id: true },
  });

  const productIds = supplierProducts.map((p: { id: string }) => p.id);

  if (productIds.length === 0) {
    return paginated(c, [], { page, limit, total: 0 });
  }

  // Get variants with inventory and supplier info
  let allVariants = await db.query.variants.findMany({
    where: inArray(variants.productId, productIds),
    with: {
      inventory: true,
      product: {
        columns: { id: true, name: true },
        with: {
          supplier: {
            columns: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  // Apply filters
  if (search) {
    const searchLower = search.toLowerCase();
    allVariants = allVariants.filter(
      (v: { sku: string | null; name: string; product: { name: string } }) =>
        v.sku?.toLowerCase().includes(searchLower) ||
        v.name.toLowerCase().includes(searchLower) ||
        v.product.name.toLowerCase().includes(searchLower)
    );
  }

  // Calculate available and apply stock filters
  let inventoryItems = allVariants.map((v: any) => {
    const qty = v.inventory ? Number(v.inventory.quantity) : 0;
    const reserved = v.inventory ? Number(v.inventory.reserved) : 0;
    const threshold = v.inventory?.lowStockThreshold
      ? Number(v.inventory.lowStockThreshold)
      : null;
    const updatedAtDate = v.inventory?.updatedAt || v.updatedAt;

    return {
      variantId: v.id as string,
      sku: v.sku as string | null,
      variantName: v.name as string,
      productId: v.productId as string,
      productName: v.product.name as string,
      quantity: qty,
      reserved,
      available: qty - reserved,
      lowStockThreshold: threshold,
      isLowStock: threshold !== null && qty - reserved <= threshold,
      supplier: {
        id: v.product.supplier.id,
        name: v.product.supplier.name,
        slug: v.product.supplier.slug,
      },
      updatedAt: updatedAtDate instanceof Date ? updatedAtDate.toISOString() : updatedAtDate,
    };
  });

  // Filter by stock status
  if (outOfStock) {
    inventoryItems = inventoryItems.filter((i: { available: number }) => i.available <= 0);
  } else if (lowStock) {
    inventoryItems = inventoryItems.filter((i: { isLowStock: boolean }) => i.isLowStock);
  }

  // Paginate
  const total = inventoryItems.length;
  const paginatedItems = inventoryItems.slice(
    (page - 1) * limit,
    page * limit
  );

  return paginated(c, paginatedItems, { page, limit, total });
});

// GET /v1/inventory/:variantId - Get specific variant inventory (requires supplierId)
const getVariantInventoryRoute = createRoute({
  operationId: "getVariantInventory",
  method: "get",
  path: "/{variantId}",
  tags: ["Inventory"],
  summary: "Get variant inventory",
  description: "Get inventory information for a specific variant. Requires supplierId.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("inventory:read"), supplierContext, requireSingleSupplier] as const,
  request: {
    params: z.object({
      variantId: z.string().openapi({
        description: "Variant ID",
        example: "var_01234567890abcdefghijklmno",
      }),
    }),
    query: requiredSupplierIdParam,
  },
  responses: {
    200: {
      description: "Inventory details",
      content: {
        "application/json": {
          schema: createSuccessResponse(inventoryItemSchema, "GetVariantInventoryResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(getVariantInventoryRoute, async (c) => {
  const supplier = c.get("supplier")! as SingleSupplierContext;
  const db = c.get("db");
  const { variantId } = c.req.valid("param");

  // Get variant with product verification
  const variant = await db.query.variants.findFirst({
    where: eq(variants.id, variantId),
    with: {
      inventory: true,
      product: {
        columns: { id: true, name: true, supplierId: true, isActive: true },
        with: {
          supplier: {
            columns: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  if (!variant) {
    throw Errors.notFound("Variant");
  }

  // Verify supplier access
  if (
    variant.product.supplierId !== supplier.supplierId ||
    variant.product.isActive !== "true"
  ) {
    throw Errors.notFound("Variant");
  }

  const qty = variant.inventory ? Number(variant.inventory.quantity) : 0;
  const reserved = variant.inventory ? Number(variant.inventory.reserved) : 0;
  const threshold = variant.inventory?.lowStockThreshold
    ? Number(variant.inventory.lowStockThreshold)
    : null;

  const updatedAtDate = variant.inventory?.updatedAt || variant.updatedAt;

  return c.json({
    success: true as const,
    data: {
      variantId: variant.id,
      sku: variant.sku,
      variantName: variant.name,
      productId: variant.productId,
      productName: variant.product.name,
      quantity: qty,
      reserved,
      available: qty - reserved,
      lowStockThreshold: threshold,
      isLowStock: threshold !== null && qty - reserved <= threshold,
      supplier: {
        id: variant.product.supplier!.id,
        name: variant.product.supplier!.name,
        slug: variant.product.supplier!.slug,
      },
      updatedAt: updatedAtDate instanceof Date ? updatedAtDate.toISOString() : updatedAtDate,
    },
  }, 200 as const);
});

// POST /v1/inventory/batch - Get inventory for multiple variants (optional supplierId)
const batchInventoryRoute = createRoute({
  operationId: "batchInventory",
  method: "post",
  path: "/batch",
  tags: ["Inventory"],
  summary: "Batch inventory lookup",
  description: "Get inventory for multiple variants in a single request. Maximum 100 variants per request. If supplierId is omitted, returns inventory from any connected supplier.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("inventory:read"), supplierContext] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            variantIds: z.array(z.string()).min(1).max(100).openapi({
              description: "Array of variant IDs to look up (max 100)",
              example: ["var_01234567890abcdefghijklmno", "var_01234567890abcdefghijklmnp"],
            }),
          }).openapi("BatchInventoryRequest"),
        },
      },
    },
    query: optionalSupplierIdParam,
  },
  responses: {
    200: {
      description: "Inventory for requested variants",
      content: {
        "application/json": {
          schema: createSuccessResponse(z.array(batchInventoryItemSchema), "BatchInventoryResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(batchInventoryRoute, async (c) => {
  const supplier = c.get("supplier")!;
  const db = c.get("db");
  const { variantIds } = c.req.valid("json");

  // Get supplier IDs to filter by
  const supplierIds = supplier.mode === "single"
    ? [supplier.supplierId]
    : supplier.supplierIds;

  // Get variants with supplier info
  const variantList = await db.query.variants.findMany({
    where: inArray(variants.id, variantIds),
    with: {
      inventory: true,
      product: {
        columns: { id: true, name: true, supplierId: true, isActive: true },
        with: {
          supplier: {
            columns: { id: true, name: true, slug: true },
          },
        },
      },
    },
  });

  // Filter to only include variants from connected suppliers' active products
  const validVariants = variantList.filter(
    (v: any) =>
      supplierIds.includes(v.product.supplierId) &&
      v.product.isActive === "true"
  );

  const inventoryItems = validVariants.map((v: any) => {
    const qty = v.inventory ? Number(v.inventory.quantity) : 0;
    const reserved = v.inventory ? Number(v.inventory.reserved) : 0;

    return {
      variantId: v.id as string,
      sku: v.sku as string | null,
      quantity: qty,
      reserved,
      available: qty - reserved,
      supplier: {
        id: v.product.supplier.id,
        name: v.product.supplier.name,
        slug: v.product.supplier.slug,
      },
    };
  });

  return c.json({
    success: true as const,
    data: inventoryItems,
  }, 200 as const);
});

export default app;
