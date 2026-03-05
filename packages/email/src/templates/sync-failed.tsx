import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface SyncFailedEmailProps {
  organizationName: string;
  feedName: string;
  supplierName?: string;
  failedAt: string;
  errorMessage: string;
  stats: {
    processed: number;
    failed: number;
  };
  topErrors?: Array<{
    message: string;
    count: number;
  }>;
  activityUrl: string;
  retryUrl?: string;
  recipientName?: string | null;
}

export function SyncFailedEmail({
  organizationName = "Acme Store",
  feedName = "Premium Suppliers Feed",
  supplierName = "Premium Suppliers Co.",
  failedAt = "Jan 16, 2025 at 2:34 PM",
  errorMessage = "Connection timeout while pushing products to Shopify",
  stats = {
    processed: 847,
    failed: 23,
  },
  topErrors = [
    { message: "Product variant SKU already exists", count: 12 },
    { message: "Image URL not accessible", count: 8 },
    { message: "Invalid price format", count: 3 },
  ],
  activityUrl = "https://app.example.com/activity",
  retryUrl,
  recipientName,
}: SyncFailedEmailProps) {
  const formatNumber = (n: number) => n.toLocaleString("en-US");

  return (
    <Html>
      <Head />
      <Preview>
        Sync failed: {formatNumber(stats.failed)} products failed for {feedName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td>
                  <Text style={logoText}>PXM</Text>
                </td>
                <td align="right">
                  <Text style={tagError}>Sync Failed</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greeting}>
              {recipientName ? `Hi ${recipientName},` : "Hi,"}
            </Text>
            <Text style={subtitle}>
              A sync encountered errors for <strong>{organizationName}</strong>.
            </Text>
          </Section>

          {/* Feed Info */}
          <Section style={feedSection}>
            <Text style={feedName_style}>{feedName}</Text>
            {supplierName && <Text style={supplierText}>from {supplierName}</Text>}
          </Section>

          {/* Error Summary */}
          <Section style={errorSection}>
            <Text style={errorIcon}>!</Text>
            <Text style={errorMessage_style}>{errorMessage}</Text>
          </Section>

          {/* Stats */}
          <Section style={statsSection}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={statCell}>
                  <Text style={statNumber}>{formatNumber(stats.processed)}</Text>
                  <Text style={statLabel}>Processed</Text>
                </td>
                <td style={statCell}>
                  <Text style={statNumberError}>{formatNumber(stats.failed)}</Text>
                  <Text style={statLabel}>Failed</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Top Errors */}
          {topErrors && topErrors.length > 0 && (
            <Section style={errorsListSection}>
              <Text style={errorsTitle}>Error Breakdown</Text>
              <table width="100%" cellPadding={0} cellSpacing={0}>
                {topErrors.slice(0, 5).map((error, index) => (
                  <tr key={index}>
                    <td style={errorRow}>
                      <Text style={errorRowMessage}>{error.message}</Text>
                      <Text style={errorRowCount}>{error.count}×</Text>
                    </td>
                  </tr>
                ))}
              </table>
            </Section>
          )}

          {/* Timestamp */}
          <Section style={timestampSection}>
            <Text style={timestampText}>Failed at {failedAt}</Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={activityUrl} style={ctaButton}>
              View Details
            </Link>
            {retryUrl && (
              <Link href={retryUrl} style={ctaSecondary}>
                Retry Sync
              </Link>
            )}
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because failure notifications are enabled.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${activityUrl.split('/activity')[0]}/settings/notifications`} style={footerLink}>
                Manage notifications
              </Link>
            </Text>
            <Text style={footerBrand}>PXM Sync</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Email-safe font stacks
const fontSans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const fontMono = "'Courier New', Courier, monospace";

const main: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  fontFamily: fontSans,
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 24px",
  backgroundColor: "#ffffff",
};

const header: React.CSSProperties = {
  marginBottom: "32px",
};

const logoText: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  letterSpacing: "0.1em",
  color: "#000000",
  margin: 0,
  textTransform: "uppercase" as const,
};

const tagError: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#b91c1c",
  backgroundColor: "#fef2f2",
  padding: "4px 10px",
  borderRadius: "2px",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const greetingSection: React.CSSProperties = {
  marginBottom: "24px",
};

const greeting: React.CSSProperties = {
  fontSize: "15px",
  color: "#000000",
  margin: "0 0 8px 0",
  fontWeight: 500,
};

const subtitle: React.CSSProperties = {
  fontSize: "15px",
  color: "#666666",
  margin: 0,
  lineHeight: "1.5",
};

const feedSection: React.CSSProperties = {
  marginBottom: "24px",
};

const feedName_style: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "#000000",
  margin: "0 0 4px 0",
};

const supplierText: React.CSSProperties = {
  fontSize: "14px",
  color: "#888888",
  margin: 0,
};

const errorSection: React.CSSProperties = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  padding: "20px",
  marginBottom: "24px",
  textAlign: "center" as const,
};

const errorIcon: React.CSSProperties = {
  display: "inline-block",
  width: "32px",
  height: "32px",
  lineHeight: "32px",
  backgroundColor: "#dc2626",
  color: "#ffffff",
  borderRadius: "50%",
  fontSize: "18px",
  fontWeight: 700,
  margin: "0 0 12px 0",
  textAlign: "center" as const,
};

const errorMessage_style: React.CSSProperties = {
  fontSize: "14px",
  color: "#991b1b",
  margin: 0,
  lineHeight: "1.5",
};

const statsSection: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  padding: "24px",
  marginBottom: "2px",
};

const statCell: React.CSSProperties = {
  textAlign: "center" as const,
  verticalAlign: "top" as const,
  width: "50%",
};

const statNumber: React.CSSProperties = {
  fontSize: "32px",
  fontFamily: fontMono,
  fontWeight: 700,
  color: "#ffffff",
  margin: "0 0 4px 0",
  lineHeight: "1",
};

const statNumberError: React.CSSProperties = {
  ...statNumber,
  color: "#f87171",
};

const statLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  color: "#888888",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const errorsListSection: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "20px 24px",
  marginBottom: "24px",
};

const errorsTitle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#888888",
  margin: "0 0 16px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const errorRow: React.CSSProperties = {
  paddingTop: "10px",
  paddingBottom: "10px",
  borderBottom: "1px solid #eeeeee",
};

const errorRowMessage: React.CSSProperties = {
  fontSize: "13px",
  color: "#333333",
  margin: 0,
  display: "inline-block",
  maxWidth: "80%",
};

const errorRowCount: React.CSSProperties = {
  fontSize: "12px",
  fontFamily: fontMono,
  fontWeight: 600,
  color: "#dc2626",
  margin: 0,
  float: "right" as const,
};

const timestampSection: React.CSSProperties = {
  marginBottom: "24px",
};

const timestampText: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  margin: 0,
  textAlign: "center" as const,
};

const ctaSection: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "32px",
};

const ctaButton: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#dc2626",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: "2px",
  marginRight: "12px",
};

const ctaSecondary: React.CSSProperties = {
  display: "inline-block",
  color: "#666666",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
  padding: "12px 0",
};

const divider: React.CSSProperties = {
  borderColor: "#eeeeee",
  borderWidth: "1px 0 0 0",
  margin: "0 0 24px 0",
};

const footer: React.CSSProperties = {
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  margin: "0 0 8px 0",
};

const footerLinks: React.CSSProperties = {
  fontSize: "12px",
  margin: "0 0 16px 0",
};

const footerLink: React.CSSProperties = {
  color: "#666666",
  textDecoration: "none",
};

const footerBrand: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.1em",
  color: "#cccccc",
  margin: 0,
  textTransform: "uppercase" as const,
};

export default SyncFailedEmail;
