import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { organizations } from "@workspace/db";
import { success } from "../../lib/response.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /internal/bootstrap - Get essential app state in one call
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, auth.organizationId),
  });

  if (!org) {
    return c.json(
      { success: false, error: { code: "NOT_FOUND", message: "Organization not found" } },
      404
    );
  }

  // Parse role status
  const roles = (org.roles as string[]) || [];
  const hasRole = roles.length > 0;
  const hasSupplierRole = roles.includes("supplier");
  const hasRetailerRole = roles.includes("retailer");

  return success(c, {
    roles: {
      hasRole,
      hasSupplierRole,
      hasRetailerRole,
      roles,
      needsRoleSelection: !hasRole,
    },
    organization: {
      id: org.id,
      name: org.name,
    },
  });
});

export default app;
