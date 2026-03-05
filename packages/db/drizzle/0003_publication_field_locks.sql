-- Migration: Add publication_override and field_locks to feed_subscription_sync_settings
-- These columns support:
-- 1. Publication/sales channel management (which Shopify channels to publish synced products to)
-- 2. Field lock system (per-product field overrides via Shopify metafields)

-- Add field_locks column
ALTER TABLE "feed_subscription_sync_settings"
ADD COLUMN IF NOT EXISTS "field_locks" jsonb;

-- Add publication_override column
ALTER TABLE "feed_subscription_sync_settings"
ADD COLUMN IF NOT EXISTS "publication_override" jsonb;

-- Note: Integration settings already has a JSONB column that can store publications
-- No schema change needed for integrations table
