import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { users, organizations } from "@workspace/db";
import { createClerkClient } from "@clerk/backend";
import { Errors } from "../lib/errors.js";
import type { Env, Variables, AuthContext, OrganizationRole, MembershipRole } from "../types.js";

// Valid organization roles
const VALID_ROLES: OrganizationRole[] = ["supplier", "retailer"];

// Map Clerk role to internal membership role
function mapClerkRole(clerkRole: string | undefined): MembershipRole {
  console.log(`[Auth] Clerk role: "${clerkRole}"`);
  if (!clerkRole) {
    return "member";
  }
  // Clerk roles: org:admin, org:member, or custom roles
  // Also handle owner case
  if (clerkRole === "org:admin" || clerkRole === "admin" || clerkRole.includes("admin")) {
    return "admin";
  }
  if (clerkRole === "org:owner" || clerkRole === "owner" || clerkRole.includes("owner")) {
    return "owner";
  }
  return "member";
}

// Decode Clerk JWT token claims
function decodeClerkToken(
  token: string
): { sub: string; org_id?: string; org_role?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]!));

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return {
      sub: payload.sub,
      org_id: payload.org_id,
      org_role: payload.org_role,
    };
  } catch {
    return null;
  }
}

// Auth middleware for internal API (Clerk session)
export const auth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.unauthorized();
  }

  const token = authHeader.slice(7);
  const claims = decodeClerkToken(token);

  if (!claims) {
    throw Errors.unauthorized("Invalid or expired token");
  }

  // Store raw token for forwarding to platform API
  c.set("clerkToken", token);

  const db = c.get("db");

  const clerkClient = createClerkClient({
    secretKey: c.env.CLERK_SECRET_KEY,
  });

  // Find user by external auth ID, or create if not found
  let user = await db.query.users.findFirst({
    where: eq(users.externalAuthId, claims.sub),
  });

  if (!user) {
    // User exists in Clerk but not in our DB - create them
    const clerkUser = await clerkClient.users.getUser(claims.sub);
    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    );

    if (!primaryEmail) {
      throw Errors.unauthorized("User has no email address");
    }

    const [newUser] = await db
      .insert(users)
      .values({
        externalAuthId: claims.sub,
        email: primaryEmail.emailAddress,
      })
      .returning();

    user = newUser!;
    console.log(`User created from auth middleware: ${claims.sub}`);
  }

  // Parse X-Active-Role header
  const activeRoleHeader = c.req.header("X-Active-Role") as OrganizationRole | undefined;

  // If organization context is provided in the token
  if (claims.org_id) {
    // Find the organization by Clerk's external ID, or create if not found
    let org = await db.query.organizations.findFirst({
      where: eq(organizations.externalAuthId, claims.org_id),
    });

    if (!org) {
      // Organization exists in Clerk but not in our DB - create it
      const clerkOrg = await clerkClient.organizations.getOrganization({
        organizationId: claims.org_id,
      });

      // Use upsert to handle race conditions (multiple requests trying to create same org)
      await db
        .insert(organizations)
        .values({
          externalAuthId: claims.org_id,
          name: clerkOrg.name,
          slug: clerkOrg.slug || clerkOrg.id,
          roles: [], // Empty roles = pending role selection during onboarding
        })
        .onConflictDoNothing({ target: organizations.externalAuthId });

      // Re-fetch the org (either we created it or it was created by a concurrent request)
      org = await db.query.organizations.findFirst({
        where: eq(organizations.externalAuthId, claims.org_id),
      });

      if (!org) {
        throw Errors.internal("Failed to create organization");
      }

      console.log(`Organization created from auth middleware: ${claims.org_id}`);
    }

    // Get organization roles (can be empty if pending role selection)
    const orgRoles = (org.roles as OrganizationRole[]) || [];

    // Determine active role from header, or default to first role (if any)
    let activeRole: OrganizationRole | null = orgRoles[0] || null;
    if (activeRoleHeader && VALID_ROLES.includes(activeRoleHeader)) {
      if (orgRoles.includes(activeRoleHeader)) {
        activeRole = activeRoleHeader;
      }
    }

    // Use membership role from JWT, or fetch from Clerk if missing
    console.log(`[Auth] JWT claims - org_id: ${claims.org_id}, org_role: ${claims.org_role}`);
    let membershipRole = mapClerkRole(claims.org_role);

    // If role is missing from JWT (undefined), fetch from Clerk API
    if (!claims.org_role) {
      try {
        const clerkMemberships = await clerkClient.users.getOrganizationMembershipList({
          userId: claims.sub,
        });
        const membership = clerkMemberships.data.find(
          (m) => m.organization.id === claims.org_id
        );
        if (membership) {
          membershipRole = mapClerkRole(membership.role);
          console.log(`[Auth] Fetched role from Clerk API: ${membership.role} -> ${membershipRole}`);
        }
      } catch (err) {
        console.warn(`[Auth] Failed to fetch membership role from Clerk:`, err);
      }
    }

    const authContext: AuthContext = {
      userId: user.id,
      organizationId: org.id,
      clerkOrgId: claims.org_id,
      organizationRoles: orgRoles,
      activeRole,
      membershipRole,
    };

    c.set("auth", authContext);
  } else {
    // No organization context in token - get user's first organization from Clerk
    const clerkMemberships = await clerkClient.users.getOrganizationMembershipList({
      userId: claims.sub,
    });

    if (clerkMemberships.data.length === 0) {
      throw Errors.forbidden("User has no organization");
    }

    // Use the first organization from Clerk
    const firstClerkMembership = clerkMemberships.data[0]!;
    const clerkOrgId = firstClerkMembership.organization.id;

    // Find or create the organization in our DB
    let org = await db.query.organizations.findFirst({
      where: eq(organizations.externalAuthId, clerkOrgId),
    });

    if (!org) {
      // Use upsert to handle race conditions (multiple requests trying to create same org)
      await db
        .insert(organizations)
        .values({
          externalAuthId: clerkOrgId,
          name: firstClerkMembership.organization.name,
          slug: firstClerkMembership.organization.slug || clerkOrgId,
          roles: [], // Empty roles = pending role selection during onboarding
        })
        .onConflictDoNothing({ target: organizations.externalAuthId });

      // Re-fetch the org (either we created it or it was created by a concurrent request)
      org = await db.query.organizations.findFirst({
        where: eq(organizations.externalAuthId, clerkOrgId),
      });

      if (!org) {
        throw Errors.internal("Failed to create organization");
      }

      console.log(`Organization created from auth middleware (no org_id): ${clerkOrgId}`);
    }

    // Get organization roles (can be empty if pending role selection)
    const orgRoles = (org.roles as OrganizationRole[]) || [];

    // Determine active role from header, or default to first role (if any)
    let activeRole: OrganizationRole | null = orgRoles[0] || null;
    if (activeRoleHeader && VALID_ROLES.includes(activeRoleHeader)) {
      if (orgRoles.includes(activeRoleHeader)) {
        activeRole = activeRoleHeader;
      }
    }

    // Use membership role from Clerk
    const membershipRole = mapClerkRole(firstClerkMembership.role);

    const authContext: AuthContext = {
      userId: user.id,
      organizationId: org.id,
      clerkOrgId: clerkOrgId,
      organizationRoles: orgRoles,
      activeRole,
      membershipRole,
    };

    c.set("auth", authContext);
  }

  await next();
});

// Middleware to require supplier role
// Checks that the organization has supplier role AND the active role is supplier
export const requireSupplier = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authContext = c.get("auth");

  if (!authContext) {
    throw Errors.unauthorized();
  }

  if (!authContext.organizationRoles.includes("supplier")) {
    throw Errors.forbidden("Supplier access required");
  }

  if (authContext.activeRole !== "supplier") {
    throw Errors.forbidden("Switch to supplier role to access this resource");
  }

  await next();
});

// Middleware to require retailer role
// Checks that the organization has retailer role AND the active role is retailer
export const requireRetailer = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authContext = c.get("auth");

  if (!authContext) {
    throw Errors.unauthorized();
  }

  if (!authContext.organizationRoles.includes("retailer")) {
    throw Errors.forbidden("Retailer access required");
  }

  if (authContext.activeRole !== "retailer") {
    throw Errors.forbidden("Switch to retailer role to access this resource");
  }

  await next();
});

// Middleware to require admin or owner membership role
export const requireAdmin = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authContext = c.get("auth");

  if (!authContext) {
    throw Errors.unauthorized();
  }

  if (authContext.membershipRole !== "admin" && authContext.membershipRole !== "owner") {
    throw Errors.forbidden("Admin access required");
  }

  await next();
});

/**
 * Middleware stub for retailer pro features.
 * Billing checks have been removed -- all retailers have access.
 */
export const requireRetailerPro = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (_c, next) => {
  await next();
});

/**
 * Middleware stub for webhooks feature.
 * Billing checks have been removed -- all users have access to webhooks.
 */
export const requireWebhooks = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (_c, next) => {
  await next();
});
