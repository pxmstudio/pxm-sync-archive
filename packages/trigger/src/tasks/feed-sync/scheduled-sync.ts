/**
 * Scheduled sync for feeds (Feed Library)
 *
 * This task runs periodically to sync all active feeds based on their schedule
 */

import { schedules, task } from "@trigger.dev/sdk";
import { eq, and, lte, or, isNull } from "drizzle-orm";
import { createDb, feedSources, feeds } from "@workspace/db";
import { feedSync } from "./sync-feed.js";

export interface ScheduledFeedSyncPayload {
  schedule: "hourly" | "daily" | "weekly";
}

/**
 * Hourly feed sync - runs at the start of every hour
 */
export const hourlyFeedSync = schedules.task({
  id: "feed-hourly-sync",
  cron: "0 * * * *", // Every hour at minute 0
  run: async () => {
    return runScheduledSync("hourly");
  },
});

/**
 * Daily feed sync - runs at 2 AM UTC
 */
export const dailyFeedSync = schedules.task({
  id: "feed-daily-sync",
  cron: "0 2 * * *", // Daily at 2:00 AM UTC
  run: async () => {
    return runScheduledSync("daily");
  },
});

/**
 * Weekly feed sync - runs on Sunday at 3 AM UTC
 */
export const weeklyFeedSync = schedules.task({
  id: "feed-weekly-sync",
  cron: "0 3 * * 0", // Sunday at 3:00 AM UTC
  run: async () => {
    return runScheduledSync("weekly");
  },
});

/**
 * Run sync for all feeds with the specified schedule
 */
async function runScheduledSync(schedule: "hourly" | "daily" | "weekly") {
  const db = createDb(process.env.DATABASE_URL!);

  console.log(`Starting ${schedule} feed sync...`);

  // Get all active feed sources with the matching schedule
  const sourcesToSync = await db
    .select({
      id: feedSources.id,
      feedId: feedSources.feedId,
      schedule: feedSources.schedule,
      feedName: feeds.name,
    })
    .from(feedSources)
    .innerJoin(
      feeds,
      eq(feedSources.feedId, feeds.id)
    )
    .where(
      and(
        eq(feedSources.isActive, true),
        eq(feedSources.schedule, schedule),
        eq(feeds.status, "active")
      )
    );

  console.log(`Found ${sourcesToSync.length} feed sources to sync`);

  // Trigger sync for each feed source
  const results = [];

  for (const source of sourcesToSync) {
    try {
      console.log(`Triggering sync for feed source ${source.id} (${source.feedName})`);

      const handle = await feedSync.trigger({
        feedId: source.id,
        triggeredBy: "schedule",
      });

      results.push({
        feedSourceId: source.id,
        feedName: source.feedName,
        triggered: true,
        runId: handle.id,
      });
    } catch (error) {
      console.error(`Failed to trigger sync for feed source ${source.id}:`, error);

      results.push({
        feedSourceId: source.id,
        feedName: source.feedName,
        triggered: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    schedule,
    feedsTriggered: results.filter((r) => r.triggered).length,
    feedsFailed: results.filter((r) => !r.triggered).length,
    results,
  };
}

/**
 * Manual batch sync - trigger sync for multiple feed sources
 */
export interface BatchSyncPayload {
  feedSourceIds: string[];
  triggeredByUserId: string;
}

export const batchFeedSync = task({
  id: "feed-batch-sync",
  run: async (payload: BatchSyncPayload) => {
    const { feedSourceIds, triggeredByUserId } = payload;
    const results = [];

    for (const feedSourceId of feedSourceIds) {
      try {
        const handle = await feedSync.trigger({
          feedId: feedSourceId,
          triggeredBy: "manual",
          triggeredByUserId,
        });

        results.push({
          feedSourceId,
          triggered: true,
          runId: handle.id,
        });
      } catch (error) {
        results.push({
          feedSourceId,
          triggered: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      feedsTriggered: results.filter((r) => r.triggered).length,
      feedsFailed: results.filter((r) => !r.triggered).length,
      results,
    };
  },
});
