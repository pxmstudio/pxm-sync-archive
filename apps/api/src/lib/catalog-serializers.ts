// Catalog serializers for XML and CSV export formats

export interface ProductImage {
  url: string;
  altText?: string | null;
  position?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface CatalogVariant {
  id: string;
  externalId: string | null;
  sku: string | null;
  name: string;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  attributes: Record<string, string> | null;
  available: number;
}

export interface CatalogProduct {
  id: string;
  externalId: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  productType: string | null;
  tags: string[] | null;
  images: ProductImage[] | null;
  variants: CatalogVariant[];
  supplier: {
    id: string;
    name: string;
    slug: string | null;
  };
  updatedAt: string;
}

// Escape special characters for CSV
function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Escape special characters for XML
function escapeXML(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Convert products to CSV format (one row per variant)
export function toCSV(products: CatalogProduct[]): string {
  const headers = [
    "product_id",
    "product_sku",
    "product_name",
    "product_description",
    "product_brand",
    "product_type",
    "product_tags",
    "product_image_url",
    "variant_id",
    "variant_sku",
    "variant_name",
    "variant_price",
    "variant_compare_at_price",
    "variant_currency",
    "variant_attributes",
    "variant_available",
    "supplier_id",
    "supplier_name",
    "updated_at",
  ];

  const rows: string[] = [headers.join(",")];

  for (const product of products) {
    const primaryImageUrl = product.images?.[0]?.url ?? "";
    const tagsStr = product.tags?.join(";") ?? "";

    for (const variant of product.variants) {
      const attributesStr = variant.attributes
        ? Object.entries(variant.attributes)
            .map(([k, v]) => `${k}:${v}`)
            .join(";")
        : "";

      const row = [
        escapeCSV(product.id),
        escapeCSV(product.sku),
        escapeCSV(product.name),
        escapeCSV(product.description),
        escapeCSV(product.brand),
        escapeCSV(product.productType),
        escapeCSV(tagsStr),
        escapeCSV(primaryImageUrl),
        escapeCSV(variant.id),
        escapeCSV(variant.sku),
        escapeCSV(variant.name),
        escapeCSV(variant.price),
        escapeCSV(variant.compareAtPrice),
        escapeCSV(variant.currency),
        escapeCSV(attributesStr),
        String(variant.available),
        escapeCSV(product.supplier.id),
        escapeCSV(product.supplier.name),
        escapeCSV(product.updatedAt),
      ];

      rows.push(row.join(","));
    }

    // If product has no variants, still include it with empty variant fields
    if (product.variants.length === 0) {
      const row = [
        escapeCSV(product.id),
        escapeCSV(product.sku),
        escapeCSV(product.name),
        escapeCSV(product.description),
        escapeCSV(product.brand),
        escapeCSV(product.productType),
        escapeCSV(tagsStr),
        escapeCSV(primaryImageUrl),
        "", // variant_id
        "", // variant_sku
        "", // variant_name
        "", // variant_price
        "", // variant_compare_at_price
        "", // variant_currency
        "", // variant_attributes
        "", // variant_available
        escapeCSV(product.supplier.id),
        escapeCSV(product.supplier.name),
        escapeCSV(product.updatedAt),
      ];

      rows.push(row.join(","));
    }
  }

  return rows.join("\n");
}

// Convert products to XML format
export function toXML(products: CatalogProduct[]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<catalog>\n";
  xml += "  <products>\n";

  for (const product of products) {
    xml += "    <product>\n";
    xml += `      <id>${escapeXML(product.id)}</id>\n`;
    xml += `      <sku>${escapeXML(product.sku)}</sku>\n`;
    xml += `      <name>${escapeXML(product.name)}</name>\n`;
    xml += `      <description>${escapeXML(product.description)}</description>\n`;
    xml += `      <brand>${escapeXML(product.brand)}</brand>\n`;
    xml += `      <productType>${escapeXML(product.productType)}</productType>\n`;

    // Tags
    xml += "      <tags>\n";
    if (product.tags) {
      for (const tag of product.tags) {
        xml += `        <tag>${escapeXML(tag)}</tag>\n`;
      }
    }
    xml += "      </tags>\n";

    // Images
    xml += "      <images>\n";
    if (product.images) {
      for (const image of product.images) {
        xml += "        <image>\n";
        xml += `          <url>${escapeXML(image.url)}</url>\n`;
        xml += `          <altText>${escapeXML(image.altText)}</altText>\n`;
        xml += "        </image>\n";
      }
    }
    xml += "      </images>\n";

    // Variants
    xml += "      <variants>\n";
    for (const variant of product.variants) {
      xml += "        <variant>\n";
      xml += `          <id>${escapeXML(variant.id)}</id>\n`;
      xml += `          <sku>${escapeXML(variant.sku)}</sku>\n`;
      xml += `          <name>${escapeXML(variant.name)}</name>\n`;
      xml += `          <price>${escapeXML(variant.price)}</price>\n`;
      xml += `          <compareAtPrice>${escapeXML(variant.compareAtPrice)}</compareAtPrice>\n`;
      xml += `          <currency>${escapeXML(variant.currency)}</currency>\n`;

      // Attributes
      xml += "          <attributes>\n";
      if (variant.attributes) {
        for (const [key, value] of Object.entries(variant.attributes)) {
          xml += `            <${escapeXML(key)}>${escapeXML(value)}</${escapeXML(key)}>\n`;
        }
      }
      xml += "          </attributes>\n";

      xml += `          <available>${variant.available}</available>\n`;
      xml += "        </variant>\n";
    }
    xml += "      </variants>\n";

    // Supplier
    xml += "      <supplier>\n";
    xml += `        <id>${escapeXML(product.supplier.id)}</id>\n`;
    xml += `        <name>${escapeXML(product.supplier.name)}</name>\n`;
    xml += `        <slug>${escapeXML(product.supplier.slug)}</slug>\n`;
    xml += "      </supplier>\n";

    xml += `      <updatedAt>${escapeXML(product.updatedAt)}</updatedAt>\n`;
    xml += "    </product>\n";
  }

  xml += "  </products>\n";
  xml += "</catalog>";

  return xml;
}
