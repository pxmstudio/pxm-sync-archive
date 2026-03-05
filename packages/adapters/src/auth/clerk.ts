/**
 * Clerk Auth Adapter
 *
 * Implementation of AuthAdapter for Clerk authentication provider.
 */

import { createClerkClient, verifyToken } from "@clerk/backend";
import type {
  AuthAdapter,
  AuthSession,
  AuthUser,
  AuthWebhookEvent,
  AuthWebhookEventType,
  OrganizationRole,
} from "./types.js";

export interface ClerkAdapterConfig {
  /** Clerk secret key */
  secretKey: string;

  /** Clerk publishable key */
  publishableKey: string;

  /** Webhook signing secret (for verifying webhooks) */
  webhookSecret?: string;
}

export class ClerkAuthAdapter implements AuthAdapter {
  private client: ReturnType<typeof createClerkClient>;
  private config: ClerkAdapterConfig;

  constructor(config: ClerkAdapterConfig) {
    this.config = config;
    this.client = createClerkClient({
      secretKey: config.secretKey,
      publishableKey: config.publishableKey,
    });
  }

  async verifySession(request: Request): Promise<AuthSession | null> {
    try {
      // Get the session token from Authorization header
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return null;
      }

      const token = authHeader.slice(7);

      // Verify the token
      const payload = await verifyToken(token, {
        secretKey: this.config.secretKey,
      });

      if (!payload.sub) {
        return null;
      }

      // Get user details
      const user = await this.client.users.getUser(payload.sub);
      if (!user) {
        return null;
      }

      // Get organization context if present
      let organization = null;
      let organizationRole: OrganizationRole | null = null;

      if (payload.org_id) {
        const org = await this.client.organizations.getOrganization({
          organizationId: payload.org_id,
        });

        if (org) {
          organization = {
            id: org.id,
            name: org.name,
            slug: org.slug || org.id,
            logoUrl: org.imageUrl,
            metadata: org.publicMetadata as Record<string, unknown>,
          };

          // Get membership to determine role
          const memberships =
            await this.client.organizations.getOrganizationMembershipList({
              organizationId: payload.org_id,
            });

          const membership = memberships.data.find(
            (m) => m.publicUserData?.userId === user.id
          );

          if (membership) {
            organizationRole = this.mapClerkRole(membership.role);
          }
        }
      }

      return {
        user: this.mapClerkUser(user),
        organization,
        organizationRole,
        sessionId: payload.sid || "",
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      };
    } catch (error) {
      console.error("Failed to verify Clerk session:", error);
      return null;
    }
  }

  async getUser(externalId: string): Promise<AuthUser | null> {
    try {
      const user = await this.client.users.getUser(externalId);
      return user ? this.mapClerkUser(user) : null;
    } catch (error) {
      console.error("Failed to get Clerk user:", error);
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    try {
      const users = await this.client.users.getUserList({
        emailAddress: [email],
      });

      const user = users.data[0];
      if (!user) {
        return null;
      }

      return this.mapClerkUser(user);
    } catch (error) {
      console.error("Failed to get Clerk user by email:", error);
      return null;
    }
  }

  async verifyWebhook(request: Request): Promise<boolean> {
    if (!this.config.webhookSecret) {
      throw new Error("Webhook secret not configured");
    }

    try {
      const { Webhook } = await import("svix");
      const wh = new Webhook(this.config.webhookSecret);

      const body = await request.text();
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        return false;
      }

      wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });

      return true;
    } catch (error) {
      console.error("Failed to verify Clerk webhook:", error);
      return false;
    }
  }

  async parseWebhook(request: Request): Promise<AuthWebhookEvent> {
    const body = await request.json();

    const eventType = this.mapWebhookEventType(body.type);

    const event: AuthWebhookEvent = {
      type: eventType,
      data: {},
      timestamp: new Date(body.timestamp || Date.now()),
    };

    // Map event data based on type
    if (body.type.startsWith("user.")) {
      event.data.user = this.mapClerkUserFromWebhook(body.data);
    } else if (body.type.startsWith("organization.")) {
      event.data.organization = {
        id: body.data.id,
        name: body.data.name,
        slug: body.data.slug || body.data.id,
        logoUrl: body.data.image_url,
        metadata: body.data.public_metadata,
      };
    } else if (body.type.startsWith("organizationMembership.")) {
      event.data.membership = {
        userId: body.data.public_user_data?.user_id,
        organizationId: body.data.organization?.id,
        role: this.mapClerkRole(body.data.role),
      };
    }

    return event;
  }

  // Helper methods

  private mapClerkUser(user: {
    id: string;
    emailAddresses: Array<{ emailAddress: string }>;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string;
    publicMetadata: Record<string, unknown>;
    primaryEmailAddressId: string | null;
  }): AuthUser {
    const primaryEmail = user.emailAddresses[0]?.emailAddress || "";

    return {
      id: user.id,
      externalId: user.id,
      email: primaryEmail,
      name:
        [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
      avatarUrl: user.imageUrl || null,
      emailVerified: true, // Clerk ensures email is verified
      metadata: user.publicMetadata,
    };
  }

  private mapClerkUserFromWebhook(data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    public_metadata: Record<string, unknown>;
  }): AuthUser {
    return {
      id: data.id,
      externalId: data.id,
      email: data.email_addresses[0]?.email_address || "",
      name:
        [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
      avatarUrl: data.image_url,
      emailVerified: true,
      metadata: data.public_metadata,
    };
  }

  private mapClerkRole(role: string): OrganizationRole {
    switch (role) {
      case "org:admin":
        return "admin";
      case "org:member":
        return "member";
      default:
        // Handle custom roles - check if it includes admin
        if (role.includes("admin")) {
          return "admin";
        }
        return "member";
    }
  }

  private mapWebhookEventType(clerkType: string): AuthWebhookEventType {
    const mapping: Record<string, AuthWebhookEventType> = {
      "user.created": "user.created",
      "user.updated": "user.updated",
      "user.deleted": "user.deleted",
      "organization.created": "organization.created",
      "organization.updated": "organization.updated",
      "organization.deleted": "organization.deleted",
      "organizationMembership.created": "organizationMembership.created",
      "organizationMembership.updated": "organizationMembership.updated",
      "organizationMembership.deleted": "organizationMembership.deleted",
    };

    return mapping[clerkType] || ("user.updated" as AuthWebhookEventType);
  }
}
