import { task } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { createClerkClient } from "@clerk/backend";
import {
  createDb,
  organizations,
  integrations,
  feeds,
  feedSubscriptions,
  products,
  variants,
} from "@workspace/db";
import type { OrganizationSettings } from "@workspace/db";
import {
  SyncCompletedEmail,
  SyncFailedEmail,
  NewProductsReportEmail,
  type NewProduct,
} from "@workspace/email";
import { render } from "@react-email/components";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "PXM Sync <sync@notifications.pixelmakers.com>";
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const APP_URL = process.env.APP_URL || "https://app.pxm.studio";

interface SyncNotificationPayload {
  organizationId: string;
  feedId: string;
  feedName: string;
  supplierName?: string;
  syncRunId: string;
  status: "completed" | "failed";
  stats: {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  errorMessage?: string;
  topErrors?: Array<{ message: string; count: number }>;
  duration: string;
  syncedAt: string;
  // New product IDs for the new products report
  newProductIds?: string[];
}

/**
 * Send sync notification emails based on user preferences
 */
export const sendSyncNotification = task({
  id: "notification-sync",
  run: async (payload: SyncNotificationPayload) => {
    if (!RESEND_API_KEY || !CLERK_SECRET_KEY) {
      console.error("Missing RESEND_API_KEY or CLERK_SECRET_KEY");
      return { error: "Missing configuration", sent: [] };
    }

    const db = createDb(process.env.DATABASE_URL!);
    const resend = new Resend(RESEND_API_KEY);
    const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

    // Get organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, payload.organizationId),
    });

    if (!org) {
      console.error(`Organization not found: ${payload.organizationId}`);
      return { error: "Organization not found", sent: [] };
    }

    // Get notification preferences
    const settings = org.settings as OrganizationSettings | undefined;
    const notifications = settings?.notifications || {};

    const results: string[] = [];

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
      console.log(`No recipients found for org ${org.name}`);
      return { error: "No recipients", sent: [] };
    }

    // Send Sync Completed email
    if (payload.status === "completed" && notifications.syncCompleted) {
      try {
        const emailHtml = await render(
          SyncCompletedEmail({
            organizationName: org.name,
            feedName: payload.feedName,
            supplierName: payload.supplierName,
            syncedAt: payload.syncedAt,
            duration: payload.duration,
            stats: payload.stats,
            activityUrl: `${APP_URL}/activity`,
          })
        );

        await Promise.all(
          recipients.map((r) =>
            resend.emails.send({
              from: RESEND_FROM_EMAIL,
              to: r.email,
              subject: `Sync Complete: ${payload.feedName}`,
              html: emailHtml,
            })
          )
        );

        results.push("syncCompleted");
        console.log(`Sent sync completed email to ${recipients.length} recipients`);
      } catch (error) {
        console.error("Failed to send sync completed email:", error);
      }
    }

    // Send Sync Failed email
    if (payload.status === "failed" && notifications.syncFailed) {
      try {
        const emailHtml = await render(
          SyncFailedEmail({
            organizationName: org.name,
            feedName: payload.feedName,
            supplierName: payload.supplierName,
            failedAt: payload.syncedAt,
            errorMessage: payload.errorMessage || "Sync encountered errors",
            stats: {
              processed: payload.stats.processed,
              failed: payload.stats.failed,
            },
            topErrors: payload.topErrors,
            activityUrl: `${APP_URL}/activity`,
          })
        );

        await Promise.all(
          recipients.map((r) =>
            resend.emails.send({
              from: RESEND_FROM_EMAIL,
              to: r.email,
              subject: `Sync Failed: ${payload.feedName}`,
              html: emailHtml,
            })
          )
        );

        results.push("syncFailed");
        console.log(`Sent sync failed email to ${recipients.length} recipients`);
      } catch (error) {
        console.error("Failed to send sync failed email:", error);
      }
    }

    // Send New Products email
    if (
      payload.status === "completed" &&
      notifications.newProducts &&
      payload.stats.created > 0 &&
      payload.newProductIds &&
      payload.newProductIds.length > 0
    ) {
      try {
        // Fetch product details for the email
        const newProducts = await db.query.products.findMany({
          where: (products, { inArray }) =>
            inArray(products.id, payload.newProductIds!.slice(0, 10)),
          with: {
            variants: true,
          },
        });

        const productCards: NewProduct[] = newProducts.map((p) => {
          const firstVariant = p.variants?.[0];
          const price = firstVariant?.price
            ? `$${parseFloat(firstVariant.price).toFixed(2)}`
            : "N/A";
          const compareAtPrice = firstVariant?.compareAtPrice
            ? `$${parseFloat(firstVariant.compareAtPrice).toFixed(2)}`
            : undefined;

          return {
            id: p.id,
            title: p.name,
            imageUrl: p.images?.[0]?.url,
            price,
            compareAtPrice,
            variantCount: p.variants?.length || 1,
            productType: p.productType || undefined,
          };
        });

        const emailHtml = await render(
          NewProductsReportEmail({
            organizationName: org.name,
            feedName: payload.feedName,
            supplierName: payload.supplierName,
            syncedAt: payload.syncedAt,
            products: productCards,
            totalCount: payload.stats.created,
            productsUrl: `${APP_URL}/shop`,
          })
        );

        await Promise.all(
          recipients.map((r) =>
            resend.emails.send({
              from: RESEND_FROM_EMAIL,
              to: r.email,
              subject: `${payload.stats.created} New Products from ${payload.feedName}`,
              html: emailHtml,
            })
          )
        );

        results.push("newProducts");
        console.log(`Sent new products email to ${recipients.length} recipients`);
      } catch (error) {
        console.error("Failed to send new products email:", error);
      }
    }

    return {
      sent: results,
      recipientCount: recipients.length,
    };
  },
});

/**
 * Send integration issue notification email
 */
export const sendIntegrationIssueNotification = task({
  id: "notification-integration-issue",
  run: async (payload: {
    organizationId: string;
    integrationId: string;
    integrationName: string;
    storeDomain?: string;
    issueType: "auth_expired" | "auth_revoked" | "api_error" | "rate_limit" | "store_unavailable" | "invalid_credentials" | "scope_missing" | "unknown";
    issueTitle: string;
    issueDescription: string;
    howToFix: string[];
    detectedAt: string;
  }) => {
    if (!RESEND_API_KEY || !CLERK_SECRET_KEY) {
      console.error("Missing RESEND_API_KEY or CLERK_SECRET_KEY");
      return { error: "Missing configuration", sent: false };
    }

    const db = createDb(process.env.DATABASE_URL!);
    const resend = new Resend(RESEND_API_KEY);
    const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

    // Get organization
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, payload.organizationId),
    });

    if (!org) {
      console.error(`Organization not found: ${payload.organizationId}`);
      return { error: "Organization not found", sent: false };
    }

    // Check notification preferences
    const settings = org.settings as OrganizationSettings | undefined;
    const notifications = settings?.notifications || {};

    if (!notifications.integrationIssues) {
      return { error: "Integration issue notifications disabled", sent: false };
    }

    // Get organization members
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
      return { error: "No recipients", sent: false };
    }

    try {
      // Import the email template dynamically to avoid circular deps
      const { IntegrationIssueEmail } = await import("@workspace/email");

      const emailHtml = await render(
        IntegrationIssueEmail({
          organizationName: org.name,
          integrationName: payload.integrationName,
          storeDomain: payload.storeDomain,
          issueType: payload.issueType,
          issueTitle: payload.issueTitle,
          issueDescription: payload.issueDescription,
          howToFix: payload.howToFix,
          detectedAt: payload.detectedAt,
          integrationsUrl: `${APP_URL}/settings/integrations`,
        })
      );

      await Promise.all(
        recipients.map((r) =>
          resend.emails.send({
            from: RESEND_FROM_EMAIL,
            to: r.email,
            subject: `Action Required: ${payload.issueTitle}`,
            html: emailHtml,
          })
        )
      );

      console.log(`Sent integration issue email to ${recipients.length} recipients`);
      return { sent: true, recipientCount: recipients.length };
    } catch (error) {
      console.error("Failed to send integration issue email:", error);
      return { error: error instanceof Error ? error.message : "Unknown error", sent: false };
    }
  },
});
