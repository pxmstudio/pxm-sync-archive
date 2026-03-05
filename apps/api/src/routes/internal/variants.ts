import { Hono } from "hono";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import { products, variants } from "@workspace/db";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /internal/variants - Search variants for supplier
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);

  // Get products for this supplier first
  const supplierProducts = await db.query.products.findMany({
    where: eq(products.supplierId, auth.organizationId),
    columns: { id: true, name: true },
  });

  const productIds = supplierProducts.map((p) => p.id);
  const productNames = new Map(supplierProducts.map((p) => [p.id, p.name]));

  if (productIds.length === 0) {
    return success(c, []);
  }

  // Build search conditions
  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(variants.name, `%${search}%`),
        ilike(variants.sku, `%${search}%`)
      )!
    );
  }

  // Query variants
  const results = await db.query.variants.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(variants.updatedAt)],
    limit,
  });

  // Filter to only supplier's products and add product name
  const filtered = results
    .filter((v) => productIds.includes(v.productId))
    .map((v) => ({
      ...v,
      productName: productNames.get(v.productId) || "Unknown",
    }));

  return success(c, filtered);
});

export default app;
