/**
 * Scheduled sync for store product push
 *
 * This task runs periodically to push products from feed subscriptions
 * to Shopify stores based on their sync settings.
 *
 * IMPORTANT: Feeds are processed SEQUENTIALLY per store to avoid hitting
 * Shopify's API rate limits. Different stores can sync in parallel since
 * they have separate rate limits.
 */

import { schedules, task } from "@trigger.dev/sdk";
import { eq, and, lte, or, isNull, sql, lt } from "drizzle-orm";
import { createDb, feedSubscriptionSyncSettings, feedSubscriptions, integrations, storeSyncRuns, organizations } from "@workspace/db";
import { storePushProducts } from "./push-products.js";
// ============================================
// Sequential Sync per Store
// ============================================

export interface StoreSequentialSyncPayload {
  /** Integration ID (Shopify store) */
  integrationId: string;
  /** Clerk organization ID */
  clerkOrgId: string;
  /** Sync settings IDs to process sequentially */
  syncSettingsIds: string[];
  /** Type of sync */
  syncType: "full" | "incremental";
}

/**
 * Process multiple feeds sequentially for a single store.
 * This prevents overwhelming Shopify's API rate limits when an organization
 * has many feeds syncing to the same store.
 */
export const storeSequentialSync = task({
  id: "store-sequential-sync",
  // Allow up to 2 hours for stores with many feeds
  maxDuration: 7200,
  run: async (payload: StoreSequentialSyncPayload) => {
    const { integrationId, clerkOrgId, syncSettingsIds, syncType } = payload;

    console.log(
      `[Sequential] Starting sequential sync for integration ${integrationId} with ${syncSettingsIds.length} feeds`
    );

    const results: Array<{
      syncSettingsId: string;
      success: boolean;
      runId?: string;
      error?: string;
      created?: number;
      updated?: number;
      failed?: number;
    }> = [];

    // Process each feed sequentially
    for (let i = 0; i < syncSettingsIds.length; i++) {
      const syncSettingsId = syncSettingsIds[i]!;

      console.log(
        `[Sequential] Processing feed ${i + 1}/${syncSettingsIds.length}: ${syncSettingsId}`
      );

      try {
        // Trigger and WAIT for completion using triggerAndWait
        // Use concurrencyKey per integration to prevent parallel syncs to the same store
        const result = await storePushProducts.triggerAndWait(
          {
            syncSettingsId,
            syncType,
            triggeredBy: "schedule",
          },
          {
            concurrencyKey: integrationId,
          }
        );

        if (result.ok) {
          const output = result.output as {
            created?: number;
            updated?: number;
            failed?: number;
          };
          results.push({
            syncSettingsId,
            success: true,
            runId: result.id,
            created: output.created,
            updated: output.updated,
            failed: output.failed,
          });
          console.log(
            `[Sequential] Feed ${syncSettingsId} completed: created=${output.created}, updated=${output.updated}, failed=${output.failed}`
          );
        } else {
          results.push({
            syncSettingsId,
            success: false,
            runId: result.id,
            error: "Task failed",
          });
          console.error(`[Sequential] Feed ${syncSettingsId} failed`);
        }

        // Small delay between feeds to let rate limits recover
        if (i < syncSettingsIds.length - 1) {
          console.log(`[Sequential] Waiting 5s before next feed...`);
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`[Sequential] Error syncing feed ${syncSettingsId}:`, error);
        results.push({
          syncSettingsId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalCreated = results.reduce((sum, r) => sum + (r.created || 0), 0);
    const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);
    const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0), 0);

    console.log(
      `[Sequential] Completed for integration ${integrationId}: ${successful}/${syncSettingsIds.length} feeds succeeded, ${totalCreated} created, ${totalUpdated} updated, ${totalFailed} product failures`
    );

    return {
      integrationId,
      feedsProcessed: syncSettingsIds.length,
      feedsSucceeded: successful,
      feedsFailed: failed,
      totalCreated,
      totalUpdated,
      totalProductsFailed: totalFailed,
      results,
    };
  },
});

/**
 * Hourly store sync - runs at the start of every hour
 *
 * Groups feeds by store (integration) and processes them SEQUENTIALLY to avoid
 * overwhelming Shopify's API rate limits. Different stores sync in parallel.
 *
 */
export const hourlyStoreSync = schedules.task({
  id: "store-hourly-sync",
  cron: "0 * * * *", // Every hour at minute 0
  run: async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const now = new Date();

    console.log("Starting hourly store sync check...");

    // Get all active sync settings
    const allSettings = await db
      .select({
        id: feedSubscriptionSyncSettings.id,
        subscriptionId: feedSubscriptionSyncSettings.subscriptionId,
        integrationId: feedSubscriptionSyncSettings.integrationId,
        syncIntervalHours: feedSubscriptionSyncSettings.syncIntervalHours,
        lastSyncAt: feedSubscriptionSyncSettings.lastSyncAt,
        organizationId: integrations.organizationId,
        clerkOrgId: organizations.externalAuthId,
      })
      .from(feedSubscriptionSyncSettings)
      .innerJoin(
        feedSubscriptions,
        eq(feedSubscriptionSyncSettings.subscriptionId, feedSubscriptions.id)
      )
      .innerJoin(
        integrations,
        eq(feedSubscriptionSyncSettings.integrationId, integrations.id)
      )
      .innerJoin(
        organizations,
        eq(integrations.organizationId, organizations.id)
      )
      .where(
        and(
          eq(feedSubscriptionSyncSettings.syncEnabled, "true"),
          eq(feedSubscriptions.isActive, true),
          eq(integrations.isActive, "true")
        )
      );

    console.log(`Found ${allSettings.length} active sync settings`);

    // Filter settings that are due for sync
    const settingsDue = allSettings.filter((settings) => {
      const intervalHours = parseInt(settings.syncIntervalHours || "24", 10);
      const lastSync = settings.lastSyncAt;

      if (lastSync) {
        const hoursSinceLastSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastSync < intervalHours) {
          return false; // Not due yet
        }
      }
      return true;
    });

    console.log(`${settingsDue.length} sync settings are due for sync`);

    if (settingsDue.length === 0) {
      return {
        storesProcessed: 0,
        feedsScheduled: 0,
        message: "No feeds due for sync",
      };
    }

    // Group settings by integration (store) - feeds for the same store will sync sequentially
    const byIntegration = new Map<string, typeof settingsDue>();
    for (const settings of settingsDue) {
      const existing = byIntegration.get(settings.integrationId) || [];
      existing.push(settings);
      byIntegration.set(settings.integrationId, existing);
    }

    console.log(`Grouped into ${byIntegration.size} stores`);

    const results: Array<{
      integrationId: string;
      feedCount: number;
      triggered: boolean;
      runId?: string;
      error?: string;
    }> = [];

    // Trigger one sequential sync per store (stores can run in parallel)
    for (const [integrationId, settings] of byIntegration) {
      const firstSetting = settings[0]!;

      try {
        console.log(
          `Triggering sequential sync for store ${integrationId} with ${settings.length} feeds`
        );

        // Trigger sequential sync for this store
        const handle = await storeSequentialSync.trigger(
          {
            integrationId,
            clerkOrgId: firstSetting.clerkOrgId,
            syncSettingsIds: settings.map((s) => s.id),
            syncType: "incremental",
          },
        );

        results.push({
          integrationId,
          feedCount: settings.length,
          triggered: true,
          runId: handle.id,
        });
      } catch (error) {
        console.error(`Failed to trigger sync for store ${integrationId}:`, error);

        results.push({
          integrationId,
          feedCount: settings.length,
          triggered: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const storesTriggered = results.filter((r) => r.triggered).length;
    const totalFeeds = results.reduce((sum, r) => sum + r.feedCount, 0);

    return {
      storesProcessed: byIntegration.size,
      storesTriggered,
      storesFailed: results.filter((r) => !r.triggered).length,
      feedsScheduled: totalFeeds,
      results,
    };
  },
});

/**
 * Manual trigger sync - trigger sync for a specific subscription
 */
export interface StoreTriggerSyncPayload {
  syncSettingsId: string;
  syncType: "full" | "incremental";
  productIds?: string[];
  triggeredByUserId?: string;
  clerkOrgId?: string;
}

export const triggerStoreSync = task({
  id: "store-trigger-sync",
  run: async (payload: StoreTriggerSyncPayload) => {
    console.log(`Manual sync triggered for settings ${payload.syncSettingsId}`);

    const db = createDb(process.env.DATABASE_URL!);

    // Get sync settings to find the integrationId for queue
    const syncSettings = await db.query.feedSubscriptionSyncSettings.findFirst({
      where: eq(feedSubscriptionSyncSettings.id, payload.syncSettingsId),
      columns: { integrationId: true },
    });

    if (!syncSettings) {
      throw new Error(`Sync settings not found: ${payload.syncSettingsId}`);
    }

    // Use concurrencyKey per integration to prevent concurrent syncs to the same Shopify store
    const handle = await storePushProducts.trigger(
      {
        syncSettingsId: payload.syncSettingsId,
        syncType: payload.syncType,
        productIds: payload.productIds,
        triggeredBy: "manual",
        triggeredByUserId: payload.triggeredByUserId,
      },
      {
        concurrencyKey: syncSettings.integrationId,
      }
    );

    return {
      syncSettingsId: payload.syncSettingsId,
      runId: handle.id,
      message: "Sync triggered successfully",
    };
  },
});

/**
 * Batch sync - trigger sync for multiple subscriptions at once
 */
export interface BatchStoreSyncPayload {
  syncSettingsIds: string[];
  syncType: "full" | "incremental";
  triggeredByUserId?: string;
  clerkOrgId?: string;
}

export const batchStoreSync = task({
  id: "store-batch-sync",
  run: async (payload: BatchStoreSyncPayload) => {
    const { syncSettingsIds, syncType, triggeredByUserId, clerkOrgId } = payload;
    const results = [];

    const db = createDb(process.env.DATABASE_URL!);

    // Fetch all sync settings to get their integrationIds for queue
    const allSettings = await db.query.feedSubscriptionSyncSettings.findMany({
      where: sql`${feedSubscriptionSyncSettings.id} IN (${sql.raw(syncSettingsIds.map(id => `'${id}'`).join(', '))})`,
      columns: { id: true, integrationId: true },
    });

    const settingsMap = new Map(allSettings.map(s => [s.id, s.integrationId]));

    for (const syncSettingsId of syncSettingsIds) {
      try {
        const integrationId = settingsMap.get(syncSettingsId);
        if (!integrationId) {
          results.push({
            syncSettingsId,
            triggered: false,
            error: "Sync settings not found",
          });
          continue;
        }

        // Use concurrencyKey per integration to prevent concurrent syncs to the same Shopify store
        const handle = await storePushProducts.trigger(
          {
            syncSettingsId,
            syncType,
            triggeredBy: "manual",
            triggeredByUserId,
          },
          {
            concurrencyKey: integrationId,
          }
        );

        results.push({
          syncSettingsId,
          triggered: true,
          runId: handle.id,
        });
      } catch (error) {
        results.push({
          syncSettingsId,
          triggered: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      syncTriggered: results.filter((r) => r.triggered).length,
      syncFailed: results.filter((r) => !r.triggered).length,
      results,
    };
  },
});

// ============================================
// Cleanup Tasks
// ============================================

/**
 * Cleanup stale running sync tasks
 *
 * Marks sync runs that have been "running" for more than 1 hour as "failed".
 * This handles cases where:
 * - The worker crashed mid-sync
 * - The task timed out without proper cleanup
 * - Network issues caused the task to hang
 *
 * Runs every 15 minutes.
 */
export const cleanupStaleSyncRuns = schedules.task({
  id: "store-cleanup-stale-runs",
  cron: "*/15 * * * *", // Every 15 minutes
  run: async () => {
    const db = createDb(process.env.DATABASE_URL!);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    console.log("Checking for stale running sync tasks...");

    // Find all sync runs that are still "running" but started more than 1 hour ago
    const staleRuns = await db
      .select({
        id: storeSyncRuns.id,
        syncSettingsId: storeSyncRuns.syncSettingsId,
        startedAt: storeSyncRuns.startedAt,
        triggerRunId: storeSyncRuns.triggerRunId,
      })
      .from(storeSyncRuns)
      .where(
        and(
          eq(storeSyncRuns.status, "running"),
          lt(storeSyncRuns.startedAt, oneHourAgo)
        )
      );

    if (staleRuns.length === 0) {
      console.log("No stale sync runs found");
      return { cleaned: 0 };
    }

    console.log(`Found ${staleRuns.length} stale sync runs, marking as failed...`);

    // Mark each stale run as failed
    for (const run of staleRuns) {
      const runDuration = Math.round((now.getTime() - run.startedAt.getTime()) / 1000 / 60);

      await db
        .update(storeSyncRuns)
        .set({
          status: "failed",
          completedAt: now,
          errorMessage: `Task timed out after ${runDuration} minutes. The sync may have been interrupted or the worker crashed.`,
        })
        .where(eq(storeSyncRuns.id, run.id));

      console.log(`Marked sync run ${run.id} as failed (was running for ${runDuration} minutes)`);
    }

    return {
      cleaned: staleRuns.length,
      staleRunIds: staleRuns.map((r) => r.id),
    };
  },
});
