import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface WeeklyDigestEmailProps {
  organizationName: string;
  periodStart: string;
  periodEnd: string;
  stats: {
    totalSynced: number;
    productsCreated: number;
    productsUpdated: number;
    productsFailed: number;
  };
  topFeeds: Array<{
    name: string;
    productsSynced: number;
    successRate: number;
  }>;
  dashboardUrl: string;
  recipientName?: string | null;
}

export function WeeklyDigestEmail({
  organizationName = "Acme Store",
  periodStart = "Jan 13",
  periodEnd = "Jan 19",
  stats = {
    totalSynced: 12847,
    productsCreated: 342,
    productsUpdated: 12505,
    productsFailed: 23,
  },
  topFeeds = [
    { name: "Premium Suppliers Co.", productsSynced: 4521, successRate: 99.8 },
    { name: "Fashion Direct", productsSynced: 3892, successRate: 99.2 },
    { name: "Home Essentials", productsSynced: 2156, successRate: 98.5 },
  ],
  dashboardUrl = "https://app.example.com/dashboard",
  recipientName,
}: WeeklyDigestEmailProps) {
  const formatNumber = (n: number) => n.toLocaleString("en-US");
  const successRate = stats.totalSynced > 0
    ? (((stats.totalSynced - stats.productsFailed) / stats.totalSynced) * 100).toFixed(1)
    : "100.0";

  return (
    <Html>
      <Head />
      <Preview>
        {formatNumber(stats.totalSynced)} products synced this week — {successRate}% success rate
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
                  <Text style={periodBadge}>
                    {periodStart} — {periodEnd}
                  </Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greeting}>
              {recipientName ? `${recipientName},` : "Hi,"}
            </Text>
            <Text style={subtitle}>
              Here's your weekly sync report for <span style={orgName}>{organizationName}</span>
            </Text>
          </Section>

          {/* Hero Stats */}
          <Section style={statsSection}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={statCell} width="50%">
                  <Text style={statNumber}>{formatNumber(stats.totalSynced)}</Text>
                  <Text style={statLabel}>Products Synced</Text>
                </td>
                <td style={statCell} width="50%">
                  <Text style={statNumberAccent}>{successRate}%</Text>
                  <Text style={statLabel}>Success Rate</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Breakdown Stats */}
          <Section style={breakdownSection}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={breakdownCell}>
                  <Text style={breakdownNumber}>{formatNumber(stats.productsCreated)}</Text>
                  <Text style={breakdownLabel}>Created</Text>
                </td>
                <td style={breakdownCell}>
                  <Text style={breakdownNumber}>{formatNumber(stats.productsUpdated)}</Text>
                  <Text style={breakdownLabel}>Updated</Text>
                </td>
                <td style={breakdownCell}>
                  <Text style={stats.productsFailed > 0 ? breakdownNumberError : breakdownNumberMuted}>
                    {stats.productsFailed > 0 ? formatNumber(stats.productsFailed) : "—"}
                  </Text>
                  <Text style={breakdownLabel}>Failed</Text>
                </td>
              </tr>
            </table>
          </Section>

          <Hr style={divider} />

          {/* Top Feeds */}
          <Section style={feedsSection}>
            <Text style={sectionTitle}>Top Performing Feeds</Text>
            <table width="100%" cellPadding={0} cellSpacing={0} style={feedsTable}>
              <tr>
                <td style={feedsHeaderCell}>Feed</td>
                <td style={feedsHeaderCellRight}>Synced</td>
                <td style={feedsHeaderCellRight}>Rate</td>
              </tr>
              {topFeeds.map((feed, index) => (
                <tr key={index}>
                  <td style={feedCell}>
                    <Text style={feedName}>{feed.name}</Text>
                  </td>
                  <td style={feedCellRight}>
                    <Text style={feedStat}>{formatNumber(feed.productsSynced)}</Text>
                  </td>
                  <td style={feedCellRight}>
                    <Text style={feedRate}>{feed.successRate}%</Text>
                  </td>
                </tr>
              ))}
            </table>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={ctaButton}>
              View Full Report →
            </Link>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because you're subscribed to weekly digests.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${dashboardUrl}/settings/notifications`} style={footerLink}>
                Manage preferences
              </Link>
              {" · "}
              <Link href="https://pxm.studio/help" style={footerLink}>
                Help
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

// Styles
const main: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily: fontSans,
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 24px",
};

const header: React.CSSProperties = {
  marginBottom: "32px",
};

const logoText: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  letterSpacing: "0.15em",
  color: "#000000",
  margin: 0,
  textTransform: "uppercase" as const,
};

const periodBadge: React.CSSProperties = {
  fontSize: "12px",
  fontFamily: fontMono,
  color: "#666666",
  margin: 0,
  letterSpacing: "0.02em",
};

const greetingSection: React.CSSProperties = {
  marginBottom: "40px",
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

const orgName: React.CSSProperties = {
  color: "#000000",
  fontWeight: 500,
};

const statsSection: React.CSSProperties = {
  backgroundColor: "#000000",
  borderRadius: "2px",
  padding: "32px 24px",
  marginBottom: "2px",
};

const statCell: React.CSSProperties = {
  textAlign: "center" as const,
  verticalAlign: "top" as const,
};

const statNumber: React.CSSProperties = {
  fontSize: "42px",
  fontFamily: fontMono,
  fontWeight: 700,
  color: "#ffffff",
  margin: "0 0 4px 0",
  letterSpacing: "-0.02em",
  lineHeight: "1",
};

const statNumberAccent: React.CSSProperties = {
  ...statNumber,
  color: "#00ff88",
};

const statLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "#888888",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
};

const breakdownSection: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  borderRadius: "2px",
  padding: "20px 24px",
  marginBottom: "32px",
};

const breakdownCell: React.CSSProperties = {
  textAlign: "center" as const,
  verticalAlign: "top" as const,
  width: "33.33%",
};

const breakdownNumber: React.CSSProperties = {
  fontSize: "20px",
  fontFamily: fontMono,
  fontWeight: 500,
  color: "#000000",
  margin: "0 0 2px 0",
  letterSpacing: "-0.01em",
};

const breakdownNumberError: React.CSSProperties = {
  ...breakdownNumber,
  color: "#e53935",
};

const breakdownNumberMuted: React.CSSProperties = {
  ...breakdownNumber,
  color: "#cccccc",
};

const breakdownLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  color: "#888888",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const divider: React.CSSProperties = {
  borderColor: "#eeeeee",
  borderWidth: "1px 0 0 0",
  margin: "32px 0",
};

const feedsSection: React.CSSProperties = {
  marginBottom: "32px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#888888",
  margin: "0 0 16px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
};

const feedsTable: React.CSSProperties = {
  width: "100%",
};

const feedsHeaderCell: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  color: "#aaaaaa",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  paddingBottom: "12px",
  borderBottom: "1px solid #eeeeee",
};

const feedsHeaderCellRight: React.CSSProperties = {
  ...feedsHeaderCell,
  textAlign: "right" as const,
};

const feedCell: React.CSSProperties = {
  paddingTop: "12px",
  paddingBottom: "12px",
  borderBottom: "1px solid #f5f5f5",
};

const feedCellRight: React.CSSProperties = {
  ...feedCell,
  textAlign: "right" as const,
};

const feedName: React.CSSProperties = {
  fontSize: "14px",
  color: "#000000",
  margin: 0,
  fontWeight: 500,
};

const feedStat: React.CSSProperties = {
  fontSize: "14px",
  fontFamily: fontMono,
  color: "#000000",
  margin: 0,
};

const feedRate: React.CSSProperties = {
  fontSize: "14px",
  fontFamily: fontMono,
  color: "#00aa55",
  margin: 0,
  fontWeight: 500,
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
  letterSpacing: "0.02em",
};

const footer: React.CSSProperties = {
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  margin: "0 0 8px 0",
  lineHeight: "1.5",
};

const footerLinks: React.CSSProperties = {
  fontSize: "12px",
  color: "#999999",
  margin: "0 0 16px 0",
};

const footerLink: React.CSSProperties = {
  color: "#666666",
  textDecoration: "none",
};

const footerBrand: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  letterSpacing: "0.15em",
  color: "#cccccc",
  margin: 0,
  textTransform: "uppercase" as const,
};

export default WeeklyDigestEmail;
