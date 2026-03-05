-- Add change breakdown tracking to feed subscription sync settings
ALTER TABLE "feed_subscription_sync_settings" ADD COLUMN IF NOT EXISTS "last_sync_change_breakdown" jsonb;

-- Add change breakdown to store sync runs for historical tracking
ALTER TABLE "store_sync_runs" ADD COLUMN IF NOT EXISTS "change_breakdown" jsonb;
