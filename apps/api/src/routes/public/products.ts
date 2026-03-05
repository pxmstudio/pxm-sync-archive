import { eq, and, desc, ilike, or, inArray } from "drizzle-orm";
import { products, collectionProducts } from "@workspace/db";
import { paginationParams } from "@workspace/validators/common";
import { productFilters } from "@workspace/validators/products";
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

const publicVariantSchema = z.object({
  id: z.string().openapi({ example: "var_01234567890abcdefghijklmno" }),
  externalId: z.string().nullable().openapi({ example: "shopify_variant_123" }),
  sku: z.string().nullable().openapi({ example: "SKU-001" }),
  name: z.string().openapi({ example: "Size M / Blue" }),
  price: z.string().openapi({ example: "29.99" }),
  compareAtPrice: z.string().nullable().openapi({ example: "39.99" }),
  currency: z.string().openapi({ example: "USD" }),
  attributes: z.record(z.string()).nullable().openapi({ example: { size: "M", color: "Blue" } }),
}).openapi("PublicVariant");

const publicVariantWithInventorySchema = publicVariantSchema.extend({
  available: z.number().int().openapi({ example: 50, description: "Available quantity (quantity - reserved)" }),
}).openapi("PublicVariantWithInventory");

const publicVariantDetailedSchema = publicVariantSchema.extend({
  weight: z.number().nullable().openapi({ example: 0.5 }),
  weightUnit: z.string().nullable().openapi({ example: "kg" }),
  available: z.number().int().openapi({ example: 50 }),
}).openapi("PublicVariantDetailed");

const productImageSchema = z.object({
  url: z.string().url().openapi({ example: "https://example.com/image.jpg" }),
  altText: z.string().nullable().optional().openapi({ example: "Product image" }),
  position: z.number().int().nullable().optional().openapi({ example: 0 }),
  width: z.number().int().nullable().optional().openapi({ example: 800 }),
  height: z.number().int().nullable().optional().openapi({ example: 600 }),
}).openapi("ProductImage");

const supplierInfoSchema = z.object({
  id: z.string().openapi({ example: "org_01234567890abcdefghijklmno" }),
  name: z.string().openapi({ example: "Example Supplier" }),
  slug: z.string().nullable().openapi({ example: "example-supplier" }),
}).openapi("SupplierInfo");

const publicProductSchema = z.object({
  id: z.string().openapi({ example: "prd_01234567890abcdefghijklmno" }),
  externalId: z.string().nullable().openapi({ example: "shopify_product_123" }),
  sku: z.string().nullable().openapi({ example: "PROD-001" }),
  name: z.string().openapi({ example: "Premium T-Shirt" }),
  description: z.string().nullable().openapi({ example: "A high-quality cotton t-shirt" }),
  brand: z.string().nullable().openapi({ example: "Example Brand" }),
  productType: z.string().nullable().openapi({ example: "Apparel" }),
  tags: z.array(z.string()).nullable().openapi({ example: ["new", "featured"] }),
  images: z.array(productImageSchema).nullable(),
  variants: z.array(publicVariantSchema),
  supplier: supplierInfoSchema.openapi({ description: "Supplier information (included in multi-supplier queries)" }),
  updatedAt: z.string().datetime().openapi({ example: "2024-01-15T10:30:00Z" }),
}).openapi("PublicProduct");

const publicProductDetailSchema = z.object({
  id: z.string().openapi({ example: "prd_01234567890abcdefghijklmno" }),
  externalId: z.string().nullable(),
  sku: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  brand: z.string().nullable(),
  productType: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  images: z.array(productImageSchema).nullable(),
  variants: z.array(publicVariantWithInventorySchema),
  supplier: supplierInfoSchema,
  updatedAt: z.string().datetime(),
}).openapi("PublicProductDetail");

// ============================================
// Routes
// ============================================

// GET /v1/products - List products (optional supplierId)
const listProductsRoute = createRoute({
  operationId: "listProducts",
  method: "get",
  path: "/",
  tags: ["Products"],
  summary: "List products",
  description: "Get a paginated list of products. If supplierId is provided, returns products from that supplier only. If omitted, returns products from all connected suppliers.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("products:read"), supplierContext] as const,
  request: {
    query: paginationParams.merge(productFilters.partial()).merge(optionalSupplierIdParam).openapi({
      example: { page: 1, limit: 20, search: "t-shirt" },
    }),
  },
  responses: {
    200: {
      description: "List of products",
      content: {
        "application/json": {
          schema: createPaginatedResponse(publicProductSchema, "ListProductsResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(listProductsRoute, async (c) => {
  const supplier = c.get("supplier")!;
  const db = c.get("db");
  const { page, limit, search, brand, productType, collectionId } =
    c.req.valid("query");

  // Get supplier IDs to query
  const supplierIds = supplier.mode === "single"
    ? [supplier.supplierId]
    : supplier.supplierIds;

  // If filtering by collection, get product IDs in that collection first
  let collectionProductIds: string[] | null = null;
  if (collectionId) {
    const collectionProductRecords = await db.query.collectionProducts.findMany({
      where: eq(collectionProducts.collectionId, collectionId),
      columns: { productId: true },
    });
    collectionProductIds = collectionProductRecords.map((cp) => cp.productId);

    // If no products in collection, return empty result
    if (collectionProductIds.length === 0) {
      return paginated(c, [], { page, limit, total: 0 });
    }
  }

  // Build where clause
  const conditions = [
    inArray(products.supplierId, supplierIds),
    eq(products.isActive, "true"), // Only show active products
  ];

  if (search) {
    conditions.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(products.sku, `%${search}%`)
      )!
    );
  }
  if (brand) {
    conditions.push(eq(products.brand, brand));
  }
  if (productType) {
    conditions.push(eq(products.productType, productType));
  }
  if (collectionProductIds) {
    conditions.push(inArray(products.id, collectionProductIds));
  }

  const whereClause = and(...conditions);

  // Fetch products with supplier info
  const allProducts = await db.query.products.findMany({
    where: whereClause,
    with: {
      variants: {
        columns: {
          id: true,
          externalId: true,
          sku: true,
          name: true,
          price: true,
          compareAtPrice: true,
          currency: true,
          attributes: true,
        },
      },
      supplier: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: [desc(products.updatedAt)],
  });

  // Paginate (all active products are visible)
  const total = allProducts.length;
  const paginatedProducts = allProducts.slice(
    (page - 1) * limit,
    page * limit
  );

  // Transform for public API (remove internal fields)
  const publicProducts = paginatedProducts.map((p: any) => ({
    id: p.id as string,
    externalId: p.externalId as string | null,
    sku: p.sku as string | null,
    name: p.name as string,
    description: p.description as string | null,
    brand: p.brand as string | null,
    productType: p.productType as string | null,
    tags: p.tags as string[] | null,
    images: p.images,
    variants: p.variants,
    supplier: {
      id: p.supplier.id,
      name: p.supplier.name,
      slug: p.supplier.slug,
    },
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
  }));

  return paginated(c, publicProducts, { page, limit, total });
});

// GET /v1/products/:id - Get product details (requires supplierId for visibility rules)
const getProductRoute = createRoute({
  operationId: "getProduct",
  method: "get",
  path: "/{id}",
  tags: ["Products"],
  summary: "Get product details",
  description: "Get detailed information about a specific product including variants and inventory. Requires supplierId to apply visibility rules.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("products:read"), supplierContext, requireSingleSupplier] as const,
  request: {
    params: z.object({
      id: z.string().openapi({
        description: "Product ID",
        example: "prd_01234567890abcdefghijklmno",
      }),
    }),
    query: requiredSupplierIdParam,
  },
  responses: {
    200: {
      description: "Product details",
      content: {
        "application/json": {
          schema: createSuccessResponse(publicProductDetailSchema, "GetProductResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(getProductRoute, async (c) => {
  const supplier = c.get("supplier")! as SingleSupplierContext;
  const db = c.get("db");
  const { id } = c.req.valid("param");

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, id),
      eq(products.supplierId, supplier.supplierId),
      eq(products.isActive, "true")
    ),
    with: {
      variants: {
        with: {
          inventory: {
            columns: {
              quantity: true,
              reserved: true,
            },
          },
        },
      },
      supplier: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!product) {
    throw Errors.notFound("Product");
  }

  // Transform for public API
  return c.json({
    success: true as const,
    data: {
      id: product.id,
      externalId: product.externalId,
      sku: product.sku,
      name: product.name,
      description: product.description,
      brand: product.brand,
      productType: product.productType,
      tags: product.tags,
      images: product.images,
      variants: product.variants.map((v) => ({
        id: v.id,
        externalId: v.externalId,
        sku: v.sku,
        name: v.name,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        currency: v.currency,
        attributes: v.attributes,
        available: v.inventory
          ? Number(v.inventory.quantity) - Number(v.inventory.reserved)
          : 0,
      })),
      supplier: {
        id: product.supplier!.id,
        name: product.supplier!.name,
        slug: product.supplier!.slug,
      },
      updatedAt: product.updatedAt instanceof Date ? product.updatedAt.toISOString() : product.updatedAt,
    },
  }, 200 as const);
});

// GET /v1/products/:id/variants - Get product variants (requires supplierId)
const getProductVariantsRoute = createRoute({
  operationId: "getProductVariants",
  method: "get",
  path: "/{id}/variants",
  tags: ["Products"],
  summary: "Get product variants",
  description: "Get all variants for a specific product including inventory availability. Requires supplierId.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("products:read"), supplierContext, requireSingleSupplier] as const,
  request: {
    params: z.object({
      id: z.string().openapi({
        description: "Product ID",
        example: "prd_01234567890abcdefghijklmno",
      }),
    }),
    query: requiredSupplierIdParam,
  },
  responses: {
    200: {
      description: "List of variants",
      content: {
        "application/json": {
          schema: createSuccessResponse(z.array(publicVariantDetailedSchema), "GetProductVariantsResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(getProductVariantsRoute, async (c) => {
  const supplier = c.get("supplier")! as SingleSupplierContext;
  const db = c.get("db");
  const { id } = c.req.valid("param");

  const product = await db.query.products.findFirst({
    where: and(
      eq(products.id, id),
      eq(products.supplierId, supplier.supplierId),
      eq(products.isActive, "true")
    ),
    with: {
      variants: {
        with: {
          inventory: true,
        },
      },
    },
  });

  if (!product) {
    throw Errors.notFound("Product");
  }

  return c.json({
    success: true as const,
    data: product.variants.map((v) => ({
      id: v.id,
      externalId: v.externalId,
      sku: v.sku,
      name: v.name,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      currency: v.currency,
      weight: v.weight ? Number(v.weight) : null,
      weightUnit: v.weightUnit,
      attributes: v.attributes,
      available: v.inventory
        ? Number(v.inventory.quantity) - Number(v.inventory.reserved)
        : 0,
    })),
  }, 200 as const);
});

export default app;
