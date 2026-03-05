import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc } from "drizzle-orm";
import { webhookSubscriptions, webhookLogs } from "@workspace/db";
import {
  createWebhookSubscription,
  updateWebhookSubscription,
} from "@workspace/validators/events";
import { paginationParams } from "@workspace/validators/common";
import { success, paginated } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { requireWebhooks } from "../../middleware/auth.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// All webhook routes require Growth+ tier
app.use("/*", requireWebhooks);

// GET /internal/webhooks - List webhook subscriptions (retailer only)
app.get("/", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");

  const subscriptions = await db.query.webhookSubscriptions.findMany({
    where: eq(webhookSubscriptions.organizationId, auth.organizationId),
    orderBy: [desc(webhookSubscriptions.createdAt)],
  });

  return success(
    c,
    subscriptions.map((s) => ({
      id: s.id,
      url: s.url,
      eventTypes: s.eventTypes,
      isActive: s.isActive,
      failureCount: s.failureCount,
      lastFailureAt: s.lastFailureAt,
      lastFailureReason: s.lastFailureReason,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  );
});

// POST /internal/webhooks - Create webhook subscription (retailer only)
app.post("/", zValidator("json", createWebhookSubscription), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const data = c.req.valid("json");

  // Check for existing subscription with same URL
  const existing = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.organizationId, auth.organizationId),
      eq(webhookSubscriptions.url, data.url)
    ),
  });

  if (existing) {
    throw Errors.alreadyExists("Webhook subscription for this URL");
  }

  // Generate webhook secret
  const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;

  const [subscription] = await db
    .insert(webhookSubscriptions)
    .values({
      organizationId: auth.organizationId,
      url: data.url,
      eventTypes: data.eventTypes,
      secretRef: secret, // TODO: Encrypt with KMS
      isActive: true,
    })
    .returning();

  return success(
    c,
    {
      id: subscription!.id,
      url: subscription!.url,
      eventTypes: subscription!.eventTypes,
      secret, // Only returned on creation!
      isActive: subscription!.isActive,
      createdAt: subscription!.createdAt,
    },
    201
  );
});

// GET /internal/webhooks/:id - Get webhook subscription
app.get("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const subscription = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.id, id),
      eq(webhookSubscriptions.organizationId, auth.organizationId)
    ),
  });

  if (!subscription) {
    throw Errors.notFound("Webhook subscription");
  }

  return success(c, {
    id: subscription.id,
    url: subscription.url,
    eventTypes: subscription.eventTypes,
    isActive: subscription.isActive,
    failureCount: subscription.failureCount,
    lastFailureAt: subscription.lastFailureAt,
    lastFailureReason: subscription.lastFailureReason,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  });
});

// PATCH /internal/webhooks/:id - Update webhook subscription
app.patch("/:id", zValidator("json", updateWebhookSubscription), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");
  const data = c.req.valid("json");

  const subscription = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.id, id),
      eq(webhookSubscriptions.organizationId, auth.organizationId)
    ),
  });

  if (!subscription) {
    throw Errors.notFound("Webhook subscription");
  }

  const [updated] = await db
    .update(webhookSubscriptions)
    .set({
      ...(data.url && { url: data.url }),
      ...(data.eventTypes && { eventTypes: data.eventTypes }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      // Reset failure count if reactivating
      ...(data.isActive === true && {
        failureCount: "0",
        lastFailureAt: null,
        lastFailureReason: null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(webhookSubscriptions.id, id))
    .returning();

  return success(c, {
    id: updated!.id,
    url: updated!.url,
    eventTypes: updated!.eventTypes,
    isActive: updated!.isActive,
    failureCount: updated!.failureCount,
    updatedAt: updated!.updatedAt,
  });
});

// DELETE /internal/webhooks/:id - Delete webhook subscription
app.delete("/:id", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const subscription = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.id, id),
      eq(webhookSubscriptions.organizationId, auth.organizationId)
    ),
  });

  if (!subscription) {
    throw Errors.notFound("Webhook subscription");
  }

  await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, id));

  return c.body(null, 204);
});

// GET /internal/webhooks/:id/deliveries - List webhook deliveries
app.get("/:id/deliveries", zValidator("query", paginationParams), async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");
  const { page, limit } = c.req.valid("query");

  // Verify subscription ownership
  const subscription = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.id, id),
      eq(webhookSubscriptions.organizationId, auth.organizationId)
    ),
  });

  if (!subscription) {
    throw Errors.notFound("Webhook subscription");
  }

  const [deliveries, countResult] = await Promise.all([
    db.query.webhookLogs.findMany({
      where: eq(webhookLogs.subscriptionId, id),
      orderBy: [desc(webhookLogs.createdAt)],
      limit,
      offset: (page - 1) * limit,
    }),
    db
      .select({ count: webhookLogs.id })
      .from(webhookLogs)
      .where(eq(webhookLogs.subscriptionId, id)),
  ]);

  return paginated(
    c,
    deliveries.map((d) => ({
      id: d.id,
      eventType: d.eventType,
      success: d.success,
      statusCode: d.statusCode,
      responseTimeMs: d.responseTimeMs,
      errorMessage: d.errorMessage,
      attempt: d.attempt,
      createdAt: d.createdAt,
    })),
    { page, limit, total: countResult.length }
  );
});

// POST /internal/webhooks/:id/test - Send test webhook
app.post("/:id/test", async (c) => {
  const auth = c.get("auth")!;
  const db = c.get("db");
  const id = c.req.param("id");

  const subscription = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.id, id),
      eq(webhookSubscriptions.organizationId, auth.organizationId)
    ),
  });

  if (!subscription) {
    throw Errors.notFound("Webhook subscription");
  }

  // Create test payload
  const testPayload = {
    id: `test_${crypto.randomUUID()}`,
    eventId: `evt_test_${Date.now()}`,
    eventType: "test.ping",
    timestamp: new Date().toISOString(),
    data: {
      message: "This is a test webhook delivery",
    },
  };

  // Send webhook
  const startTime = Date.now();
  let delivered = false;
  let statusCode: number | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-ID": testPayload.id,
        "X-Webhook-Timestamp": testPayload.timestamp,
        // TODO: Add HMAC signature
      },
      body: JSON.stringify(testPayload),
    });

    statusCode = response.status;
    delivered = response.ok;

    if (!response.ok) {
      errorMessage = `HTTP ${response.status}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  const responseTimeMs = Date.now() - startTime;

  // Log delivery
  await db.insert(webhookLogs).values({
    subscriptionId: id,
    url: subscription.url,
    eventType: "test.ping",
    payload: testPayload,
    statusCode: statusCode?.toString() || null,
    responseTimeMs: responseTimeMs.toString(),
    success: delivered,
    errorMessage,
    attempt: "1",
  });

  return delivered
    ? success(c, {
        delivered: true,
        statusCode,
        responseTimeMs,
      })
    : c.json(
        {
          success: false,
          error: {
            code: "DELIVERY_FAILED",
            message: errorMessage || "Webhook delivery failed",
            details: { statusCode, responseTimeMs },
          },
        },
        400
      );
});

export default app;
