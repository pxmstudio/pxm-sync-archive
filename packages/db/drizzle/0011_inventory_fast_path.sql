-- Add external inventory item ID for fast-path inventory updates
-- This allows us to use Shopify's Inventory API directly instead of productSet
ALTER TABLE "feed_synced_products" ADD COLUMN IF NOT EXISTS "external_inventory_item_id" text;

-- Index for inventory lookups
CREATE INDEX IF NOT EXISTS "feed_synced_products_inventory_item_idx" ON "feed_synced_products" ("external_inventory_item_id");
