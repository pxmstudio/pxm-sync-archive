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

export type IssueType =
  | "auth_expired"
  | "auth_revoked"
  | "api_error"
  | "rate_limit"
  | "store_unavailable"
  | "invalid_credentials"
  | "scope_missing"
  | "unknown";

export interface IntegrationIssueEmailProps {
  organizationName: string;
  integrationName: string;
  storeDomain?: string;
  issueType: IssueType;
  issueTitle: string;
  issueDescription: string;
  howToFix: string[];
  detectedAt: string;
  integrationsUrl: string;
  recipientName?: string | null;
}

const issueTypeConfig: Record<IssueType, { icon: string; color: string; bgColor: string }> = {
  auth_expired: { icon: "⏱", color: "#d97706", bgColor: "#fef3c7" },
  auth_revoked: { icon: "🔐", color: "#dc2626", bgColor: "#fef2f2" },
  api_error: { icon: "⚠", color: "#dc2626", bgColor: "#fef2f2" },
  rate_limit: { icon: "⏳", color: "#d97706", bgColor: "#fef3c7" },
  store_unavailable: { icon: "🔌", color: "#dc2626", bgColor: "#fef2f2" },
  invalid_credentials: { icon: "🔑", color: "#dc2626", bgColor: "#fef2f2" },
  scope_missing: { icon: "🛡", color: "#d97706", bgColor: "#fef3c7" },
  unknown: { icon: "❓", color: "#6b7280", bgColor: "#f3f4f6" },
};

export function IntegrationIssueEmail({
  organizationName = "Acme Store",
  integrationName = "Shopify",
  storeDomain = "acme-store.myshopify.com",
  issueType = "auth_expired",
  issueTitle = "Access Token Expired",
  issueDescription = "Your Shopify access token has expired and needs to be refreshed. Product syncs will fail until this is resolved.",
  howToFix = [
    "Go to your Shopify Admin",
    "Navigate to Settings → Apps and sales channels → Develop apps",
    "Find your PXM Sync app and regenerate the access token",
    "Update the token in PXM Sync integration settings",
  ],
  detectedAt = "Jan 16, 2025 at 2:34 PM",
  integrationsUrl = "https://app.example.com/settings/integrations",
  recipientName,
}: IntegrationIssueEmailProps) {
  const config = issueTypeConfig[issueType] || issueTypeConfig.unknown;

  return (
    <Html>
      <Head />
      <Preview>
        Integration issue: {issueTitle} — {integrationName}
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
                  <Text style={tagWarning}>Action Required</Text>
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
              We detected an issue with an integration for <strong>{organizationName}</strong>.
            </Text>
          </Section>

          {/* Issue Card */}
          <Section style={{ ...issueSection, backgroundColor: config.bgColor }}>
            <Text style={issueIcon}>{config.icon}</Text>
            <Text style={{ ...issueTitleStyle, color: config.color }}>{issueTitle}</Text>
            <Text style={issueDescription_style}>{issueDescription}</Text>
          </Section>

          {/* Integration Info */}
          <Section style={integrationSection}>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              <tr>
                <td style={integrationRow}>
                  <Text style={integrationLabel}>Integration</Text>
                  <Text style={integrationValue}>{integrationName}</Text>
                </td>
              </tr>
              {storeDomain && (
                <tr>
                  <td style={integrationRow}>
                    <Text style={integrationLabel}>Store</Text>
                    <Text style={integrationValue}>{storeDomain}</Text>
                  </td>
                </tr>
              )}
              <tr>
                <td style={integrationRow}>
                  <Text style={integrationLabel}>Detected</Text>
                  <Text style={integrationValue}>{detectedAt}</Text>
                </td>
              </tr>
            </table>
          </Section>

          {/* How to Fix */}
          <Section style={fixSection}>
            <Text style={fixTitle}>How to Fix</Text>
            <table width="100%" cellPadding={0} cellSpacing={0}>
              {howToFix.map((step, index) => (
                <tr key={index}>
                  <td style={fixStepRow}>
                    <Text style={fixStepNumber}>{index + 1}</Text>
                    <Text style={fixStepText}>{step}</Text>
                  </td>
                </tr>
              ))}
            </table>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={integrationsUrl} style={ctaButton}>
              Fix Integration
            </Link>
          </Section>

          {/* Impact Warning */}
          <Section style={impactSection}>
            <Text style={impactText}>
              <strong>Impact:</strong> Product syncs to this store will fail until the issue is resolved.
            </Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because integration issue notifications are enabled.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${integrationsUrl.split('/settings')[0]}/settings/notifications`} style={footerLink}>
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

const tagWarning: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#d97706",
  backgroundColor: "#fef3c7",
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

const issueSection: React.CSSProperties = {
  padding: "24px",
  marginBottom: "24px",
  textAlign: "center" as const,
  border: "1px solid #f0f0f0",
};

const issueIcon: React.CSSProperties = {
  fontSize: "32px",
  margin: "0 0 12px 0",
  lineHeight: "1",
};

const issueTitleStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  margin: "0 0 8px 0",
};

const issueDescription_style: React.CSSProperties = {
  fontSize: "14px",
  color: "#666666",
  margin: 0,
  lineHeight: "1.5",
};

const integrationSection: React.CSSProperties = {
  backgroundColor: "#f9f9f9",
  padding: "16px 24px",
  marginBottom: "24px",
};

const integrationRow: React.CSSProperties = {
  paddingTop: "8px",
  paddingBottom: "8px",
  borderBottom: "1px solid #eeeeee",
};

const integrationLabel: React.CSSProperties = {
  fontSize: "12px",
  color: "#888888",
  margin: 0,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  display: "inline-block",
};

const integrationValue: React.CSSProperties = {
  fontSize: "13px",
  fontFamily: fontMono,
  color: "#000000",
  margin: 0,
  float: "right" as const,
};

const fixSection: React.CSSProperties = {
  marginBottom: "24px",
};

const fixTitle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#888888",
  margin: "0 0 16px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const fixStepRow: React.CSSProperties = {
  paddingBottom: "12px",
};

const fixStepNumber: React.CSSProperties = {
  display: "inline-block",
  width: "24px",
  height: "24px",
  lineHeight: "24px",
  backgroundColor: "#000000",
  color: "#ffffff",
  borderRadius: "50%",
  fontSize: "12px",
  fontWeight: 600,
  textAlign: "center" as const,
  marginRight: "12px",
  verticalAlign: "top" as const,
};

const fixStepText: React.CSSProperties = {
  display: "inline-block",
  fontSize: "14px",
  color: "#333333",
  margin: 0,
  lineHeight: "24px",
  verticalAlign: "top" as const,
  maxWidth: "calc(100% - 40px)",
};

const ctaSection: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "24px",
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

const impactSection: React.CSSProperties = {
  backgroundColor: "#fef3c7",
  padding: "12px 16px",
  marginBottom: "32px",
  borderLeft: "3px solid #d97706",
};

const impactText: React.CSSProperties = {
  fontSize: "13px",
  color: "#92400e",
  margin: 0,
  lineHeight: "1.5",
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

export default IntegrationIssueEmail;
