import { task, schedules } from "@trigger.dev/sdk";
import { eq, and, lt, desc, isNull } from "drizzle-orm";
import { createDb, webhookSubscriptions, webhookLogs } from "@workspace/db";

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MINUTES = [1, 5, 15, 60, 240]; // Exponential backoff

export interface RetryWebhookPayload {
  webhookLogId: string;
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
 * Retry a single failed webhook delivery
 */
export const retryWebhook = task({
  id: "webhook-retry",
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: RetryWebhookPayload) => {
    console.log(`Retrying webhook delivery: ${payload.webhookLogId}`);

    const db = createDb(process.env.DATABASE_URL!);

    // Get the failed webhook log
    const log = await db.query.webhookLogs.findFirst({
      where: eq(webhookLogs.id, payload.webhookLogId),
    });

    if (!log) {
      throw new Error(`Webhook log ${payload.webhookLogId} not found`);
    }

    if (log.success) {
      console.log(`Webhook ${payload.webhookLogId} already succeeded, skipping`);
      return { success: true, skipped: true };
    }

    const currentAttempt = parseInt(log.attempt) + 1;

    if (currentAttempt > MAX_RETRY_ATTEMPTS) {
      console.log(`Webhook ${payload.webhookLogId} exceeded max retry attempts`);
      return { success: false, reason: "Max attempts exceeded" };
    }

    // Get subscription to check if still active and get secret
    const subscription = await db.query.webhookSubscriptions.findFirst({
      where: eq(webhookSubscriptions.id, log.subscriptionId),
    });

    if (!subscription || !subscription.isActive) {
      console.log(`Subscription ${log.subscriptionId} inactive or not found, skipping retry`);
      return { success: false, reason: "Subscription inactive" };
    }

    // Prepare payload
    const webhookPayload = log.payload as Record<string, unknown>;
    const payloadJson = JSON.stringify(webhookPayload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-ID": (webhookPayload.id as string) || log.id,
      "X-Webhook-Event": log.eventType,
      "X-Webhook-Timestamp": (webhookPayload.timestamp as string) || new Date().toISOString(),
      "X-Webhook-Retry": currentAttempt.toString(),
    };

    // Add signature if secret exists
    if (subscription.secretRef) {
      const signature = await generateSignature(payloadJson, subscription.secretRef);
      headers["X-Webhook-Signature"] = `sha256=${signature}`;
    }

    const startTime = Date.now();
    let statusCode: number | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(log.url, {
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

    // Log the retry attempt
    await db.insert(webhookLogs).values({
      subscriptionId: log.subscriptionId,
      eventId: log.eventId,
      url: log.url,
      eventType: log.eventType,
      payload: webhookPayload,
      statusCode: statusCode?.toString() || null,
      responseTimeMs: responseTimeMs.toString(),
      success,
      errorMessage,
      attempt: currentAttempt.toString(),
    });

    if (success) {
      // Reset failure count on success
      await db
        .update(webhookSubscriptions)
        .set({
          failureCount: "0",
          lastFailureAt: null,
          lastFailureReason: null,
          updatedAt: new Date(),
        })
        .where(eq(webhookSubscriptions.id, subscription.id));

      console.log(`Webhook retry succeeded on attempt ${currentAttempt}`);
    } else {
      // Update failure info
      await db
        .update(webhookSubscriptions)
        .set({
          failureCount: (parseInt(subscription.failureCount || "0") + 1).toString(),
          lastFailureAt: new Date(),
          lastFailureReason: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(webhookSubscriptions.id, subscription.id));

      console.log(`Webhook retry failed on attempt ${currentAttempt}: ${errorMessage}`);
    }

    return {
      success,
      attempt: currentAttempt,
      statusCode,
      responseTimeMs,
      error: errorMessage,
    };
  },
});

/**
 * Scheduled task to find and retry failed webhooks
 * Runs every 30 minutes
 */
export const processFailedWebhooks = schedules.task({
  id: "webhook-process-failed",
  cron: "*/30 * * * *", // Every 30 minutes
  maxDuration: 7200, // 2 hours
  run: async () => {
    console.log("Processing failed webhooks...");

    const db = createDb(process.env.DATABASE_URL!);

    // Find recent failed webhook logs that haven't exceeded max retries
    // Look at logs from the last 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failedLogs = await db.query.webhookLogs.findMany({
      where: and(
        eq(webhookLogs.success, false),
        lt(webhookLogs.attempt, MAX_RETRY_ATTEMPTS.toString())
      ),
      orderBy: [desc(webhookLogs.createdAt)],
      limit: 100,
    });

    // Filter to only get the most recent attempt for each subscription+event combo
    const latestBySubscription = new Map<string, typeof failedLogs[0]>();

    for (const log of failedLogs) {
      // Skip if older than cutoff
      if (log.createdAt < cutoffTime) continue;

      const key = `${log.subscriptionId}:${log.eventType}:${(log.payload as Record<string, unknown>)?.eventId || log.id}`;

      if (!latestBySubscription.has(key) || log.createdAt > latestBySubscription.get(key)!.createdAt) {
        latestBySubscription.set(key, log);
      }
    }

    const logsToRetry = Array.from(latestBySubscription.values());

    console.log(`Found ${logsToRetry.length} failed webhooks to retry`);

    // Trigger retry tasks for each
    const results = await Promise.allSettled(
      logsToRetry.map((log) => {
        const attempt = parseInt(log.attempt);
        const delayMinutes = RETRY_DELAY_MINUTES[Math.min(attempt, RETRY_DELAY_MINUTES.length - 1)]!;
        const delayMs = delayMinutes * 60 * 1000;
        const timeSinceFailure = Date.now() - log.createdAt.getTime();

        // Only retry if enough time has passed since last attempt
        if (timeSinceFailure < delayMs) {
          return Promise.resolve({ skipped: true, reason: "Not enough time since last attempt" });
        }

        return retryWebhook.trigger({ webhookLogId: log.id });
      })
    );

    const triggered = results.filter(
      (r) => r.status === "fulfilled" && !(r.value as { skipped?: boolean })?.skipped
    ).length;

    console.log(`Triggered ${triggered} webhook retries`);

    return { processed: logsToRetry.length, triggered };
  },
});
