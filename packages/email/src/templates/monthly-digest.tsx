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

export interface MonthlyDigestEmailProps {
  organizationName: string;
  month: string;
  year: string;
  stats: {
    totalSynced: number;
    productsCreated: number;
    productsUpdated: number;
    productsFailed: number;
    activeFeeds: number;
    avgSyncTime: string;
  };
  comparison: {
    syncedChange: number;
    createdChange: number;
    failedChange: number;
  };
  topFeeds: Array<{
    name: string;
    productsSynced: number;
    successRate: number;
  }>;
  insights: string[];
  dashboardUrl: string;
  recipientName?: string | null;
}

export function MonthlyDigestEmail({
  organizationName = "Acme Store",
  month = "January",
  year = "2025",
  stats = {
    totalSynced: 52431,
    productsCreated: 1842,
    productsUpdated: 50589,
    productsFailed: 127,
    activeFeeds: 8,
    avgSyncTime: "2.4s",
  },
  comparison = {
    syncedChange: 12.5,
    createdChange: 8.3,
    failedChange: -15.2,
  },
  topFeeds = [
    { name: "Premium Suppliers Co.", productsSynced: 18521, successRate: 99.8 },
    { name: "Fashion Direct", productsSynced: 15892, successRate: 99.4 },
    { name: "Home Essentials", productsSynced: 9156, successRate: 98.9 },
    { name: "Tech Gadgets Plus", productsSynced: 5862, successRate: 99.1 },
  ],
  insights = [
    "Sync success rate improved by 0.3% compared to last month",
    "Peak sync activity occurs between 2-4 AM UTC",
    "3 new products from Fashion Direct are trending",
  ],
  dashboardUrl = "https://app.example.com/dashboard",
  recipientName,
}: MonthlyDigestEmailProps) {
  const formatNumber = (n: number) => n.toLocaleString("en-US");
  const formatChange = (n: number) => {
    const prefix = n > 0 ? "+" : "";
    return `${prefix}${n.toFixed(1)}%`;
  };
  const successRate = stats.totalSynced > 0
    ? (((stats.totalSynced - stats.productsFailed) / stats.totalSynced) * 100).toFixed(1)
    : "100.0";

  return (
    <Html>
      <Head />
      <Preview>
        {month} Report: {formatNumber(stats.totalSynced)} products synced with {successRate}% success
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
                  <Text style={reportType}>Monthly Report</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Title Section */}
          <Section style={titleSection}>
            <Text style={monthTitle}>{month}</Text>
            <Text style={yearSubtitle}>{year}</Text>
          </Section>

          {/* Greeting */}
          <Section style={greetingSection}>
            <Text style={greeting}>
              {recipientName ? `Hi ${recipientName},` : "Hi,"}
            </Text>
            <Text style={subtitle}>
              Here's your monthly sync summary for{" "}
              <span style={orgNameStyle}>{organizationName}</span>.
            </Text>
          </Section>

          {/* Primary Metric */}
          <Section style={primaryMetricSection}>
            <Text style={primaryNumber}>{formatNumber(stats.totalSynced)}</Text>
            <Text style={primaryLabel}>Products Synced</Text>
            <Text style={changeIndicator(comparison.syncedChange)}>
              {formatChange(comparison.syncedChange)} vs last month
            </Text>
          </Section>

          {/* Stats Grid */}
          <Section style={statsGrid}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={statBox}>
                  <Text style={statValue}>{formatNumber(stats.productsCreated)}</Text>
                  <Text style={statBoxLabel}>Created</Text>
                  <Text style={statChange(comparison.createdChange)}>
                    {formatChange(comparison.createdChange)}
                  </Text>
                </td>
                <td width="8"></td>
                <td style={statBox}>
                  <Text style={statValue}>{formatNumber(stats.productsUpdated)}</Text>
                  <Text style={statBoxLabel}>Updated</Text>
                </td>
                <td width="8"></td>
                <td style={statBox}>
                  <Text style={statValueMuted}>
                    {stats.productsFailed > 0 ? formatNumber(stats.productsFailed) : "0"}
                  </Text>
                  <Text style={statBoxLabel}>Failed</Text>
                  <Text style={statChange(comparison.failedChange)}>
                    {formatChange(comparison.failedChange)}
                  </Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* Quick Stats Row */}
          <Section style={quickStatsSection}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={quickStat}>
                  <Text style={quickStatValue}>{successRate}%</Text>
                  <Text style={quickStatLabel}>Success Rate</Text>
                </td>
                <td style={quickStatDivider}></td>
                <td style={quickStat}>
                  <Text style={quickStatValue}>{stats.activeFeeds}</Text>
                  <Text style={quickStatLabel}>Active Feeds</Text>
                </td>
                <td style={quickStatDivider}></td>
                <td style={quickStat}>
                  <Text style={quickStatValue}>{stats.avgSyncTime}</Text>
                  <Text style={quickStatLabel}>Avg Sync Time</Text>
                </td>
              </tr>
            </table>
          </Section>

          <Hr style={divider} />

          {/* Top Feeds */}
          <Section style={feedsSection}>
            <Text style={sectionTitle}>Feed Performance</Text>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              {topFeeds.map((feed, index) => (
                <tr key={index}>
                  <td style={feedRow}>
                    <table width="100%" cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td>
                          <Text style={feedIndex}>{String(index + 1).padStart(2, "0")}</Text>
                        </td>
                        <td width="12"></td>
                        <td style={{ width: "100%" }}>
                          <Text style={feedName}>{feed.name}</Text>
                          <Text style={feedMeta}>
                            {formatNumber(feed.productsSynced)} synced · {feed.successRate}% success
                          </Text>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              ))}
            </table>
          </Section>

          <Hr style={divider} />

          {/* Insights */}
          <Section style={insightsSection}>
            <Text style={sectionTitle}>Insights</Text>
            {insights.map((insight, index) => (
              <Text key={index} style={insightItem}>
                <span style={insightBullet}>→</span> {insight}
              </Text>
            ))}
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={dashboardUrl} style={ctaButton}>
              View Full Analytics
            </Link>
            <Link href={`${dashboardUrl}/reports`} style={ctaSecondary}>
              Download Report
            </Link>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This monthly digest is sent on the 1st of each month.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${dashboardUrl}/settings/notifications`} style={footerLink}>
                Notification settings
              </Link>
              {" · "}
              <Link href="https://pxm.studio/help" style={footerLink}>
                Support
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
  backgroundColor: "#fafafa",
  fontFamily: fontSans,
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 24px",
  backgroundColor: "#ffffff",
};

const header: React.CSSProperties = {
  marginBottom: "24px",
};

const logoText: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  letterSpacing: "0.15em",
  color: "#000000",
  margin: 0,
  textTransform: "uppercase" as const,
};

const reportType: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "#999999",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
};

const titleSection: React.CSSProperties = {
  marginBottom: "32px",
  borderLeft: "3px solid #000000",
  paddingLeft: "16px",
};

const monthTitle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 600,
  color: "#000000",
  margin: "0 0 2px 0",
  letterSpacing: "-0.02em",
  lineHeight: "1.1",
};

const yearSubtitle: React.CSSProperties = {
  fontSize: "14px",
  fontFamily: fontMono,
  color: "#888888",
  margin: 0,
};

const greetingSection: React.CSSProperties = {
  marginBottom: "32px",
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

const orgNameStyle: React.CSSProperties = {
  color: "#000000",
  fontWeight: 500,
};

const primaryMetricSection: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "40px 24px",
  backgroundColor: "#000000",
  marginBottom: "8px",
};

const primaryNumber: React.CSSProperties = {
  fontSize: "56px",
  fontFamily: fontMono,
  fontWeight: 700,
  color: "#ffffff",
  margin: "0 0 4px 0",
  letterSpacing: "-0.03em",
  lineHeight: "1",
};

const primaryLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "#888888",
  margin: "0 0 12px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
};

const changeIndicator = (change: number): React.CSSProperties => ({
  fontSize: "13px",
  fontFamily: fontMono,
  fontWeight: 500,
  color: change >= 0 ? "#00ff88" : "#ff6b6b",
  margin: 0,
});

const statsGrid: React.CSSProperties = {
  marginBottom: "8px",
};

const statBox: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  padding: "20px 16px",
  textAlign: "center" as const,
  verticalAlign: "top" as const,
};

const statValue: React.CSSProperties = {
  fontSize: "22px",
  fontFamily: fontMono,
  fontWeight: 600,
  color: "#000000",
  margin: "0 0 4px 0",
  letterSpacing: "-0.01em",
};

const statValueMuted: React.CSSProperties = {
  ...statValue,
  color: "#999999",
};

const statBoxLabel: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  color: "#888888",
  margin: "0 0 8px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const statChange = (change: number): React.CSSProperties => ({
  fontSize: "11px",
  fontFamily: fontMono,
  fontWeight: 500,
  color: change >= 0 ? (change > 0 ? "#00aa55" : "#888888") : "#00aa55",
  margin: 0,
});

const quickStatsSection: React.CSSProperties = {
  backgroundColor: "#f5f5f5",
  padding: "16px",
  marginBottom: "32px",
};

const quickStat: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "0 8px",
};

const quickStatDivider: React.CSSProperties = {
  width: "1px",
  backgroundColor: "#e0e0e0",
};

const quickStatValue: React.CSSProperties = {
  fontSize: "16px",
  fontFamily: fontMono,
  fontWeight: 600,
  color: "#000000",
  margin: "0 0 2px 0",
};

const quickStatLabel: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 500,
  color: "#888888",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
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
  margin: "0 0 20px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
};

const feedRow: React.CSSProperties = {
  paddingBottom: "16px",
  marginBottom: "16px",
  borderBottom: "1px solid #f0f0f0",
};

const feedIndex: React.CSSProperties = {
  fontSize: "12px",
  fontFamily: fontMono,
  fontWeight: 500,
  color: "#cccccc",
  margin: 0,
};

const feedName: React.CSSProperties = {
  fontSize: "14px",
  color: "#000000",
  margin: "0 0 4px 0",
  fontWeight: 500,
};

const feedMeta: React.CSSProperties = {
  fontSize: "12px",
  fontFamily: fontMono,
  color: "#888888",
  margin: 0,
};

const insightsSection: React.CSSProperties = {
  marginBottom: "32px",
};

const insightItem: React.CSSProperties = {
  fontSize: "14px",
  color: "#333333",
  margin: "0 0 12px 0",
  lineHeight: "1.5",
};

const insightBullet: React.CSSProperties = {
  color: "#00aa55",
  fontWeight: 600,
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
  padding: "14px 28px",
  borderRadius: "2px",
  letterSpacing: "0.02em",
  marginRight: "12px",
};

const ctaSecondary: React.CSSProperties = {
  display: "inline-block",
  color: "#666666",
  fontSize: "13px",
  fontWeight: 500,
  textDecoration: "none",
  padding: "14px 0",
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

export default MonthlyDigestEmail;
