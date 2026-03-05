import { eq, desc, inArray } from "drizzle-orm";
import { collections, brands, productTypes } from "@workspace/db";
import { requireScopes, supplierContext } from "../../middleware/index.js";
import type { Env, Variables } from "../../types.js";
import {
  createOpenAPIApp,
  createRoute,
  z,
  commonErrorResponses,
  createSuccessResponse,
  optionalSupplierIdParam,
} from "./openapi.js";

const app = createOpenAPIApp();

// ============================================
// Response Schemas
// ============================================

const supplierInfoSchema = z.object({
  id: z.string().openapi({ example: "org_01234567890abcdefghijklmno" }),
  name: z.string().openapi({ example: "Example Supplier" }),
  slug: z.string().nullable().openapi({ example: "example-supplier" }),
}).openapi("FacetSupplierInfo");

const collectionSchema = z.object({
  id: z.string().openapi({ example: "col_01234567890abcdefghijklmno" }),
  title: z.string().openapi({ example: "Summer Collection" }),
  handle: z.string().nullable().openapi({ example: "summer-collection" }),
  description: z.string().nullable().openapi({ example: "Products for the summer season" }),
  imageUrl: z.string().nullable().openapi({ example: "https://example.com/collection.jpg" }),
  supplierId: z.string().openapi({ example: "org_01234567890abcdefghijklmno" }),
}).openapi("Collection");

const brandSchema = z.object({
  id: z.string().openapi({ example: "brd_01234567890abcdefghijklmno" }),
  name: z.string().openapi({ example: "Example Brand" }),
  productCount: z.number().int().nullable().openapi({ example: 25 }),
  supplierId: z.string().openapi({ example: "org_01234567890abcdefghijklmno" }),
}).openapi("Brand");

const productTypeSchema = z.object({
  id: z.string().openapi({ example: "pty_01234567890abcdefghijklmno" }),
  name: z.string().openapi({ example: "T-Shirts" }),
  productCount: z.number().int().nullable().openapi({ example: 50 }),
  supplierId: z.string().openapi({ example: "org_01234567890abcdefghijklmno" }),
}).openapi("ProductType");

const allFacetsSchema = z.object({
  collections: z.array(collectionSchema),
  brands: z.array(brandSchema),
  productTypes: z.array(productTypeSchema),
}).openapi("AllFacets");

// ============================================
// Routes
// ============================================

// GET /v1/facets - Get all available facets for filtering (optional supplierId)
const getAllFacetsRoute = createRoute({
  operationId: "getAllFacets",
  method: "get",
  path: "/",
  tags: ["Facets"],
  summary: "Get all facets",
  description: "Get all available facets (collections, brands, product types) for filtering products. If supplierId is omitted, returns facets from all connected suppliers.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("products:read"), supplierContext] as const,
  request: {
    query: optionalSupplierIdParam,
  },
  responses: {
    200: {
      description: "All facets",
      content: {
        "application/json": {
          schema: createSuccessResponse(allFacetsSchema, "GetAllFacetsResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(getAllFacetsRoute, async (c) => {
  const supplier = c.get("supplier")!;
  const db = c.get("db");

  // Get supplier IDs to query
  const supplierIds = supplier.mode === "single"
    ? [supplier.supplierId]
    : supplier.supplierIds;

  // Fetch all facets in parallel
  const [collectionsList, brandsList, productTypesList] = await Promise.all([
    db.query.collections.findMany({
      where: inArray(collections.supplierId, supplierIds),
      columns: {
        id: true,
        title: true,
        handle: true,
        description: true,
        imageUrl: true,
        supplierId: true,
      },
      orderBy: [collections.title],
    }),
    db.query.brands.findMany({
      where: inArray(brands.supplierId, supplierIds),
      columns: {
        id: true,
        name: true,
        productCount: true,
        supplierId: true,
      },
      orderBy: [desc(brands.productCount)],
    }),
    db.query.productTypes.findMany({
      where: inArray(productTypes.supplierId, supplierIds),
      columns: {
        id: true,
        name: true,
        productCount: true,
        supplierId: true,
      },
      orderBy: [desc(productTypes.productCount)],
    }),
  ]);

  return c.json({
    success: true as const,
    data: {
      collections: collectionsList,
      brands: brandsList.map((b) => ({
        ...b,
        productCount: b.productCount ? Number(b.productCount) : null,
      })),
      productTypes: productTypesList.map((pt) => ({
        ...pt,
        productCount: pt.productCount ? Number(pt.productCount) : null,
      })),
    },
  }, 200 as const);
});

// GET /v1/facets/collections - List collections (optional supplierId)
const listCollectionsRoute = createRoute({
  operationId: "listCollections",
  method: "get",
  path: "/collections",
  tags: ["Facets"],
  summary: "List collections",
  description: "Get a list of available product collections. If supplierId is omitted, returns collections from all connected suppliers.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("products:read"), supplierContext] as const,
  request: {
    query: optionalSupplierIdParam,
  },
  responses: {
    200: {
      description: "List of collections",
      content: {
        "application/json": {
          schema: createSuccessResponse(z.array(collectionSchema), "ListCollectionsResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(listCollectionsRoute, async (c) => {
  const supplier = c.get("supplier")!;
  const db = c.get("db");

  // Get supplier IDs to query
  const supplierIds = supplier.mode === "single"
    ? [supplier.supplierId]
    : supplier.supplierIds;

  const results = await db.query.collections.findMany({
    where: inArray(collections.supplierId, supplierIds),
    columns: {
      id: true,
      title: true,
      handle: true,
      description: true,
      imageUrl: true,
      supplierId: true,
    },
    orderBy: [collections.title],
  });

  return c.json({
    success: true as const,
    data: results,
  }, 200 as const);
});

// GET /v1/facets/brands - List brands (optional supplierId)
const listBrandsRoute = createRoute({
  operationId: "listBrands",
  method: "get",
  path: "/brands",
  tags: ["Facets"],
  summary: "List brands",
  description: "Get a list of available product brands. If supplierId is omitted, returns brands from all connected suppliers.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("products:read"), supplierContext] as const,
  request: {
    query: optionalSupplierIdParam,
  },
  responses: {
    200: {
      description: "List of brands",
      content: {
        "application/json": {
          schema: createSuccessResponse(z.array(brandSchema), "ListBrandsResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(listBrandsRoute, async (c) => {
  const supplier = c.get("supplier")!;
  const db = c.get("db");

  // Get supplier IDs to query
  const supplierIds = supplier.mode === "single"
    ? [supplier.supplierId]
    : supplier.supplierIds;

  const results = await db.query.brands.findMany({
    where: inArray(brands.supplierId, supplierIds),
    columns: {
      id: true,
      name: true,
      productCount: true,
      supplierId: true,
    },
    orderBy: [desc(brands.productCount)],
  });

  return c.json({
    success: true as const,
    data: results.map((b) => ({
      ...b,
      productCount: b.productCount ? Number(b.productCount) : null,
    })),
  }, 200 as const);
});

// GET /v1/facets/product-types - List product types (optional supplierId)
const listProductTypesRoute = createRoute({
  operationId: "listProductTypes",
  method: "get",
  path: "/product-types",
  tags: ["Facets"],
  summary: "List product types",
  description: "Get a list of available product types. If supplierId is omitted, returns product types from all connected suppliers.",
  security: [{ bearerAuth: [] }],
  middleware: [requireScopes("products:read"), supplierContext] as const,
  request: {
    query: optionalSupplierIdParam,
  },
  responses: {
    200: {
      description: "List of product types",
      content: {
        "application/json": {
          schema: createSuccessResponse(z.array(productTypeSchema), "ListProductTypesResponse"),
        },
      },
    },
    ...commonErrorResponses,
  },
});

app.openapi(listProductTypesRoute, async (c) => {
  const supplier = c.get("supplier")!;
  const db = c.get("db");

  // Get supplier IDs to query
  const supplierIds = supplier.mode === "single"
    ? [supplier.supplierId]
    : supplier.supplierIds;

  const results = await db.query.productTypes.findMany({
    where: inArray(productTypes.supplierId, supplierIds),
    columns: {
      id: true,
      name: true,
      productCount: true,
      supplierId: true,
    },
    orderBy: [desc(productTypes.productCount)],
  });

  return c.json({
    success: true as const,
    data: results.map((pt) => ({
      ...pt,
      productCount: pt.productCount ? Number(pt.productCount) : null,
    })),
  }, 200 as const);
});

export default app;
