import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface NewProduct {
  id: string;
  title: string;
  imageUrl?: string;
  price: string;
  compareAtPrice?: string;
  variantCount: number;
  productType?: string;
}

export interface NewProductsReportEmailProps {
  organizationName: string;
  feedName: string;
  supplierName?: string;
  syncedAt: string;
  products: NewProduct[];
  totalCount: number;
  productsUrl: string;
  recipientName?: string | null;
}

export function NewProductsReportEmail({
  organizationName = "Acme Store",
  feedName = "Premium Suppliers Feed",
  supplierName = "Premium Suppliers Co.",
  syncedAt = "Jan 16, 2025 at 2:34 PM",
  products = [
    {
      id: "1",
      title: "Premium Wireless Headphones",
      imageUrl: "https://via.placeholder.com/120",
      price: "$149.99",
      compareAtPrice: "$199.99",
      variantCount: 3,
      productType: "Electronics",
    },
    {
      id: "2",
      title: "Organic Cotton T-Shirt",
      imageUrl: "https://via.placeholder.com/120",
      price: "$34.99",
      variantCount: 5,
      productType: "Apparel",
    },
    {
      id: "3",
      title: "Stainless Steel Water Bottle",
      imageUrl: "https://via.placeholder.com/120",
      price: "$24.99",
      variantCount: 2,
      productType: "Accessories",
    },
  ],
  totalCount = 42,
  productsUrl = "https://app.example.com/products",
  recipientName,
}: NewProductsReportEmailProps) {
  const displayProducts = products.slice(0, 6);
  const remainingCount = totalCount - displayProducts.length;

  return (
    <Html>
      <Head />
      <Preview>
        {`${totalCount} new products added from ${feedName}`}
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
                  <Text style={tagNew}>New Products</Text>
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
              New products were just added to <strong>{organizationName}</strong>.
            </Text>
          </Section>

          {/* Summary */}
          <Section style={summarySection}>
            <Text style={summaryNumber}>{totalCount}</Text>
            <Text style={summaryLabel}>New Products</Text>
            <Text style={summaryMeta}>
              from <strong>{feedName}</strong>
              {supplierName && ` by ${supplierName}`}
            </Text>
          </Section>

          {/* Products List */}
          <Section style={productsSection}>
            <Text style={sectionTitle}>Latest Additions</Text>
            {displayProducts.map((product) => (
              <table key={product.id} width="100%" cellPadding={0} cellSpacing={0} style={productCard}>
                <tr>
                  <td style={productImageCell}>
                    {product.imageUrl ? (
                      <Img
                        src={product.imageUrl}
                        alt={product.title}
                        width={72}
                        height={72}
                        style={productImage}
                      />
                    ) : (
                      <div style={productImagePlaceholder}>
                        <Text style={productImagePlaceholderText}>No image</Text>
                      </div>
                    )}
                  </td>
                  <td style={productDetails}>
                    <Text style={productTitle}>{product.title}</Text>
                    {product.productType && (
                      <Text style={productType}>{product.productType}</Text>
                    )}
                    <Text style={productMeta}>
                      <span style={productPrice}>{product.price}</span>
                      {product.compareAtPrice && (
                        <span style={productComparePrice}>{product.compareAtPrice}</span>
                      )}
                      <span style={productVariants}>
                        {product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}
                      </span>
                    </Text>
                  </td>
                </tr>
              </table>
            ))}
          </Section>

          {/* More Products */}
          {remainingCount > 0 && (
            <Section style={moreSection}>
              <Text style={moreText}>
                +{remainingCount} more product{remainingCount !== 1 ? "s" : ""}
              </Text>
            </Section>
          )}

          {/* Timestamp */}
          <Section style={timestampSection}>
            <Text style={timestampText}>Synced {syncedAt}</Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={productsUrl} style={ctaButton}>
              View All Products
            </Link>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You're receiving this because new product notifications are enabled.
            </Text>
            <Text style={footerLinks}>
              <Link href={`${productsUrl.split('/products')[0]}/settings/notifications`} style={footerLink}>
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

const tagNew: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#7c3aed",
  backgroundColor: "#f3e8ff",
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

const summarySection: React.CSSProperties = {
  backgroundColor: "#000000",
  padding: "32px 24px",
  marginBottom: "24px",
  textAlign: "center" as const,
};

const summaryNumber: React.CSSProperties = {
  fontSize: "48px",
  fontFamily: fontMono,
  fontWeight: 700,
  color: "#ffffff",
  margin: "0 0 4px 0",
  lineHeight: "1",
};

const summaryLabel: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "#888888",
  margin: "0 0 16px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.1em",
};

const summaryMeta: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  margin: 0,
};

const productsSection: React.CSSProperties = {
  marginBottom: "24px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#888888",
  margin: "0 0 16px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const productCard: React.CSSProperties = {
  marginBottom: "16px",
  paddingBottom: "16px",
  borderBottom: "1px solid #f0f0f0",
};

const productImageCell: React.CSSProperties = {
  width: "72px",
  verticalAlign: "top" as const,
  paddingRight: "16px",
};

const productImage: React.CSSProperties = {
  borderRadius: "4px",
  objectFit: "cover" as const,
};

const productImagePlaceholder: React.CSSProperties = {
  width: "72px",
  height: "72px",
  backgroundColor: "#f5f5f5",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const productImagePlaceholderText: React.CSSProperties = {
  fontSize: "10px",
  color: "#999999",
  margin: 0,
  textAlign: "center" as const,
};

const productDetails: React.CSSProperties = {
  verticalAlign: "top" as const,
};

const productTitle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#000000",
  margin: "0 0 4px 0",
  lineHeight: "1.3",
};

const productType: React.CSSProperties = {
  fontSize: "11px",
  color: "#888888",
  margin: "0 0 8px 0",
};

const productMeta: React.CSSProperties = {
  fontSize: "13px",
  color: "#000000",
  margin: 0,
};

const productPrice: React.CSSProperties = {
  fontFamily: fontMono,
  fontWeight: 600,
  marginRight: "8px",
};

const productComparePrice: React.CSSProperties = {
  fontFamily: fontMono,
  color: "#999999",
  textDecoration: "line-through",
  marginRight: "8px",
};

const productVariants: React.CSSProperties = {
  color: "#888888",
  fontSize: "12px",
};

const moreSection: React.CSSProperties = {
  textAlign: "center" as const,
  marginBottom: "24px",
};

const moreText: React.CSSProperties = {
  fontSize: "13px",
  fontFamily: fontMono,
  color: "#666666",
  margin: 0,
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

export default NewProductsReportEmail;
