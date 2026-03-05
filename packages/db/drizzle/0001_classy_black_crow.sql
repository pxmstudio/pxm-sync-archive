CREATE TABLE IF NOT EXISTS "feed_subscription_sync_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"sync_enabled" text DEFAULT 'false' NOT NULL,
	"sync_interval_hours" text DEFAULT '24',
	"filter_rules" jsonb DEFAULT '{}'::jsonb,
	"category_mappings" jsonb DEFAULT '[]'::jsonb,
	"pricing_margin" jsonb,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"last_sync_product_count" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_subscription_sync_settings_unique" UNIQUE("subscription_id","integration_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feed_synced_products" (
	"id" text PRIMARY KEY NOT NULL,
	"sync_settings_id" text NOT NULL,
	"source_product_id" text NOT NULL,
	"source_variant_id" text NOT NULL,
	"external_product_id" text,
	"external_variant_id" text,
	"sync_status" "sync_product_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_synced_products_variant_unique" UNIQUE("sync_settings_id","source_variant_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feed_subscription_sync_settings" ADD CONSTRAINT "feed_subscription_sync_settings_subscription_id_feed_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."feed_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feed_subscription_sync_settings" ADD CONSTRAINT "feed_subscription_sync_settings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feed_synced_products" ADD CONSTRAINT "feed_synced_products_sync_settings_id_feed_subscription_sync_settings_id_fk" FOREIGN KEY ("sync_settings_id") REFERENCES "public"."feed_subscription_sync_settings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feed_synced_products" ADD CONSTRAINT "feed_synced_products_source_product_id_products_id_fk" FOREIGN KEY ("source_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "feed_synced_products" ADD CONSTRAINT "feed_synced_products_source_variant_id_variants_id_fk" FOREIGN KEY ("source_variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_subscription_sync_settings_subscription_idx" ON "feed_subscription_sync_settings" USING btree ("subscription_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_subscription_sync_settings_integration_idx" ON "feed_subscription_sync_settings" USING btree ("integration_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_subscription_sync_settings_enabled_idx" ON "feed_subscription_sync_settings" USING btree ("sync_enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_synced_products_sync_settings_idx" ON "feed_synced_products" USING btree ("sync_settings_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_synced_products_source_product_idx" ON "feed_synced_products" USING btree ("source_product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_synced_products_status_idx" ON "feed_synced_products" USING btree ("sync_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_synced_products_external_product_idx" ON "feed_synced_products" USING btree ("external_product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_synced_products_external_variant_idx" ON "feed_synced_products" USING btree ("external_variant_id");
