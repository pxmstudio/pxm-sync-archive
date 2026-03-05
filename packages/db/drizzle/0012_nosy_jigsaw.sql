DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'connection_sync_settings' AND column_name = 'category_mappings') THEN
    ALTER TABLE "connection_sync_settings" RENAME COLUMN "category_mappings" TO "field_mappings";
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_subscription_sync_settings' AND column_name = 'category_mappings') THEN
    ALTER TABLE "feed_subscription_sync_settings" RENAME COLUMN "category_mappings" TO "field_mappings";
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "feed_subscription_sync_settings" ADD COLUMN IF NOT EXISTS "last_sync_change_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "feed_synced_products" ADD COLUMN IF NOT EXISTS "external_inventory_item_id" text;--> statement-breakpoint
ALTER TABLE "store_sync_runs" ADD COLUMN IF NOT EXISTS "change_breakdown" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_synced_products_inventory_item_idx" ON "feed_synced_products" USING btree ("external_inventory_item_id");