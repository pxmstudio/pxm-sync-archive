CREATE TABLE IF NOT EXISTS "shopify_store_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"vendors" jsonb DEFAULT '[]'::jsonb,
	"product_types" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"product_count" text,
	"last_refreshed_at" timestamp,
	"refresh_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shopify_store_metadata_integration_id_unique" UNIQUE("integration_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shopify_store_metadata" ADD CONSTRAINT "shopify_store_metadata_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shopify_store_metadata_integration_idx" ON "shopify_store_metadata" USING btree ("integration_id");