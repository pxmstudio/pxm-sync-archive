import { task } from "@trigger.dev/sdk";
import { Resend } from "resend";
import { createDb, organizations } from "@workspace/db";
import { eq } from "drizzle-orm";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "PXM Sync <sync@notifications.pixelmakers.com>";
const ADMIN_EMAIL = "mihai@pixelmakers.com";

interface FeedRequestNotificationPayload {
  requestId: string;
  organizationId: string;
  supplierName: string;
  supplierWebsite?: string | null;
  feedUrl?: string | null;
  notes?: string | null;
  credentialsProvided: boolean;
  createdAt: string;
}

/**
 * Send notification to admin when a new feed request is submitted
 */
export const sendFeedRequestNotification = task({
  id: "notification-feed-request",
  run: async (payload: FeedRequestNotificationPayload) => {
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return { error: "Missing configuration", sent: false };
    }

    const db = createDb(process.env.DATABASE_URL!);
    const resend = new Resend(RESEND_API_KEY);

    // Get organization details
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, payload.organizationId),
    });

    const orgName = org?.name || "Unknown Organization";

    // Build email content
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Feed Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">🆕 New Feed Request</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="margin-top: 0;">A new feed request has been submitted:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; width: 140px; color: #6b7280;">Organization</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${orgName}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">Feed Name</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827;">${payload.supplierName}</td>
      </tr>
      ${payload.supplierWebsite ? `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">Website</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><a href="${payload.supplierWebsite}" style="color: #667eea;">${payload.supplierWebsite}</a></td>
      </tr>
      ` : ''}
      ${payload.feedUrl ? `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">Feed URL</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;"><code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-size: 13px; word-break: break-all;">${payload.feedUrl}</code></td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280;">Has Credentials</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${payload.credentialsProvided
            ? '<span style="background: #d1fae5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-size: 13px;">Yes - Contact customer</span>'
            : '<span style="background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px; font-size: 13px;">No</span>'}
        </td>
      </tr>
      ${payload.notes ? `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #6b7280; vertical-align: top;">Notes</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; white-space: pre-wrap;">${payload.notes}</td>
      </tr>
      ` : ''}
      <tr>
        <td style="padding: 12px; font-weight: 600; color: #6b7280;">Submitted</td>
        <td style="padding: 12px; color: #6b7280;">${new Date(payload.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
      </tr>
    </table>

    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">Request ID: <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${payload.requestId}</code></p>
  </div>

  <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
    This is an automated notification from PXM Sync
  </p>
</body>
</html>
    `.trim();

    try {
      await resend.emails.send({
        from: RESEND_FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `🆕 Feed Request: ${payload.supplierName} (from ${orgName})`,
        html: emailHtml,
      });

      console.log(`Sent feed request notification to ${ADMIN_EMAIL}`);
      return { sent: true, recipient: ADMIN_EMAIL };
    } catch (error) {
      console.error("Failed to send feed request notification:", error);
      return { error: error instanceof Error ? error.message : "Unknown error", sent: false };
    }
  },
});
