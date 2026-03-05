/**
 * Webhook dispatch utility for trigger tasks
 *
 * This mirrors the webhook dispatch logic from the API package
 * to allow trigger tasks to send webhooks when products change.
 */

import { eq, and } from "drizzle-orm";
import { webhookSubscriptions, webhookLogs } from "@workspace/db";
import type { Database } from "@workspace/db";

// Event types that can trigger webhooks
export type WebhookEventType =
  | "product.created"
  | "product.updated"
  | "product.deleted";

export interface WebhookPayload {
  id: string;
  eventId: string;
  eventType: WebhookEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface DispatchOptions {
  /**
   * Optional stable event ID for deduplication.
   * If the same business event might trigger multiple dispatches,
   * pass a deterministic ID (e.g., `product-created-${productId}`) so
   * recipients can deduplicate on their end.
   */
  eventId?: string;
}

interface WebhookSubscription {
  id: string;
  url: string;
  secretRef: string | null;
  eventTypes: string[];
}

/**
 * Generate HMAC signature for webhook payload
 */
async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deliver a single webhook
 */
async function deliverWebhook(
  db: Database,
  subscription: WebhookSubscription,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode: number | null; responseTimeMs: number; error?: string }> {
  const startTime = Date.now();
  const payloadJson = JSON.stringify(payload);

  let statusCode: number | null = null;
  let success = false;
  let errorMessage: string | null = null;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-ID": payload.id,
      "X-Webhook-Event": payload.eventType,
      "X-Webhook-Timestamp": payload.timestamp,
    };

    // Add signature if secret exists
    if (subscription.secretRef) {
      const signature = await generateSignature(payloadJson, subscription.secretRef);
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(subscription.url, {
      method: "POST",
      headers,
      body: payloadJson,
    });

    statusCode = response.status;
    success = response.ok;

    if (!response.ok) {
      errorMessage = `HTTP ${response.status}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  const responseTimeMs = Date.now() - startTime;

  // Log the delivery attempt
  await db.insert(webhookLogs).values({
    subscriptionId: subscription.id,
    url: subscription.url,
    eventType: payload.eventType,
    payload: payload as unknown as Record<string, unknown>,
    statusCode: statusCode?.toString() || null,
    responseTimeMs: responseTimeMs.toString(),
    success,
    errorMessage,
    attempt: "1",
  });

  // Update failure count on subscription if failed
  if (!success) {
    await db
      .update(webhookSubscriptions)
      .set({
        failureCount: (
          parseInt(
            (
              await db.query.webhookSubscriptions.findFirst({
                where: eq(webhookSubscriptions.id, subscription.id),
                columns: { failureCount: true },
              })
            )?.failureCount || "0"
          ) + 1
        ).toString(),
        lastFailureAt: new Date(),
        lastFailureReason: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(webhookSubscriptions.id, subscription.id));
  }

  return {
    success,
    statusCode,
    responseTimeMs,
    error: errorMessage || undefined,
  };
}

/**
 * Dispatch webhooks for an event to all matching subscribers
 * This function delivers webhooks and awaits completion.
 *
 * @param db - Database connection
 * @param organizationId - The organization whose webhooks to dispatch
 * @param eventType - Type of event (product.created, product.updated, etc.)
 * @param data - Event payload data
 * @param options - Optional settings including eventId for deduplication
 */
export async function dispatchWebhooks(
  db: Database,
  organizationId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  options?: DispatchOptions
): Promise<{ delivered: number; failed: number }> {
  // Create payload with stable eventId if provided, otherwise generate new one
  const payload: WebhookPayload = {
    id: `whd_${crypto.randomUUID().replace(/-/g, "")}`,
    eventId: options?.eventId ?? `evt_${crypto.randomUUID().replace(/-/g, "")}`,
    eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  // Find all active subscriptions for this organization that match the event type
  const subscriptions = await db.query.webhookSubscriptions.findMany({
    where: and(
      eq(webhookSubscriptions.organizationId, organizationId),
      eq(webhookSubscriptions.isActive, true)
    ),
  });

  // Filter subscriptions that include this event type
  const matchingSubscriptions = subscriptions.filter((sub) =>
    sub.eventTypes.includes(eventType)
  );

  if (matchingSubscriptions.length === 0) {
    return { delivered: 0, failed: 0 };
  }

  // Deliver to all matching subscriptions in parallel
  const results = await Promise.allSettled(
    matchingSubscriptions.map((sub) => deliverWebhook(db, sub, payload))
  );

  let delivered = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.success) {
      delivered++;
    } else {
      failed++;
    }
  }

  return { delivered, failed };
}

/**
 * Batch dispatch webhooks for multiple products
 * This is more efficient when syncing many products at once.
 *
 * @param db - Database connection
 * @param organizationId - The organization whose webhooks to dispatch
 * @param events - Array of events to dispatch
 */
export async function dispatchWebhooksBatch(
  db: Database,
  organizationId: string,
  events: Array<{
    eventType: WebhookEventType;
    data: Record<string, unknown>;
    eventId?: string;
  }>
): Promise<{ delivered: number; failed: number }> {
  if (events.length === 0) {
    return { delivered: 0, failed: 0 };
  }

  // Find all active subscriptions for this organization
  const subscriptions = await db.query.webhookSubscriptions.findMany({
    where: and(
      eq(webhookSubscriptions.organizationId, organizationId),
      eq(webhookSubscriptions.isActive, true)
    ),
  });

  if (subscriptions.length === 0) {
    return { delivered: 0, failed: 0 };
  }

  let totalDelivered = 0;
  let totalFailed = 0;

  // Group events by event type for efficient subscription matching
  for (const event of events) {
    const matchingSubscriptions = subscriptions.filter((sub) =>
      sub.eventTypes.includes(event.eventType)
    );

    if (matchingSubscriptions.length === 0) {
      continue;
    }

    const payload: WebhookPayload = {
      id: `whd_${crypto.randomUUID().replace(/-/g, "")}`,
      eventId: event.eventId ?? `evt_${crypto.randomUUID().replace(/-/g, "")}`,
      eventType: event.eventType,
      timestamp: new Date().toISOString(),
      data: event.data,
    };

    const results = await Promise.allSettled(
      matchingSubscriptions.map((sub) => deliverWebhook(db, sub, payload))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.success) {
        totalDelivered++;
      } else {
        totalFailed++;
      }
    }
  }

  return { delivered: totalDelivered, failed: totalFailed };
}
