import { schedules } from "@trigger.dev/sdk";
import { eq, and, gte, sql } from "drizzle-orm";
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
import { WeeklyDigestEmail } from "@workspace/email";
import { render } from "@react-email/components";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "PXM Sync <sync@notifications.pixelmakers.com>";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const APP_URL = process.env.APP_URL || "https://app.pxm.studio";

/**
 * Weekly digest email - runs every Monday at 8:00 AM UTC
 * Sends a weekly summary to organizations with weeklyDigest enabled
 */
export const weeklyDigestEmail = schedules.task({
  id: "digest-weekly-email",
  cron: "0 8 * * 1", // Every Monday at 8:00 AM UTC
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

    // Calculate the period: last 7 days
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setHours(0, 0, 0, 0);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);

    console.log(`Sending weekly digests for period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

    // Get all organizations with weekly digest enabled
    const orgsWithDigest = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        externalAuthId: organizations.externalAuthId,
        settings: organizations.settings,
      })
      .from(organizations)
      .where(
        sql`${organizations.settings}->>'notifications'->>'weeklyDigest' = 'true' OR ${organizations.settings}->'notifications'->>'weeklyDigest' = 'true'`
      );

    console.log(`Found ${orgsWithDigest.length} organizations with weekly digest enabled`);

    const results: Array<{
      organizationId: string;
      organizationName: string;
      sent: boolean;
      recipients: number;
      error?: string;
    }> = [];

    for (const org of orgsWithDigest) {
      try {
        // Get organization's integrations to find their sync runs
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

        // Aggregate sync stats for the period
        const syncStats = await db
          .select({
            totalSynced: sql<number>`COALESCE(SUM(${storeSyncRuns.productsProcessed}), 0)::int`,
            productsCreated: sql<number>`COALESCE(SUM(${storeSyncRuns.productsCreated}), 0)::int`,
            productsUpdated: sql<number>`COALESCE(SUM(${storeSyncRuns.productsUpdated}), 0)::int`,
            productsFailed: sql<number>`COALESCE(SUM(${storeSyncRuns.productsFailed}), 0)::int`,
          })
          .from(storeSyncRuns)
          .where(
            and(
              sql`${storeSyncRuns.integrationId} = ANY(${integrationIds})`,
              gte(storeSyncRuns.startedAt, periodStart),
              eq(storeSyncRuns.status, "completed")
            )
          );

        const stats = syncStats[0] || {
          totalSynced: 0,
          productsCreated: 0,
          productsUpdated: 0,
          productsFailed: 0,
        };

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
              eq(storeSyncRuns.status, "completed")
            )
          )
          .groupBy(storeSyncRuns.feedId, feeds.name)
          .orderBy(sql`SUM(${storeSyncRuns.productsProcessed}) DESC`)
          .limit(3);

        const topFeeds = topFeedsQuery.map((f) => ({
          name: f.feedName || "Unknown Feed",
          productsSynced: f.totalSynced,
          successRate:
            f.totalSynced > 0
              ? parseFloat((((f.totalSynced - f.totalFailed) / f.totalSynced) * 100).toFixed(1))
              : 100,
        }));

        // Get organization members from Clerk
        const { data: memberships } = await clerkClient.organizations.getOrganizationMembershipList({
          organizationId: org.externalAuthId,
        });

        // Get emails from Clerk user data
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

        // Format period strings
        const formatDate = (d: Date) =>
          d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        // Render the email
        const emailHtml = await render(
          WeeklyDigestEmail({
            organizationName: org.name,
            periodStart: formatDate(periodStart),
            periodEnd: formatDate(periodEnd),
            stats: {
              totalSynced: stats.totalSynced,
              productsCreated: stats.productsCreated,
              productsUpdated: stats.productsUpdated,
              productsFailed: stats.productsFailed,
            },
            topFeeds,
            dashboardUrl: `${APP_URL}/dashboard`,
          })
        );

        // Send to all recipients
        const emailPromises = recipients.map((recipient) =>
          resend.emails.send({
            from: RESEND_FROM_EMAIL,
            to: recipient.email,
            subject: `Weekly Sync Report — ${formatDate(periodStart)} to ${formatDate(periodEnd)}`,
            html: emailHtml,
          })
        );

        await Promise.all(emailPromises);

        console.log(`Sent weekly digest to ${recipients.length} recipients for ${org.name}`);
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          sent: true,
          recipients: recipients.length,
        });
      } catch (error) {
        console.error(`Failed to send weekly digest for ${org.name}:`, error);
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
      sent,
      failed,
      totalRecipients,
      results,
    };
  },
});
