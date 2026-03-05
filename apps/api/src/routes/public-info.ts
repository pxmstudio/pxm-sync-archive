import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { organizations } from "@workspace/db/schema";
import type { Env, Variables } from "../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Get public supplier info by organization ID
 * This is a truly public endpoint - no authentication required
 * Used for personalized sign-in/sign-up pages when visiting supplier links
 */
app.get("/suppliers/:id", async (c) => {
  const { id } = c.req.param();
  const db = c.get("db");

  // Validate the ID format (internal org IDs start with org_)
  if (!id.startsWith("org_")) {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_ID",
          message: "Invalid organization ID format",
        },
      },
      400
    );
  }

  // Find the organization by internal ID
  const org = await db
    .select({
      name: organizations.name,
      logoUrl: organizations.logoUrl,
      description: organizations.description,
      roles: organizations.roles,
    })
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  if (org.length === 0) {
    return c.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Organization not found",
        },
      },
      404
    );
  }

  const organization = org[0]!;

  // Only return info for organizations that have supplier role
  if (!organization.roles.includes("supplier")) {
    return c.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Organization not found",
        },
      },
      404
    );
  }

  return c.json({
    success: true,
    data: {
      name: organization.name,
      logoUrl: organization.logoUrl,
      description: organization.description,
    },
  });
});

export default app;
