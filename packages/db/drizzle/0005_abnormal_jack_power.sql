DO $$ BEGIN
  CREATE TYPE "public"."store_sync_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'partial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "store_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"sync_settings_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"feed_id" text NOT NULL,
	"trigger_run_id" text,
	"sync_type" text NOT NULL,
	"status" "store_sync_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"products_processed" integer DEFAULT 0 NOT NULL,
	"products_created" integer DEFAULT 0 NOT NULL,
	"products_updated" integer DEFAULT 0 NOT NULL,
	"products_skipped" integer DEFAULT 0 NOT NULL,
	"products_failed" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"errors" jsonb,
	"triggered_by" text NOT NULL,
	"triggered_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store_sync_runs" ADD CONSTRAINT "store_sync_runs_sync_settings_id_feed_subscription_sync_settings_id_fk" FOREIGN KEY ("sync_settings_id") REFERENCES "public"."feed_subscription_sync_settings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store_sync_runs" ADD CONSTRAINT "store_sync_runs_subscription_id_feed_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."feed_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store_sync_runs" ADD CONSTRAINT "store_sync_runs_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "store_sync_runs" ADD CONSTRAINT "store_sync_runs_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_sync_runs_settings_idx" ON "store_sync_runs" USING btree ("sync_settings_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_sync_runs_subscription_idx" ON "store_sync_runs" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_sync_runs_integration_idx" ON "store_sync_runs" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_sync_runs_feed_idx" ON "store_sync_runs" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_sync_runs_started_idx" ON "store_sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "store_sync_runs_status_idx" ON "store_sync_runs" USING btree ("status");
