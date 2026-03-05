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

export interface SyncCompletedEmailProps {
  organizationName: string;
  feedName: string;
  supplierName?: string;
  syncedAt: string;
  duration: string;
  stats: {
    processed: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  activityUrl: string;
  recipientName?: string | null;
}

export function SyncCompletedEmail({
  organizationName = "Acme Store",
  feedName = "Premium Suppliers Feed",
  supplierName = "Premium Suppliers Co.",
  syncedAt = "Jan 16, 2025 at 2:34 PM",
  duration = "1m 23s",
  stats = {
    processed: 1247,
    created: 42,
    updated: 1180,
    skipped: 25,
    failed: 0,
  },
  activityUrl = "https://app.example.com/activity",
  recipientName,
}: SyncCompletedEmailProps) {
  const formatNumber = (n: number) => n.toLocaleString("en-US");
  const successRate =
    stats.processed > 0
      ? (((stats.processed - stats.failed) / stats.processed) * 100).toFixed(1)
      : "100.0";

  const hasFailures = stats.failed > 0;

  return (
    <Html>
      <Head />
      <Preview>
        Sync completed: {formatNumber(stats.processed)} products processed from {feedName}
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
                  <Text style={tagSuccess}>Sync Complete</Text>
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
              A sync just completed for <strong>{organizationName}</strong>.
            </Text>
          </Section>

          {/* Feed Info */}
          <Section style={feedSection}>
            <Text style={feedName_style}>{feedName}</Text>
            {supplierName && <Text style={supplierText}>from {supplierName}</Text>}
          </Section>

          {/* Stats Grid */}
          <Section style={statsSection}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={statCell}>
                  <Text style={statNumber}>{formatNumber(stats.processed)}</Text>
                  <Text style={statLabel}>Processed</Text>
                </td>
                <td style={statCell}>
                  <Text style={statNumberAccent}>{successRate}%</Text>
                  <Text style={statLabel}>Success</Text>
                </td>
                <td style={statCell}>
                  <Text style={statNumberMuted}>{duration}</Text>
                  <Text style={statLabel}>Duration</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Breakdown */}
          <Section style={breakdownSection}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={breakdownRow}>
                  <Text style={breakdownLabel}>Created</Text>
                  <Text style={breakdownValue}>{formatNumber(stats.created)}</Text>
                </td>
              </tr>
              <tr>
                <td style={breakdownRow}>
                  <Text style={breakdownLabel}>Updated</Text>
                  <Text style={breakdownValue}>{formatNumber(stats.updated)}</Text>
                </td>
              </tr>
              <tr>
                <td style={breakdownRow}>
                  <Text style={breakdownLabel}>Skipped</Text>
                  <Text style={breakdownValueMuted}>{formatNumber(stats.skipped)}</Text>
                </td>
              </tr>
              {hasFailures && (
                <tr>
                  <td style={breakdownRow}>
                    <Text style={breakdownLabel}>Failed</Text>
                    <Text style={breakdownValueError}>{formatNumber(stats.failed)}</Text>
                  </td>
                </tr>
              )}
            </table>
          </Section>

          {/* Timestamp */}
          <Section style={timestampSection}>
            <Text style={timestampText}>Completed {syncedAt}</Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={activityUrl} style={ctaButton}>
              View Activity
            </Link>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because sync notifications are enabled.
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

const tagSuccess: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#00875a",
  backgroundColor: "#e3fcef",
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
  paddingBottom: "24px",
  borderBottom: "1px solid #eeeeee",
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

const statsSection: React.CSSProperties = {
  backgroundColor: "#000000",
  padding: "24px",
  marginBottom: "2px",
};

const statCell: React.CSSProperties = {
  textAlign: "center" as const,
  verticalAlign: "top" as const,
  width: "33.33%",
};

const statNumber: React.CSSProperties = {
  fontSize: "28px",
  fontFamily: fontMono,
  fontWeight: 700,
  color: "#ffffff",
  margin: "0 0 4px 0",
  lineHeight: "1",
};

const statNumberAccent: React.CSSProperties = {
  ...statNumber,
  color: "#4ade80",
};

const statNumberMuted: React.CSSProperties = {
  ...statNumber,
  fontSize: "20px",
  color: "#888888",
};

const statLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  color: "#888888",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const breakdownSection: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "16px 24px",
  marginBottom: "24px",
};

const breakdownRow: React.CSSProperties = {
  paddingTop: "8px",
  paddingBottom: "8px",
};

const breakdownLabel: React.CSSProperties = {
  fontSize: "13px",
  color: "#666666",
  margin: 0,
  display: "inline-block",
};

const breakdownValue: React.CSSProperties = {
  fontSize: "13px",
  fontFamily: fontMono,
  fontWeight: 600,
  color: "#000000",
  margin: 0,
  float: "right" as const,
};

const breakdownValueMuted: React.CSSProperties = {
  ...breakdownValue,
  color: "#999999",
};

const breakdownValueError: React.CSSProperties = {
  ...breakdownValue,
  color: "#dc2626",
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
  backgroundColor: "#000000",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
  padding: "12px 24px",
  borderRadius: "2px",
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

export default SyncCompletedEmail;
