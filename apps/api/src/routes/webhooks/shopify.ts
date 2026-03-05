import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import {
  integrations,
  products,
  variants,
  inventory,
  events,
  organizations,
  brands,
  productTags,
  productTypes,
} from "@workspace/db";
import { success } from "../../lib/response.js";
import { Errors } from "../../lib/errors.js";
import { dispatchWebhooks } from "../../lib/webhooks.js";
import type { Env, Variables } from "../../types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

// Verify Shopify webhook signature
async function verifyShopifyWebhook(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body)
    );

    const computed = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
    return computed === signature;
  } catch {
    return false;
  }
}

// POST /webhooks/shopify - Handle Shopify webhooks
app.post("/", async (c) => {
  const db = c.get("db");

  // Get headers
  const shopDomain = c.req.header("X-Shopify-Shop-Domain");
  const topic = c.req.header("X-Shopify-Topic");
  const hmac = c.req.header("X-Shopify-Hmac-Sha256");

  if (!shopDomain || !topic || !hmac) {
    throw Errors.badRequest("Missing required Shopify headers");
  }

  // Find integration by shop domain
  const integration = await db.query.integrations.findFirst({
    where: eq(integrations.externalIdentifier, shopDomain),
  });

  if (!integration) {
    console.log(`Unknown shop: ${shopDomain}`);
    return success(c, { received: true, processed: false });
  }

  // Verify webhook signature
  const body = await c.req.text();
  const webhookSecret = integration.webhookSecretRef;

  if (webhookSecret) {
    const isValid = await verifyShopifyWebhook(body, hmac, webhookSecret);
    if (!isValid) {
      throw Errors.unauthorized("Invalid webhook signature");
    }
  }

  const payload = JSON.parse(body);

  // Route to appropriate handler based on topic
  switch (topic) {
    case "products/create":
    case "products/update":
      await handleProductWebhook(db, integration, payload);
      break;

    case "products/delete":
      await handleProductDelete(db, integration, payload);
      break;

    case "inventory_levels/update":
      await handleInventoryWebhook(db, integration, payload);
      break;

    case "app/uninstalled":
      await handleAppUninstalled(db, integration);
      break;

    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }

  return success(c, { received: true, processed: true });
});

// Handle product create/update webhook
async function handleProductWebhook(
  db: ReturnType<typeof import("@workspace/db").createDb>,
  integration: { id: string; organizationId: string },
  payload: {
    id: number;
    title: string;
    body_html: string;
    vendor: string;
    product_type: string;
    tags: string;
    images: Array<{ src: string; alt: string; position: number }>;
    variants: Array<{
      id: number;
      title: string;
      sku: string;
      price: string;
      compare_at_price: string | null;
      weight: number;
      weight_unit: string;
      inventory_quantity: number;
    }>;
  }
) {
  // Get supplier's default currency
  const supplier = await db.query.organizations.findFirst({
    where: eq(organizations.id, integration.organizationId),
    columns: { defaultCurrency: true },
  });
  const supplierCurrency = supplier?.defaultCurrency || "USD";

  const externalId = `gid://shopify/Product/${payload.id}`;

  // Check if product exists
  const existing = await db.query.products.findFirst({
    where: eq(products.externalId, externalId),
  });

  const parsedTags = payload.tags ? payload.tags.split(", ").filter(t => t.trim()) : [];

  const productData = {
    supplierId: integration.organizationId,
    externalId,
    name: payload.title,
    description: payload.body_html,
    brand: payload.vendor,
    productType: payload.product_type,
    tags: parsedTags,
    images: payload.images.map((img) => ({
      url: img.src,
      altText: img.alt,
      position: img.position,
    })),
    syncedAt: new Date(),
    updatedAt: new Date(),
  };

  let productId: string;

  if (existing) {
    // Update existing product
    await db
      .update(products)
      .set(productData)
      .where(eq(products.id, existing.id));
    productId = existing.id;
  } else {
    // Create new product
    const [newProduct] = await db
      .insert(products)
      .values({
        ...productData,
        isActive: "true",
      })
      .returning();
    productId = newProduct!.id;
  }

  // Upsert variants
  for (const v of payload.variants) {
    const variantExternalId = `gid://shopify/ProductVariant/${v.id}`;

    const existingVariant = await db.query.variants.findFirst({
      where: eq(variants.externalId, variantExternalId),
    });

    const variantData = {
      productId,
      externalId: variantExternalId,
      name: v.title,
      sku: v.sku,
      price: v.price,
      compareAtPrice: v.compare_at_price,
      weight: v.weight?.toString(),
      weightUnit: v.weight_unit || "kg",
      currency: supplierCurrency,
      updatedAt: new Date(),
    };

    let variantId: string;

    if (existingVariant) {
      await db
        .update(variants)
        .set(variantData)
        .where(eq(variants.id, existingVariant.id));
      variantId = existingVariant.id;
    } else {
      const [newVariant] = await db
        .insert(variants)
        .values(variantData)
        .returning();
      variantId = newVariant!.id;
    }

    // Upsert inventory
    const existingInventory = await db.query.inventory.findFirst({
      where: eq(inventory.variantId, variantId),
    });

    if (existingInventory) {
      await db
        .update(inventory)
        .set({
          quantity: v.inventory_quantity,
          updatedAt: new Date(),
        })
        .where(eq(inventory.id, existingInventory.id));
    } else {
      await db.insert(inventory).values({
        variantId,
        quantity: v.inventory_quantity,
        reserved: 0,
      });
    }
  }

  // Sync brand if present
  if (payload.vendor && payload.vendor.trim()) {
    const brandName = payload.vendor.trim();
    const existingBrand = await db.query.brands.findFirst({
      where: and(
        eq(brands.supplierId, integration.organizationId),
        eq(brands.name, brandName)
      ),
    });

    if (!existingBrand) {
      await db.insert(brands).values({
        supplierId: integration.organizationId,
        name: brandName,
        slug: generateSlug(brandName),
        productCount: "1",
      });
    }
  }

  // Sync tags if present
  for (const tag of parsedTags) {
    if (!tag.trim()) continue;
    const tagName = tag.trim();

    const existingTag = await db.query.productTags.findFirst({
      where: and(
        eq(productTags.supplierId, integration.organizationId),
        eq(productTags.name, tagName)
      ),
    });

    if (!existingTag) {
      await db.insert(productTags).values({
        supplierId: integration.organizationId,
        name: tagName,
        slug: generateSlug(tagName),
        productCount: "1",
      });
    }
  }

  // Sync product type if present
  if (payload.product_type && payload.product_type.trim()) {
    const typeName = payload.product_type.trim();
    const existingType = await db.query.productTypes.findFirst({
      where: and(
        eq(productTypes.supplierId, integration.organizationId),
        eq(productTypes.name, typeName)
      ),
    });

    if (!existingType) {
      await db.insert(productTypes).values({
        supplierId: integration.organizationId,
        name: typeName,
        slug: generateSlug(typeName),
        productCount: "1",
      });
    }
  }

  // Create event
  await db.insert(events).values({
    organizationId: integration.organizationId,
    type: existing ? "product.updated" : "product.created",
    entityType: "product",
    entityId: productId,
    payload: { externalId, variantCount: payload.variants.length },
  });

  // Dispatch webhook to supplier organization
  // Use product externalId as stable eventId for deduplication
  dispatchWebhooks(
    db,
    integration.organizationId,
    existing ? "product.updated" : "product.created",
    {
      product: {
        id: productId,
        externalId,
        name: payload.title,
        vendor: payload.vendor,
        productType: payload.product_type,
        variantCount: payload.variants.length,
      },
      source: "shopify_sync",
    },
    { eventId: `product-${existing ? "updated" : "created"}-${externalId}` }
  );
}

// Handle product delete webhook
async function handleProductDelete(
  db: ReturnType<typeof import("@workspace/db").createDb>,
  integration: { id: string; organizationId: string },
  payload: { id: number }
) {
  const externalId = `gid://shopify/Product/${payload.id}`;

  const existing = await db.query.products.findFirst({
    where: eq(products.externalId, externalId),
  });

  if (existing) {
    // Soft delete by deactivating
    await db
      .update(products)
      .set({
        isActive: "false",
        updatedAt: new Date(),
      })
      .where(eq(products.id, existing.id));

    // Create event
    await db.insert(events).values({
      organizationId: integration.organizationId,
      type: "product.deleted",
      entityType: "product",
      entityId: existing.id,
      payload: { externalId },
    });

    // Dispatch webhook to supplier organization
    dispatchWebhooks(db, integration.organizationId, "product.deleted", {
      product: {
        id: existing.id,
        externalId,
      },
      source: "shopify_sync",
    }, { eventId: `product-deleted-${externalId}` });
  }
}

// Handle inventory level update webhook
// This catches inventory changes from B2C orders, manual adjustments, returns, etc.
// Note: We still sync inventory data internally but don't emit webhook events for it
async function handleInventoryWebhook(
  db: ReturnType<typeof import("@workspace/db").createDb>,
  _integration: { id: string; organizationId: string },
  payload: {
    inventory_item_id: number;
    available: number;
    location_id?: number;
  }
) {
  const inventoryItemId = payload.inventory_item_id.toString();

  // Find variant by inventoryItemId
  const variant = await db.query.variants.findFirst({
    where: eq(variants.inventoryItemId, inventoryItemId),
    with: {
      inventory: true,
    },
  });

  if (!variant) {
    console.log(`No variant found for inventoryItemId: ${inventoryItemId}`);
    return;
  }

  // Update PXM inventory to match Shopify's value
  // This is idempotent - we just set quantity to Shopify's available count
  if (variant.inventory) {
    await db
      .update(inventory)
      .set({
        quantity: payload.available,
        updatedAt: new Date(),
      })
      .where(eq(inventory.id, variant.inventory.id));
  } else {
    // Create inventory record if it doesn't exist
    await db.insert(inventory).values({
      variantId: variant.id,
      quantity: payload.available,
      reserved: 0,
    });
  }

  console.log(
    `Updated inventory for variant ${variant.id} (SKU: ${variant.sku}): ${payload.available}`
  );
}

// Handle app uninstalled webhook
async function handleAppUninstalled(
  db: ReturnType<typeof import("@workspace/db").createDb>,
  integration: { id: string; organizationId: string }
) {
  // Deactivate integration
  await db
    .update(integrations)
    .set({
      isActive: "false",
      credentialsRef: null,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id));
}

export default app;
