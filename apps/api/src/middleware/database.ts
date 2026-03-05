import { createMiddleware } from "hono/factory";
import { getDb } from "../lib/db.js";
import type { Env, Variables } from "../types.js";

// Middleware to inject database instance
export const database = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const db = getDb(c.env);
  c.set("db", db);
  await next();
});
