import { eq, and, inArray } from "drizzle-orm";
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
   * pass a deterministic ID (e.g., `order-paid-${orderId}`) so
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
 * This function fires webhooks immediately and does NOT await their completion
 * for near-real-time delivery without blocking the main request.
 *
 * @param options.eventId - Optional stable event ID for deduplication. Use a
 *   deterministic ID (e.g., `order-paid-${orderId}`) when the same business
 *   event might trigger multiple dispatches, so recipients can deduplicate.
 */
export function dispatchWebhooks(
  db: Database,
  organizationId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  options?: DispatchOptions
): void {
  // Create payload with stable eventId if provided, otherwise generate new one
  const payload: WebhookPayload = {
    id: `whd_${crypto.randomUUID().replace(/-/g, "")}`,
    eventId: options?.eventId ?? `evt_${crypto.randomUUID().replace(/-/g, "")}`,
    eventType,
    timestamp: new Date().toISOString(),
    data,
  };

  // Fire and forget - don't await
  (async () => {
    try {
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
        return;
      }

      // Deliver to all matching subscriptions in parallel
      await Promise.allSettled(
        matchingSubscriptions.map((sub) =>
          deliverWebhook(db, sub, payload)
        )
      );
    } catch (err) {
      console.error(`Failed to dispatch webhooks for ${eventType}:`, err);
    }
  })();
}

/**
 * Dispatch webhooks and await completion (for testing or when you need confirmation)
 *
 * @param options.eventId - Optional stable event ID for deduplication.
 */
export async function dispatchWebhooksAsync(
  db: Database,
  organizationId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>,
  options?: DispatchOptions
): Promise<{ delivered: number; failed: number }> {
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
