import { Hono } from "hono";
import { eq, and, ilike, desc } from "drizzle-orm";
import { brands } from "@workspace/db";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /internal/brands - List brands for supplier
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const search = c.req.query("search");

  const conditions = [eq(brands.supplierId, auth.organizationId)];

  if (search) {
    conditions.push(ilike(brands.name, `%${search}%`));
  }

  const results = await db.query.brands.findMany({
    where: and(...conditions),
    orderBy: [desc(brands.productCount)],
  });

  return success(c, results);
});

export default app;
