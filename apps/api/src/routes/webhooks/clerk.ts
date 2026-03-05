import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { Webhook } from "svix";
import { users } from "@workspace/db";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Clerk Webhook Handler
 *
 * Handles ONLY user events for maintaining minimal user table (needed for FK references).
 *
 * Organization and membership events are handled by the platform:
 * - organization.created/updated/deleted → Platform handles via its own Clerk webhook
 * - organizationMembership.* → Use Clerk SDK for membership data
 */

interface ClerkUserEvent {
  id: string;
  email_addresses: Array<{
    id: string;
    email_address: string;
  }>;
  primary_email_address_id: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserEvent;
}

app.post("/", async (c) => {
  const db = c.get("db");

  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw Errors.unauthorized("Missing webhook headers");
  }

  const body = await c.req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(c.env.CLERK_WEBHOOK_SECRET);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    throw Errors.unauthorized("Invalid webhook signature");
  }

  switch (event.type) {
    case "user.created": {
      const data = event.data;
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      );

      if (!primaryEmail) {
        console.error("User created without primary email:", data.id);
        break;
      }

      // Create minimal user record for FK references
      await db.insert(users).values({
        externalAuthId: data.id,
        email: primaryEmail.email_address,
      });

      console.log(`User created: ${data.id}`);
      break;
    }

    case "user.updated": {
      const data = event.data;
      const primaryEmail = data.email_addresses.find(
        (e) => e.id === data.primary_email_address_id
      );

      if (!primaryEmail) {
        console.error("User updated without primary email:", data.id);
        break;
      }

      // Only update email (profile data fetched from Clerk SDK)
      await db
        .update(users)
        .set({
          email: primaryEmail.email_address,
          updatedAt: new Date(),
        })
        .where(eq(users.externalAuthId, data.id));

      console.log(`User updated: ${data.id}`);
      break;
    }

    case "user.deleted": {
      const data = event.data;
      await db.delete(users).where(eq(users.externalAuthId, data.id));
      console.log(`User deleted: ${data.id}`);
      break;
    }

    // Organization and membership events handled by platform
    case "organization.created":
    case "organization.updated":
    case "organization.deleted":
    case "organizationMembership.created":
    case "organizationMembership.updated":
    case "organizationMembership.deleted":
      console.log(`Skipping ${event.type} - handled by platform`);
      break;

    default:
      console.log(`Unhandled Clerk event: ${event.type}`);
  }

  return success(c, { received: true });
});

export default app;
