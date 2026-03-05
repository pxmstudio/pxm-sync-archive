import { Hono } from "hono";
import { eq, and, ilike, desc } from "drizzle-orm";
import { productTags } from "@workspace/db";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /internal/tags - List tags for supplier
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const search = c.req.query("search");

  const conditions = [eq(productTags.supplierId, auth.organizationId)];

  if (search) {
    conditions.push(ilike(productTags.name, `%${search}%`));
  }

  const results = await db.query.productTags.findMany({
    where: and(...conditions),
    orderBy: [desc(productTags.productCount)],
  });

  return success(c, results);
});

export default app;
