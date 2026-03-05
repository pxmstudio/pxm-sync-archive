/**
 * Feed parsers for XML, CSV, and JSON formats
 */

import type { FeedMapping, FeedTransform, ParsedProduct, ParseResult, FeedLogError } from "./types.js";

/**
 * Parse XML feed content
 */
export async function parseXmlFeed(
  content: string,
  mapping: FeedMapping
): Promise<ParseResult> {
  const errors: FeedLogError[] = [];
  const products: ParsedProduct[] = [];

  try {
    // Use a simple XML parser approach
    // Extract product nodes based on rootPath
    const rootPath = mapping.rootPath || "";
    const items = extractXmlItems(content, rootPath);

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        if (item) {
          const product = mapXmlItemToProduct(item, mapping, i);
          if (product) {
            products.push(product);
          }
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : "Unknown error parsing item",
        });
      }
    }

    return {
      products,
      errors,
      totalRows: items.length,
    };
  } catch (error) {
    errors.push({
      message: `Failed to parse XML: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
    return { products: [], errors, totalRows: 0 };
  }
}

/**
 * Parse CSV feed content
 */
export async function parseCsvFeed(
  content: string,
  mapping: FeedMapping
): Promise<ParseResult> {
  const errors: FeedLogError[] = [];
  const products: ParsedProduct[] = [];

  try {
    const delimiter = mapping.options?.delimiter || ",";
    const skipRows = mapping.options?.skipRows || 0;

    // Parse CSV respecting quoted fields that may contain newlines
    const rows = parseCsvRows(content, delimiter);

    // Skip header rows
    const dataRows = rows.slice(skipRows);
    if (dataRows.length === 0) {
      return { products: [], errors: [], totalRows: 0 };
    }

    // First row is header
    const headers = dataRows[0] || [];
    const productRows = dataRows.slice(1);

    for (let i = 0; i < productRows.length; i++) {
      try {
        const row = productRows[i] || [];
        const item = zipToObject(headers, row);
        const product = mapObjectToProduct(item, mapping, i);
        if (product) {
          products.push(product);
        }
      } catch (error) {
        errors.push({
          row: i + 1 + skipRows + 1, // Account for skip rows and header
          message: error instanceof Error ? error.message : "Unknown error parsing row",
        });
      }
    }

    return {
      products,
      errors,
      totalRows: productRows.length,
    };
  } catch (error) {
    errors.push({
      message: `Failed to parse CSV: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
    return { products: [], errors, totalRows: 0 };
  }
}

/**
 * Parse CSV content into rows, properly handling quoted fields with newlines
 */
function parseCsvRows(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote - add single quote and skip next char
        currentField += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of field
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // End of row (not inside quotes)
      if (char === '\r') i++; // Skip \n in \r\n
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else if (char === '\r' && !inQuotes) {
      // Standalone \r as line ending
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Don't forget the last field/row
  currentRow.push(currentField.trim());
  if (currentRow.some(field => field !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Parse JSON feed content
 */
export async function parseJsonFeed(
  content: string,
  mapping: FeedMapping
): Promise<ParseResult> {
  const errors: FeedLogError[] = [];
  const products: ParsedProduct[] = [];

  try {
    const data = JSON.parse(content);

    // Navigate to root path if specified
    let items = data;
    if (mapping.rootPath) {
      const pathParts = mapping.rootPath.split(".");
      for (const part of pathParts) {
        if (items && typeof items === "object") {
          items = items[part];
        } else {
          throw new Error(`Invalid root path: ${mapping.rootPath}`);
        }
      }
    }

    if (!Array.isArray(items)) {
      throw new Error("Expected an array of products at the root path");
    }

    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const product = mapObjectToProduct(item, mapping, i);
        if (product) {
          products.push(product);
        }
      } catch (error) {
        errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : "Unknown error parsing item",
        });
      }
    }

    return {
      products,
      errors,
      totalRows: items.length,
    };
  } catch (error) {
    errors.push({
      message: `Failed to parse JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
    return { products: [], errors, totalRows: 0 };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract items from XML content based on root path
 */
function extractXmlItems(content: string, rootPath: string): Record<string, unknown>[] {
  // Simple XML to object parser
  // For production, consider using a proper XML parser like fast-xml-parser

  // Determine the item tag name
  let itemTag = "item";
  if (rootPath) {
    const parts = rootPath.split(".");
    itemTag = parts[parts.length - 1] || "item";
  }

  const items: Record<string, unknown>[] = [];

  // Use regex to extract items (simplified approach)
  const itemRegex = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, "gi");
  let match;

  while ((match = itemRegex.exec(content)) !== null) {
    const itemContent = match[1] || "";
    const item = parseXmlObject(itemContent);
    items.push(item);
  }

  return items;
}

/**
 * Parse XML content into an object
 */
function parseXmlObject(content: string): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  // Match simple tags: <tag>value</tag>
  const tagRegex = /<([a-zA-Z0-9_]+)[^>]*>([^<]*)<\/\1>/g;
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    const tag = match[1];
    const value = match[2];
    if (tag && value !== undefined) {
      obj[tag] = decodeXmlEntities(value.trim());
    }
  }

  // Match CDATA sections: <tag><![CDATA[value]]></tag>
  // Handle multiple elements with same tag (e.g., multiple <image> elements)
  const cdataRegex = /<([a-zA-Z0-9_]+)[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/\1>/g;

  while ((match = cdataRegex.exec(content)) !== null) {
    const tag = match[1];
    const value = match[2];
    if (tag && value !== undefined) {
      const trimmedValue = value.trim();
      // If tag already exists, convert to array or push to existing array
      if (obj[tag] !== undefined) {
        if (Array.isArray(obj[tag])) {
          (obj[tag] as string[]).push(trimmedValue);
        } else {
          obj[tag] = [obj[tag] as string, trimmedValue];
        }
      } else {
        obj[tag] = trimmedValue;
      }
    }
  }

  // Match multiple elements with same tag (create array)
  const multiTagRegex = /<([a-zA-Z0-9_]+)[^>]*>([^<]*)<\/\1>/g;
  const counts: Record<string, number> = {};

  for (const key of Object.keys(obj)) {
    counts[key] = 0;
  }

  let m;
  const tempContent = content;
  const multiRegex = new RegExp(`<([a-zA-Z0-9_]+)[^>]*>([^<]*)<\\/\\1>`, "g");

  while ((m = multiRegex.exec(tempContent)) !== null) {
    const tag = m[1];
    const value = m[2];
    if (!tag) continue;

    counts[tag] = (counts[tag] || 0) + 1;

    if (counts[tag] > 1 && value !== undefined) {
      // Convert to array if multiple occurrences
      if (!Array.isArray(obj[tag])) {
        obj[tag] = [obj[tag]];
      }
      (obj[tag] as unknown[]).push(decodeXmlEntities(value.trim()));
    }
  }

  return obj;
}

/**
 * Decode XML entities
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Parse a CSV line respecting quoted fields
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Zip headers and values into an object
 */
function zipToObject(headers: string[], values: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (header) {
      obj[header] = values[i] || "";
    }
  }
  return obj;
}

/**
 * Map an XML item to a product
 */
function mapXmlItemToProduct(
  item: Record<string, unknown>,
  mapping: FeedMapping,
  rowIndex: number
): ParsedProduct | null {
  return mapObjectToProduct(item, mapping, rowIndex);
}

/**
 * Map an object (from XML, CSV, or JSON) to a ParsedProduct
 */
function mapObjectToProduct(
  item: Record<string, unknown>,
  mapping: FeedMapping,
  rowIndex: number
): ParsedProduct | null {
  const fields = mapping.fields || {};
  const options = mapping.options || {};

  // Get required fields (trim to catch whitespace-only values)
  const skuRaw = getFieldValue(item, fields.sku || "sku") || getFieldValue(item, "code") || getFieldValue(item, "erp_id");
  const nameRaw = getFieldValue(item, fields.name || "name") || getFieldValue(item, "title");
  const priceRaw = getFieldValue(item, fields.price || "price");
  const salePriceRaw = fields.salePrice ? getFieldValue(item, fields.salePrice) : undefined;

  const sku = skuRaw ? String(skuRaw).trim() : "";
  const name = nameRaw ? String(nameRaw).trim() : "";

  if (!sku || !name) {
    throw new Error(`Missing required field: ${!sku ? "sku" : "name"}`);
  }

  const regularPrice = parsePrice(priceRaw, options);
  if (regularPrice === null || isNaN(regularPrice)) {
    throw new Error(`Invalid price value: ${priceRaw}`);
  }

  // Handle sale price: if salePrice is valid and less than regular price, use it as the actual price
  // This is common in feeds where "price" is the original/compare price and "salePrice" is the discounted price
  let price = regularPrice;
  let salePriceUsed = false;
  if (salePriceRaw) {
    const parsedSalePrice = parsePrice(salePriceRaw, options);
    if (parsedSalePrice !== null && !isNaN(parsedSalePrice) && parsedSalePrice > 0 && parsedSalePrice < regularPrice) {
      price = parsedSalePrice;
      salePriceUsed = true;
    }
  }

  // Build product
  const product: ParsedProduct = {
    sku,
    name,
    price,
    currency: String(getFieldValue(item, fields.currency || "currency") || options.defaultCurrency || "USD"),
  };

  // Optional fields
  const description = getFieldValue(item, fields.description || "description");
  if (description) {
    product.description = applyTransforms(String(description), "description", mapping.transforms || []);
  }

  const brand = getFieldValue(item, fields.brand || "brand") || getFieldValue(item, "vendor");
  if (brand) product.brand = String(brand).trim();

  const productType = getFieldValue(item, fields.productType || "productType") || getFieldValue(item, "product_type");
  if (productType) {
    let processedType = String(productType).trim();

    // Split by delimiter to get first category path (e.g., comma-separated categories)
    const productTypeDelimiter = options.productTypeDelimiter;
    if (productTypeDelimiter) {
      const parts = processedType.split(productTypeDelimiter).map((p) => p.trim()).filter(Boolean);
      processedType = parts[0] || processedType;
    }

    // Extract last segment from hierarchical path (e.g., "Default Category/Jucarii/Puzzle" -> "Puzzle")
    const pathSeparator = options.productTypePathSeparator;
    if (pathSeparator) {
      const segments = processedType.split(pathSeparator).map((s) => s.trim()).filter(Boolean);
      // Use the last non-empty segment
      processedType = segments[segments.length - 1] || processedType;
    }

    product.productType = processedType;
  }

  // Tags handling
  const tagsValue = getFieldValue(item, fields.tags || "tags");
  if (tagsValue) {
    const tagDelimiter = options.tagDelimiter || ",";
    if (Array.isArray(tagsValue)) {
      product.tags = tagsValue.map((t) => String(t).trim());
    } else {
      product.tags = String(tagsValue).split(tagDelimiter).map((t) => t.trim()).filter(Boolean);
    }
  }

  const barcode = getFieldValue(item, fields.barcode || "barcode") || getFieldValue(item, "gtin");
  if (barcode) product.barcode = String(barcode).trim();

  // Handle compareAtPrice:
  // 1. If explicitly mapped and greater than price, use that value
  // 2. If salePrice was used, set compareAtPrice to the original regular price
  // Note: compareAtPrice only makes sense if it's greater than price (shows a discount)
  const compareAtPriceRaw = getFieldValue(item, fields.compareAtPrice || "compareAtPrice");
  if (compareAtPriceRaw) {
    const parsedCompare = parsePrice(compareAtPriceRaw, options);
    // Only set if valid and greater than price (otherwise no discount to show)
    if (parsedCompare !== null && parsedCompare > price) {
      product.compareAtPrice = parsedCompare;
    }
  } else if (salePriceUsed) {
    // When salePrice is the actual price, the original price becomes the compare-at price
    product.compareAtPrice = regularPrice;
  }

  const costPrice = getFieldValue(item, fields.costPrice || "costPrice");
  if (costPrice) {
    const parsedCost = parsePrice(costPrice, options);
    if (parsedCost !== null) product.costPrice = parsedCost;
  }

  // Quantity handling - can be numeric, text status (Romanian/English), or binary (1/0)
  const quantityValue = getFieldValue(item, fields.quantity || "quantity");
  const stockStatus = getFieldValue(item, fields.stockStatus || "stock_status") || getFieldValue(item, "stock");

  // Try to parse quantity from the quantity field first
  if (quantityValue !== undefined && quantityValue !== null) {
    const parsedQty = parseStockValue(quantityValue, options.stockStatusMapping);
    if (parsedQty !== null) {
      product.quantity = parsedQty;
    }
  }

  // If no quantity from primary field, try stock status field
  if (product.quantity === undefined && stockStatus !== undefined && stockStatus !== null) {
    const parsedQty = parseStockValue(stockStatus, options.stockStatusMapping);
    if (parsedQty !== null) {
      product.quantity = parsedQty;
    }
  }

  // Fall back to default quantity if still not set
  if (product.quantity === undefined && options.defaultQuantity !== undefined) {
    product.quantity = options.defaultQuantity;
  }

  // Images handling
  const allImages: string[] = [];
  const imageDelimiter = options.imageDelimiter || ",";

  // Helper to extract images from a value (handles JSON arrays, regular arrays, and delimited strings)
  const extractImages = (value: unknown): string[] => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value.map((img) => String(img).trim()).filter(Boolean);
    }

    const strValue = String(value).trim();
    if (!strValue) return [];

    // Check if it's a JSON array
    if (strValue.startsWith('[') && strValue.endsWith(']')) {
      try {
        const parsed = JSON.parse(strValue);
        if (Array.isArray(parsed)) {
          return parsed.map((img) => String(img).trim()).filter(Boolean);
        }
      } catch {
        // Not valid JSON, fall through to delimiter split
      }
    }

    return strValue.split(imageDelimiter).map((img) => img.trim()).filter(Boolean);
  };

  // Get main image(s)
  const imagesValue = getFieldValue(item, fields.images || "images") || getFieldValue(item, "image");
  allImages.push(...extractImages(imagesValue));

  // Get additional images from a single field (e.g., "Gallery Images" column)
  if (fields.additionalImages) {
    const additionalImagesValue = getFieldValue(item, fields.additionalImages);
    allImages.push(...extractImages(additionalImagesValue));
  }

  // Merge additional image fields by column name (e.g., imagine_1, imagine_2, etc.)
  const additionalImageFields = options.additionalImageFields as string[] | undefined;
  if (additionalImageFields && Array.isArray(additionalImageFields)) {
    for (const fieldName of additionalImageFields) {
      const imgValue = getFieldValue(item, fieldName);
      allImages.push(...extractImages(imgValue));
    }
  }

  // Deduplicate images while preserving order
  if (allImages.length > 0) {
    product.images = [...new Set(allImages)];
  }

  return product;
}

/**
 * Get a field value from an object, supporting nested paths
 */
function getFieldValue(obj: Record<string, unknown>, fieldPath: string): unknown {
  if (!fieldPath) return undefined;

  const parts = fieldPath.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Parse a price value handling different formats
 */
function parsePrice(
  value: unknown,
  options: FeedMapping["options"]
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  let strValue = String(value).trim();

  // Remove currency symbols
  strValue = strValue.replace(/[^0-9.,\-]/g, "");

  // Handle decimal/thousand separators
  const decimalSep = options?.priceDecimalSeparator || ".";
  const thousandSep = options?.priceThousandSeparator || ",";

  if (decimalSep === ",") {
    // European format: 1.234,56 -> 1234.56
    strValue = strValue.replace(/\./g, "").replace(",", ".");
  } else if (thousandSep === ".") {
    // Some formats use . as thousand separator
    strValue = strValue.replace(/\./g, "");
  } else {
    // Standard format: remove thousand separators
    strValue = strValue.replace(/,/g, "");
  }

  const parsed = parseFloat(strValue);
  return isNaN(parsed) ? null : parsed;
}

// ============================================
// Predefined Stock Status Mappings
// ============================================

/**
 * Romanian stock status strings commonly found in feeds
 * Maps text values to quantity numbers
 */
const ROMANIAN_STOCK_MAPPINGS: Record<string, number> = {
  // Romanian - No stock
  "fără stoc": 0,
  "fara stoc": 0,
  "indisponibil": 0,
  "stoc epuizat": 0,
  "epuizat": 0,
  "nu este pe stoc": 0,
  "out of stock": 0,
  "nu": 0,

  // Romanian - In stock (default quantity: 25)
  "în stoc": 25,
  "in stoc": 25,
  "disponibil": 25,
  "pe stoc": 25,
  "in stock": 25,
  "da": 25,

  // Romanian - Limited stock (default quantity: 10)
  "stoc limitat": 10,
  "stoc redus": 10,
  "ultimele bucăți": 10,
  "ultimele bucati": 10,
  "limited stock": 10,
  "low stock": 10,

  // Romanian - Pre-order / Backorder
  "precomandă": 5,
  "precomanda": 5,
  "la comandă": 5,
  "la comanda": 5,
};

/**
 * Binary stock values (for feeds like bebebrands, babysafe)
 * "1" = in stock, "0" = out of stock
 */
const BINARY_STOCK_MAPPINGS: Record<string, number> = {
  "1": 25,
  "0": 0,
  "true": 25,
  "false": 0,
  "yes": 25,
  "no": 0,
};

/**
 * Parse stock value from various formats
 * Handles: numeric, Romanian strings, binary (1/0), custom mappings
 */
function parseStockValue(
  value: unknown,
  customMapping?: Record<string, number>
): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const strValue = String(value).trim();
  if (strValue === "") {
    return null;
  }

  // Try to parse as number first
  const numericValue = parseFloat(strValue);
  if (!isNaN(numericValue)) {
    return Math.floor(numericValue);
  }

  // Normalize for lookup (lowercase, trim)
  const normalized = strValue.toLowerCase().trim();

  // Check custom mapping first (if provided)
  if (customMapping) {
    const customMatch = customMapping[normalized];
    if (customMatch !== undefined) {
      return customMatch;
    }
  }

  // Check binary stock values (1/0, true/false, yes/no)
  const binaryMatch = BINARY_STOCK_MAPPINGS[normalized];
  if (binaryMatch !== undefined) {
    return binaryMatch;
  }

  // Check Romanian stock mappings
  const romanianMatch = ROMANIAN_STOCK_MAPPINGS[normalized];
  if (romanianMatch !== undefined) {
    return romanianMatch;
  }

  // No match found
  return null;
}

/**
 * Apply transforms to a field value
 */
function applyTransforms(
  value: string,
  fieldName: string,
  transforms: FeedTransform[]
): string {
  const fieldTransforms = transforms.filter((t) => t.field === fieldName);

  let result = value;

  for (const transform of fieldTransforms) {
    switch (transform.type) {
      case "trim":
        result = result.trim();
        break;

      case "lowercase":
        result = result.toLowerCase();
        break;

      case "uppercase":
        result = result.toUpperCase();
        break;

      case "strip_html":
        result = result.replace(/<[^>]*>/g, "");
        break;

      case "decode_entities":
        result = decodeXmlEntities(result);
        break;

      case "regex_replace":
        if (transform.params?.pattern) {
          const regex = new RegExp(transform.params.pattern, transform.params.flags || "g");
          result = result.replace(regex, transform.params.replacement || "");
        }
        break;

      case "prefix":
        if (transform.params?.value) {
          result = transform.params.value + result;
        }
        break;

      case "suffix":
        if (transform.params?.value) {
          result = result + transform.params.value;
        }
        break;

      case "split_first":
        if (transform.params?.delimiter) {
          const parts = result.split(transform.params.delimiter);
          result = parts[0] || result;
        }
        break;

      case "default":
        if (!result && transform.params?.value) {
          result = transform.params.value;
        }
        break;
    }
  }

  return result;
}
