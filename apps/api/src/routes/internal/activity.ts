import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  storeSyncRuns,
  feeds,
  integrations,
  feedSubscriptions,
} from "@workspace/db";
import { success, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// List sync runs (activity log)
// ============================================

const listQuerySchema = z.object({
  subscriptionId: z.string().optional(),
  integrationId: z.string().optional(),
  feedId: z.string().optional(),
  status: z
    .enum(["pending", "running", "completed", "failed", "partial"])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

app.get("/", zValidator("query", listQuerySchema), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const { subscriptionId, integrationId, feedId, status, page, limit } =
    c.req.valid("query");

  const offset = (page - 1) * limit;

  // Build conditions
  const conditions = [];

  // Filter by organization's integrations
  const orgIntegrations = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(eq(integrations.organizationId, auth.organizationId));

  const orgIntegrationIds = orgIntegrations.map((i) => i.id);

  if (orgIntegrationIds.length === 0) {
    return paginated(c, [], { page, limit, total: 0 });
  }

  conditions.push(inArray(storeSyncRuns.integrationId, orgIntegrationIds));

  if (subscriptionId) {
    conditions.push(eq(storeSyncRuns.subscriptionId, subscriptionId));
  }

  if (integrationId) {
    conditions.push(eq(storeSyncRuns.integrationId, integrationId));
  }

  if (feedId) {
    conditions.push(eq(storeSyncRuns.feedId, feedId));
  }

  if (status) {
    conditions.push(eq(storeSyncRuns.status, status));
  }

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(storeSyncRuns)
    .where(and(...conditions));

  const total = countResult[0]?.count ?? 0;

  // Get sync runs with related data
  const runs = await db
    .select({
      id: storeSyncRuns.id,
      syncType: storeSyncRuns.syncType,
      status: storeSyncRuns.status,
      startedAt: storeSyncRuns.startedAt,
      completedAt: storeSyncRuns.completedAt,
      productsProcessed: storeSyncRuns.productsProcessed,
      productsCreated: storeSyncRuns.productsCreated,
      productsUpdated: storeSyncRuns.productsUpdated,
      productsSkipped: storeSyncRuns.productsSkipped,
      productsFailed: storeSyncRuns.productsFailed,
      errorMessage: storeSyncRuns.errorMessage,
      triggeredBy: storeSyncRuns.triggeredBy,
      createdAt: storeSyncRuns.createdAt,
      feedId: storeSyncRuns.feedId,
      integrationId: storeSyncRuns.integrationId,
      subscriptionId: storeSyncRuns.subscriptionId,
      changeBreakdown: storeSyncRuns.changeBreakdown,
    })
    .from(storeSyncRuns)
    .where(and(...conditions))
    .orderBy(desc(storeSyncRuns.startedAt))
    .limit(limit)
    .offset(offset);

  // Get feed and integration names
  const feedIds = [...new Set(runs.map((r) => r.feedId))];
  const integrationIds = [...new Set(runs.map((r) => r.integrationId))];

  const feedsData =
    feedIds.length > 0
      ? await db
          .select({ id: feeds.id, name: feeds.name })
          .from(feeds)
          .where(inArray(feeds.id, feedIds))
      : [];

  const integrationsData =
    integrationIds.length > 0
      ? await db
          .select({
            id: integrations.id,
            name: integrations.name,
            shopDomain: integrations.externalIdentifier,
          })
          .from(integrations)
          .where(inArray(integrations.id, integrationIds))
      : [];

  const feedsMap = new Map(feedsData.map((f) => [f.id, f]));
  const integrationsMap = new Map(integrationsData.map((i) => [i.id, i]));

  // Format response
  const formattedRuns = runs.map((run) => {
    const feed = feedsMap.get(run.feedId);
    const integration = integrationsMap.get(run.integrationId);

    const duration =
      run.completedAt && run.startedAt
        ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
        : null;

    return {
      id: run.id,
      feed: feed
        ? { id: feed.id, name: feed.name }
        : { id: run.feedId, name: "Unknown" },
      integration: integration
        ? {
            id: integration.id,
            name: integration.name,
            shopDomain: integration.shopDomain,
          }
        : { id: run.integrationId, name: "Unknown", shopDomain: null },
      syncType: run.syncType,
      status: run.status,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      duration,
      productsCreated: run.productsCreated,
      productsUpdated: run.productsUpdated,
      productsSkipped: run.productsSkipped,
      productsFailed: run.productsFailed,
      errorMessage: run.errorMessage,
      triggeredBy: run.triggeredBy,
      changeBreakdown: run.changeBreakdown,
    };
  });

  return paginated(c, formattedRuns, { page, limit, total });
});

// ============================================
// Get single sync run details
// ============================================

app.get("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const runId = c.req.param("id");

  // Get sync run
  const run = await db.query.storeSyncRuns.findFirst({
    where: eq(storeSyncRuns.id, runId),
    with: {
      feed: {
        columns: { id: true, name: true },
      },
      integration: {
        columns: { id: true, name: true, externalIdentifier: true, organizationId: true },
      },
      subscription: {
        columns: { id: true },
      },
    },
  });

  if (!run) {
    throw Errors.notFound("Sync run");
  }

  // Verify access (must belong to user's organization)
  if (run.integration.organizationId !== auth.organizationId) {
    throw Errors.forbidden();
  }

  const duration =
    run.completedAt && run.startedAt
      ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
      : null;

  return success(c, {
    id: run.id,
    feed: { id: run.feed.id, name: run.feed.name },
    integration: {
      id: run.integration.id,
      name: run.integration.name,
      shopDomain: run.integration.externalIdentifier,
    },
    syncType: run.syncType,
    status: run.status,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    duration,
    productsProcessed: run.productsProcessed,
    productsCreated: run.productsCreated,
    productsUpdated: run.productsUpdated,
    productsSkipped: run.productsSkipped,
    productsFailed: run.productsFailed,
    errorMessage: run.errorMessage,
    errors: run.errors ?? [],
    triggeredBy: run.triggeredBy,
    triggeredByUserId: run.triggeredByUserId,
    triggerRunId: run.triggerRunId,
    changeBreakdown: run.changeBreakdown,
  });
});

// ============================================
// Get available filters (feeds and integrations)
// ============================================

app.get("/filters/options", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  // Get organization's integrations
  const orgIntegrations = await db
    .select({
      id: integrations.id,
      name: integrations.name,
      shopDomain: integrations.externalIdentifier,
    })
    .from(integrations)
    .where(eq(integrations.organizationId, auth.organizationId));

  // Get feeds from subscriptions
  const subscriptions = await db
    .select({
      feedId: feedSubscriptions.feedId,
    })
    .from(feedSubscriptions)
    .where(eq(feedSubscriptions.retailerId, auth.organizationId));

  const feedIds = [...new Set(subscriptions.map((s) => s.feedId))];

  const feedsData =
    feedIds.length > 0
      ? await db
          .select({ id: feeds.id, name: feeds.name })
          .from(feeds)
          .where(inArray(feeds.id, feedIds))
      : [];

  return success(c, {
    integrations: orgIntegrations.map((i) => ({
      id: i.id,
      name: i.name ?? i.shopDomain ?? "Unknown",
    })),
    feeds: feedsData.map((f) => ({
      id: f.id,
      name: f.name,
    })),
    statuses: [
      { id: "completed", name: "Completed" },
      { id: "partial", name: "Partial" },
      { id: "failed", name: "Failed" },
      { id: "running", name: "Running" },
      { id: "pending", name: "Pending" },
    ],
  });
});

export default app;
