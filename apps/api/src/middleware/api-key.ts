import { createMiddleware } from "hono/factory";
import { eq, and, isNull } from "drizzle-orm";
import { apiKeys, feedSubscriptions } from "@workspace/db";
import { Errors } from "../lib/errors.js";
import type { Env, Variables, ApiKeyContext, FeedContext, SingleFeedContext, MultiFeedContext } from "../types.js";

// Hash API key for comparison
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// API key authentication middleware for public API
export const apiKeyAuth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.invalidApiKey();
  }

  const key = authHeader.slice(7);

  // Validate key format (pxm_live_xxx or pxm_test_xxx)
  if (!key.startsWith("pxm_")) {
    throw Errors.invalidApiKey();
  }

  const db = c.get("db");
  const keyHash = await hashApiKey(key);

  // Find API key by hash
  const apiKey = await db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyHash, keyHash),
      isNull(apiKeys.revokedAt)
    ),
  });

  if (!apiKey) {
    throw Errors.invalidApiKey();
  }

  // Check expiration
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw Errors.invalidApiKey();
  }

  // Update last used timestamp (fire and forget)
  const clientIp = c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For");
  db.update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      lastUsedIp: clientIp || null,
    })
    .where(eq(apiKeys.id, apiKey.id))
    .execute()
    .catch(console.error);

  const apiKeyContext: ApiKeyContext = {
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    scopes: apiKey.scopes || [],
  };

  c.set("apiKey", apiKeyContext);

  await next();
});

// Middleware to require specific scopes
export function requireScopes(...requiredScopes: string[]) {
  return createMiddleware<{
    Bindings: Env;
    Variables: Variables;
  }>(async (c, next) => {
    const apiKeyContext = c.get("apiKey");

    if (!apiKeyContext) {
      throw Errors.unauthorized();
    }

    const hasAllScopes = requiredScopes.every((scope) =>
      apiKeyContext.scopes.includes(scope)
    );

    if (!hasAllScopes) {
      throw Errors.insufficientScopes(requiredScopes);
    }

    await next();
  });
}

// Middleware to extract and validate optional feedId query parameter
// If feedId is provided, validates access to that specific feed
// If feedId is omitted, loads all active feed subscriptions for multi-feed queries
export const feedContext = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const feedId = c.req.query("feedId");
  const apiKeyContext = c.get("apiKey");

  if (!apiKeyContext) {
    throw Errors.unauthorized();
  }

  const db = c.get("db");

  if (feedId) {
    // Single feed mode - validate access to specific feed
    const subscription = await db.query.feedSubscriptions.findFirst({
      where: and(
        eq(feedSubscriptions.retailerId, apiKeyContext.organizationId),
        eq(feedSubscriptions.feedId, feedId),
        eq(feedSubscriptions.isActive, true)
      ),
    });

    if (!subscription) {
      throw Errors.forbidden("Not subscribed to this feed");
    }

    const feedCtx: SingleFeedContext = {
      mode: "single",
      feedId: feedId,
      subscriptionId: subscription.id,
      // Legacy aliases for backwards compatibility
      supplierId: feedId,
      connectionId: subscription.id,
    };

    c.set("feed", feedCtx);
    c.set("supplier", feedCtx); // Legacy alias
  } else {
    // Multi-feed mode - load all active subscriptions
    const subscriptions = await db.query.feedSubscriptions.findMany({
      where: and(
        eq(feedSubscriptions.retailerId, apiKeyContext.organizationId),
        eq(feedSubscriptions.isActive, true)
      ),
      columns: {
        id: true,
        feedId: true,
      },
    });

    const feedCtx: MultiFeedContext = {
      mode: "multi",
      subscriptions: subscriptions.map((sub) => ({
        feedId: sub.feedId,
        subscriptionId: sub.id,
      })),
      feedIds: subscriptions.map((sub) => sub.feedId),
      // Legacy aliases for backwards compatibility
      supplierIds: subscriptions.map((sub) => sub.feedId),
      connections: subscriptions.map((sub) => ({
        supplierId: sub.feedId,
        connectionId: sub.id,
      })),
    };

    c.set("feed", feedCtx);
    c.set("supplier", feedCtx); // Legacy alias
  }

  await next();
});

// Middleware that REQUIRES a specific feed (for detail endpoints)
export const requireSingleFeed = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const feed = c.get("feed");

  if (!feed || feed.mode !== "single") {
    throw Errors.badRequest("feedId query parameter is required");
  }

  await next();
});

// Legacy aliases for backwards compatibility during migration
// TODO: Remove these after updating all routes to use feed-based context
export const supplierContext = feedContext;
export const requireSingleSupplier = requireSingleFeed;
