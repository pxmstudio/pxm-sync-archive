/**
 * Auth Adapter Types
 *
 * Abstraction layer for authentication providers (Clerk, Auth0, etc.)
 * This allows swapping auth providers without changing application code.
 */

export interface AuthUser {
  /** Internal user ID from the auth provider */
  id: string;

  /** External ID used by the auth provider (Clerk ID, Auth0 ID, etc.) */
  externalId: string;

  /** User's email address */
  email: string;

  /** User's display name */
  name: string | null;

  /** URL to user's avatar image */
  avatarUrl: string | null;

  /** Whether the user's email has been verified */
  emailVerified: boolean;

  /** Additional metadata from the provider */
  metadata?: Record<string, unknown>;
}

export interface AuthOrganization {
  /** Organization ID from the auth provider */
  id: string;

  /** Organization name */
  name: string;

  /** Organization slug */
  slug: string;

  /** Organization logo URL */
  logoUrl: string | null;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export type OrganizationRole = "owner" | "admin" | "member";

export interface AuthSession {
  /** The authenticated user */
  user: AuthUser;

  /** Current organization context (if any) */
  organization: AuthOrganization | null;

  /** User's role in the current organization */
  organizationRole: OrganizationRole | null;

  /** Session ID */
  sessionId: string;

  /** Session expiration time */
  expiresAt: Date | null;
}

export interface AuthAdapter {
  /**
   * Verify a session from an incoming request
   * @param request - The incoming HTTP request
   * @returns The authenticated session or null if invalid
   */
  verifySession(request: Request): Promise<AuthSession | null>;

  /**
   * Get a user by their external auth provider ID
   * @param externalId - The ID from the auth provider
   * @returns The user or null if not found
   */
  getUser(externalId: string): Promise<AuthUser | null>;

  /**
   * Get a user by their email address
   * @param email - The user's email
   * @returns The user or null if not found
   */
  getUserByEmail(email: string): Promise<AuthUser | null>;

  /**
   * Verify a webhook signature from the auth provider
   * @param request - The incoming webhook request
   * @returns True if the signature is valid
   */
  verifyWebhook(request: Request): Promise<boolean>;

  /**
   * Parse a webhook payload from the auth provider
   * @param request - The incoming webhook request
   * @returns The parsed webhook event
   */
  parseWebhook(request: Request): Promise<AuthWebhookEvent>;
}

export type AuthWebhookEventType =
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "organization.created"
  | "organization.updated"
  | "organization.deleted"
  | "organizationMembership.created"
  | "organizationMembership.updated"
  | "organizationMembership.deleted";

export interface AuthWebhookEvent {
  /** Event type */
  type: AuthWebhookEventType;

  /** Event data */
  data: {
    /** User data (for user events) */
    user?: AuthUser;

    /** Organization data (for organization events) */
    organization?: AuthOrganization;

    /** Membership data (for membership events) */
    membership?: {
      userId: string;
      organizationId: string;
      role: OrganizationRole;
    };
  };

  /** Event timestamp */
  timestamp: Date;
}
