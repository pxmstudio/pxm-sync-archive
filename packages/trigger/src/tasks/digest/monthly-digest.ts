import { schedules } from "@trigger.dev/sdk";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { Resend } from "resend";
import { createClerkClient } from "@clerk/backend";
import {
  createDb,
  organizations,
  integrations,
  storeSyncRuns,
  feeds,
  feedSubscriptions,
} from "@workspace/db";
import type { OrganizationSettings } from "@workspace/db";
import { MonthlyDigestEmail } from "@workspace/email";
import { render } from "@react-email/components";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "PXM Sync <sync@notifications.pixelmakers.com>";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const APP_URL = process.env.APP_URL || "https://app.pxm.studio";

/**
 * Monthly digest email - runs on the 1st of each month at 9:00 AM UTC
 * Sends a monthly summary to organizations with monthlyDigest enabled
 */
export const monthlyDigestEmail = schedules.task({
  id: "digest-monthly-email",
  cron: "0 9 1 * *", // 1st of each month at 9:00 AM UTC
  run: async () => {
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return { error: "RESEND_API_KEY not configured", sent: 0 };
    }

    if (!CLERK_SECRET_KEY) {
      console.error("CLERK_SECRET_KEY is not configured");
      return { error: "CLERK_SECRET_KEY not configured", sent: 0 };
    }

    const db = createDb(process.env.DATABASE_URL!);
    const resend = new Resend(RESEND_API_KEY);
    const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

    // Calculate the period: last month
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1); // 1st of previous month

    // Also get the period before that for comparison
    const prevPeriodEnd = new Date(periodStart);
    const prevPeriodStart = new Date(prevPeriodEnd);
    prevPeriodStart.setMonth(prevPeriodStart.getMonth() - 1);

    const monthName = periodStart.toLocaleDateString("en-US", { month: "long" });
    const year = periodStart.getFullYear().toString();

    console.log(`Sending monthly digests for ${monthName} ${year}`);

    // Get all organizations with monthly digest enabled
    const orgsWithDigest = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        externalAuthId: organizations.externalAuthId,
        settings: organizations.settings,
      })
      .from(organizations)
      .where(
        sql`${organizations.settings}->>'notifications'->>'monthlyDigest' = 'true' OR ${organizations.settings}->'notifications'->>'monthlyDigest' = 'true'`
      );

    console.log(`Found ${orgsWithDigest.length} organizations with monthly digest enabled`);

    const results: Array<{
      organizationId: string;
      organizationName: string;
      sent: boolean;
      recipients: number;
      error?: string;
    }> = [];

    for (const org of orgsWithDigest) {
      try {
        // Get organization's integrations
        const orgIntegrations = await db
          .select({ id: integrations.id })
          .from(integrations)
          .where(eq(integrations.organizationId, org.id));

        if (orgIntegrations.length === 0) {
          console.log(`Skipping ${org.name} - no integrations`);
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            sent: false,
            recipients: 0,
            error: "No integrations",
          });
          continue;
        }

        const integrationIds = orgIntegrations.map((i) => i.id);

        // Aggregate sync stats for current month
        const currentStats = await db
          .select({
            totalSynced: sql<number>`COALESCE(SUM(${storeSyncRuns.productsProcessed}), 0)::int`,
            productsCreated: sql<number>`COALESCE(SUM(${storeSyncRuns.productsCreated}), 0)::int`,
            productsUpdated: sql<number>`COALESCE(SUM(${storeSyncRuns.productsUpdated}), 0)::int`,
            productsFailed: sql<number>`COALESCE(SUM(${storeSyncRuns.productsFailed}), 0)::int`,
            totalRuns: sql<number>`COUNT(*)::int`,
          })
          .from(storeSyncRuns)
          .where(
            and(
              sql`${storeSyncRuns.integrationId} = ANY(${integrationIds})`,
              gte(storeSyncRuns.startedAt, periodStart),
              lt(storeSyncRuns.startedAt, periodEnd),
              eq(storeSyncRuns.status, "completed")
            )
          );

        // Aggregate sync stats for previous month (for comparison)
        const prevStats = await db
          .select({
            totalSynced: sql<number>`COALESCE(SUM(${storeSyncRuns.productsProcessed}), 0)::int`,
            productsCreated: sql<number>`COALESCE(SUM(${storeSyncRuns.productsCreated}), 0)::int`,
            productsFailed: sql<number>`COALESCE(SUM(${storeSyncRuns.productsFailed}), 0)::int`,
          })
          .from(storeSyncRuns)
          .where(
            and(
              sql`${storeSyncRuns.integrationId} = ANY(${integrationIds})`,
              gte(storeSyncRuns.startedAt, prevPeriodStart),
              lt(storeSyncRuns.startedAt, prevPeriodEnd),
              eq(storeSyncRuns.status, "completed")
            )
          );

        const stats = currentStats[0] || {
          totalSynced: 0,
          productsCreated: 0,
          productsUpdated: 0,
          productsFailed: 0,
          totalRuns: 0,
        };

        const prev = prevStats[0] || {
          totalSynced: 0,
          productsCreated: 0,
          productsFailed: 0,
        };

        // Calculate percentage changes
        const calcChange = (current: number, previous: number): number => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return ((current - previous) / previous) * 100;
        };

        const comparison = {
          syncedChange: calcChange(stats.totalSynced, prev.totalSynced),
          createdChange: calcChange(stats.productsCreated, prev.productsCreated),
          // For failed, negative is good (less failures)
          failedChange: calcChange(stats.productsFailed, prev.productsFailed),
        };

        // Get active feeds count
        const activeFeedsResult = await db
          .select({
            count: sql<number>`COUNT(DISTINCT ${feedSubscriptions.id})::int`,
          })
          .from(feedSubscriptions)
          .where(
            and(
              eq(feedSubscriptions.retailerId, org.id),
              eq(feedSubscriptions.isActive, true)
            )
          );

        const activeFeeds = activeFeedsResult[0]?.count || 0;

        // Calculate average sync time (simplified - based on run count)
        const avgSyncTime = stats.totalRuns > 0 ? `${(stats.totalSynced / stats.totalRuns / 100).toFixed(1)}s` : "N/A";

        // Get top performing feeds
        const topFeedsQuery = await db
          .select({
            feedId: storeSyncRuns.feedId,
            feedName: feeds.name,
            totalSynced: sql<number>`COALESCE(SUM(${storeSyncRuns.productsProcessed}), 0)::int`,
            totalFailed: sql<number>`COALESCE(SUM(${storeSyncRuns.productsFailed}), 0)::int`,
          })
          .from(storeSyncRuns)
          .innerJoin(feeds, eq(storeSyncRuns.feedId, feeds.id))
          .where(
            and(
              sql`${storeSyncRuns.integrationId} = ANY(${integrationIds})`,
              gte(storeSyncRuns.startedAt, periodStart),
              lt(storeSyncRuns.startedAt, periodEnd),
              eq(storeSyncRuns.status, "completed")
            )
          )
          .groupBy(storeSyncRuns.feedId, feeds.name)
          .orderBy(sql`SUM(${storeSyncRuns.productsProcessed}) DESC`)
          .limit(4);

        const topFeeds = topFeedsQuery.map((f) => ({
          name: f.feedName || "Unknown Feed",
          productsSynced: f.totalSynced,
          successRate:
            f.totalSynced > 0
              ? parseFloat((((f.totalSynced - f.totalFailed) / f.totalSynced) * 100).toFixed(1))
              : 100,
        }));

        // Generate insights based on the data
        const insights: string[] = [];

        const successRate = stats.totalSynced > 0
          ? ((stats.totalSynced - stats.productsFailed) / stats.totalSynced) * 100
          : 100;

        const prevSuccessRate = prev.totalSynced > 0
          ? ((prev.totalSynced - prev.productsFailed) / prev.totalSynced) * 100
          : 100;

        const successRateChange = successRate - prevSuccessRate;
        if (successRateChange > 0) {
          insights.push(`Sync success rate improved by ${successRateChange.toFixed(1)}% compared to last month`);
        } else if (successRateChange < -1) {
          insights.push(`Sync success rate decreased by ${Math.abs(successRateChange).toFixed(1)}% — review failed syncs`);
        }

        if (stats.productsCreated > 0) {
          insights.push(`${stats.productsCreated.toLocaleString()} new products were added to your catalog`);
        }

        if (comparison.syncedChange > 20) {
          insights.push(`Total sync volume increased by ${comparison.syncedChange.toFixed(0)}% — great growth!`);
        }

        // Get organization members from Clerk
        const { data: memberships } = await clerkClient.organizations.getOrganizationMembershipList({
          organizationId: org.externalAuthId,
        });

        const recipients: Array<{ email: string; name: string | null }> = [];
        for (const membership of memberships) {
          if (membership.publicUserData?.identifier) {
            recipients.push({
              email: membership.publicUserData.identifier,
              name: [membership.publicUserData.firstName, membership.publicUserData.lastName]
                .filter(Boolean)
                .join(" ") || null,
            });
          }
        }

        if (recipients.length === 0) {
          console.log(`Skipping ${org.name} - no recipients`);
          results.push({
            organizationId: org.id,
            organizationName: org.name,
            sent: false,
            recipients: 0,
            error: "No recipients",
          });
          continue;
        }

        // Render the email
        const emailHtml = await render(
          MonthlyDigestEmail({
            organizationName: org.name,
            month: monthName,
            year,
            stats: {
              totalSynced: stats.totalSynced,
              productsCreated: stats.productsCreated,
              productsUpdated: stats.productsUpdated,
              productsFailed: stats.productsFailed,
              activeFeeds,
              avgSyncTime,
            },
            comparison,
            topFeeds,
            insights: insights.slice(0, 3), // Max 3 insights
            dashboardUrl: `${APP_URL}/dashboard`,
          })
        );

        // Send to all recipients
        const emailPromises = recipients.map((recipient) =>
          resend.emails.send({
            from: RESEND_FROM_EMAIL,
            to: recipient.email,
            subject: `${monthName} Sync Report — ${org.name}`,
            html: emailHtml,
          })
        );

        await Promise.all(emailPromises);

        console.log(`Sent monthly digest to ${recipients.length} recipients for ${org.name}`);
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          sent: true,
          recipients: recipients.length,
        });
      } catch (error) {
        console.error(`Failed to send monthly digest for ${org.name}:`, error);
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          sent: false,
          recipients: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const sent = results.filter((r) => r.sent).length;
    const failed = results.filter((r) => !r.sent).length;
    const totalRecipients = results.reduce((acc, r) => acc + r.recipients, 0);

    return {
      month: monthName,
      year,
      sent,
      failed,
      totalRecipients,
      results,
    };
  },
});
