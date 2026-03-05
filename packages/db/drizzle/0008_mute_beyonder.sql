ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "content_hash" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "core_hash" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "images_hash" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "variants_hash" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "change_type" text;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "previous_quantity" integer;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "feed_subscription_sync_settings" ADD COLUMN IF NOT EXISTS "settings_hash" text;--> statement-breakpoint
ALTER TABLE "feed_subscription_sync_settings" ADD COLUMN IF NOT EXISTS "settings_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "feed_synced_products" ADD COLUMN IF NOT EXISTS "last_synced_content_hash" text;--> statement-breakpoint
ALTER TABLE "feed_synced_products" ADD COLUMN IF NOT EXISTS "last_synced_settings_hash" text;--> statement-breakpoint
ALTER TABLE "feed_synced_products" ADD COLUMN IF NOT EXISTS "last_synced_inventory_hash" text;--> statement-breakpoint
ALTER TABLE "feed_synced_products" ADD COLUMN IF NOT EXISTS "last_inventory_sync_at" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_changed_at_idx" ON "products" USING btree ("feed_id","changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_change_type_idx" ON "products" USING btree ("feed_id","change_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_changed_at_idx" ON "inventory" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_synced_products_content_hash_idx" ON "feed_synced_products" USING btree ("sync_settings_id","last_synced_content_hash");