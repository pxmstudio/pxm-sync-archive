DO $$ BEGIN
  ALTER TABLE "feed_subscription_sync_settings" ADD COLUMN "sku_prefix" text;
EXCEPTION WHEN duplicate_column THEN null;
END $$;
