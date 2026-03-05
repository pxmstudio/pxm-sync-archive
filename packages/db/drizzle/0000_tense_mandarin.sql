CREATE TYPE "public"."address_type" AS ENUM('billing', 'shipping', 'warehouse', 'store', 'headquarters', 'fulfillment_center', 'return');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('pending', 'active', 'suspended', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('inventory.updated', 'product.created', 'product.updated', 'product.deleted', 'connection.requested', 'connection.approved', 'connection.rejected', 'connection.suspended');--> statement-breakpoint
CREATE TYPE "public"."feed_schedule" AS ENUM('hourly', 'daily', 'weekly', 'manual');--> statement-breakpoint
CREATE TYPE "public"."feed_status" AS ENUM('pending', 'mapping', 'active', 'paused', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."feed_sync_status" AS ENUM('pending', 'running', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."feed_type" AS ENUM('xml', 'csv', 'json');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('shopify', 'custom');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('supplier', 'retailer');--> statement-breakpoint
CREATE TYPE "public"."sync_product_status" AS ENUM('pending', 'synced', 'failed', 'deleted');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"external_auth_id" text NOT NULL,
	"roles" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"website" text,
	"description" text,
	"contact_first_name" text,
	"contact_last_name" text,
	"contact_email" text,
	"contact_phone" text,
	"is_public" boolean DEFAULT false,
	"public_description" text,
	"default_currency" text DEFAULT 'USD',
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "organizations_external_auth_id_unique" UNIQUE("external_auth_id"),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"external_auth_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_external_auth_id_unique" UNIQUE("external_auth_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"product_count" text DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"product_count" text DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_types" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"product_count" text DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text,
	"feed_id" text,
	"external_id" text,
	"sku" text,
	"name" text NOT NULL,
	"description" text,
	"brand" text,
	"product_type" text,
	"tags" text[] DEFAULT '{}',
	"images" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_active" text DEFAULT 'true' NOT NULL,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "products_single_owner" CHECK (("products"."supplier_id" IS NOT NULL AND "products"."feed_id" IS NULL) OR ("products"."supplier_id" IS NULL AND "products"."feed_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"external_id" text,
	"inventory_item_id" text,
	"sku" text,
	"name" text NOT NULL,
	"barcode" text,
	"price" numeric(12, 2) NOT NULL,
	"compare_at_price" numeric(12, 2),
	"cost_price" numeric(12, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"weight" numeric(10, 2),
	"weight_unit" text DEFAULT 'kg',
	"measurement_type" text,
	"quantity_value" numeric(10, 2),
	"quantity_unit" text,
	"reference_value" numeric(10, 2),
	"reference_unit" text,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"position" text DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_products" (
	"collection_id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" text DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_products_collection_id_product_id_pk" PRIMARY KEY("collection_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"handle" text NOT NULL,
	"description" text,
	"image_url" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_variant_unique" UNIQUE("variant_id")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"retailer_id" text NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "connection_pair_unique" UNIQUE("supplier_id","retailer_id"),
	CONSTRAINT "no_self_connection" CHECK ("connections"."supplier_id" != "connections"."retailer_id")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"name" text NOT NULL,
	"external_identifier" text,
	"oauth_client_id" text,
	"credentials_ref" text,
	"webhook_secret_ref" text,
	"scopes" text[] DEFAULT '{}',
	"settings" jsonb DEFAULT '{}'::jsonb,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"is_active" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_cursors" (
	"id" text PRIMARY KEY NOT NULL,
	"integration_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"cursor" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}',
	"last_used_at" timestamp,
	"last_used_ip" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" "event_type" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"event_id" text,
	"url" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"status_code" text,
	"response_body" text,
	"response_time_ms" text,
	"success" boolean NOT NULL,
	"error_message" text,
	"attempt" text DEFAULT '1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"url" text NOT NULL,
	"event_types" text[] NOT NULL,
	"secret_ref" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"failure_count" text DEFAULT '0',
	"last_failure_at" timestamp,
	"last_failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"purpose" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"is_public" boolean DEFAULT false,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uploaded_files_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "organization_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"label" text NOT NULL,
	"type" "address_type" NOT NULL,
	"is_default" boolean DEFAULT false,
	"first_name" text,
	"last_name" text,
	"company" text,
	"address_1" text NOT NULL,
	"address_2" text,
	"city" text NOT NULL,
	"state" text,
	"postal_code" text NOT NULL,
	"country" text NOT NULL,
	"phone" text,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connection_sync_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"sync_enabled" text DEFAULT 'false' NOT NULL,
	"sync_interval_hours" text DEFAULT '24',
	"filter_rules" jsonb DEFAULT '{}'::jsonb,
	"category_mappings" jsonb DEFAULT '[]'::jsonb,
	"price_adjustment" jsonb,
	"pricing_margin" jsonb,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"last_sync_product_count" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "connection_sync_settings_unique" UNIQUE("connection_id","integration_id")
);
--> statement-breakpoint
CREATE TABLE "synced_products" (
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
	CONSTRAINT "synced_products_variant_unique" UNIQUE("sync_settings_id","source_variant_id")
);
--> statement-breakpoint
CREATE TABLE "feed_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_id" text,
	"retailer_id" text NOT NULL,
	"supplier_name" text,
	"supplier_website" text,
	"notes" text,
	"feed_url" text,
	"feed_file_key" text,
	"credentials_provided" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_requests_feed_retailer_unique" UNIQUE("feed_id","retailer_id")
);
--> statement-breakpoint
CREATE TABLE "feed_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_id" text NOT NULL,
	"feed_type" "feed_type" NOT NULL,
	"feed_url" text,
	"feed_file_key" text,
	"requires_auth" boolean DEFAULT false NOT NULL,
	"credentials_ref" text,
	"schedule" "feed_schedule" DEFAULT 'daily' NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_status" "feed_sync_status",
	"last_sync_error" text,
	"last_sync_product_count" integer,
	"last_sync_duration_ms" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_id" text NOT NULL,
	"retailer_id" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"verified_at" timestamp DEFAULT now() NOT NULL,
	"disconnected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feed_subscriptions_feed_retailer_unique" UNIQUE("feed_id","retailer_id")
);
--> statement-breakpoint
CREATE TABLE "feed_sync_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_source_id" text NOT NULL,
	"status" "feed_sync_status" NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"products_processed" integer DEFAULT 0,
	"products_created" integer DEFAULT 0,
	"products_updated" integer DEFAULT 0,
	"products_failed" integer DEFAULT 0,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"triggered_by" text,
	"triggered_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"website" text,
	"logo_url" text,
	"description" text,
	"ordering_url" text,
	"ordering_instructions" text,
	"ordering_email" text,
	"ordering_phone" text,
	"status" "feed_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feeds_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "retailer_field_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"field_mappings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusion_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sync_settings" jsonb DEFAULT '{"syncEnabled":false,"syncImages":true,"syncInventory":true,"createNewProducts":true,"deleteRemovedProducts":false,"defaultStatus":"draft","publishToChannels":false}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_supplier_id_organizations_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_supplier_id_organizations_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_supplier_id_organizations_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_organizations_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_products" ADD CONSTRAINT "collection_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_supplier_id_organizations_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_supplier_id_organizations_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_retailer_id_organizations_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_cursors" ADD CONSTRAINT "sync_cursors_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_addresses" ADD CONSTRAINT "organization_addresses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_sync_settings" ADD CONSTRAINT "connection_sync_settings_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_sync_settings" ADD CONSTRAINT "connection_sync_settings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_products" ADD CONSTRAINT "synced_products_sync_settings_id_connection_sync_settings_id_fk" FOREIGN KEY ("sync_settings_id") REFERENCES "public"."connection_sync_settings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_products" ADD CONSTRAINT "synced_products_source_product_id_products_id_fk" FOREIGN KEY ("source_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synced_products" ADD CONSTRAINT "synced_products_source_variant_id_variants_id_fk" FOREIGN KEY ("source_variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_requests" ADD CONSTRAINT "feed_requests_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_requests" ADD CONSTRAINT "feed_requests_retailer_id_organizations_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_sources" ADD CONSTRAINT "feed_sources_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_subscriptions" ADD CONSTRAINT "feed_subscriptions_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_subscriptions" ADD CONSTRAINT "feed_subscriptions_retailer_id_organizations_id_fk" FOREIGN KEY ("retailer_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feed_sync_logs" ADD CONSTRAINT "feed_sync_logs_feed_source_id_feed_sources_id_fk" FOREIGN KEY ("feed_source_id") REFERENCES "public"."feed_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_field_mappings" ADD CONSTRAINT "retailer_field_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retailer_field_mappings" ADD CONSTRAINT "retailer_field_mappings_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brands_supplier_idx" ON "brands" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "brands_slug_idx" ON "brands" USING btree ("supplier_id","slug");--> statement-breakpoint
CREATE INDEX "product_tags_supplier_idx" ON "product_tags" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "product_tags_slug_idx" ON "product_tags" USING btree ("supplier_id","slug");--> statement-breakpoint
CREATE INDEX "product_types_supplier_idx" ON "product_types" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "product_types_slug_idx" ON "product_types" USING btree ("supplier_id","slug");--> statement-breakpoint
CREATE INDEX "products_supplier_idx" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "products_feed_idx" ON "products" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "products_external_id_idx" ON "products" USING btree ("supplier_id","external_id");--> statement-breakpoint
CREATE INDEX "products_sku_idx" ON "products" USING btree ("supplier_id","sku");--> statement-breakpoint
CREATE INDEX "products_feed_sku_idx" ON "products" USING btree ("feed_id","sku");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variants_external_id_idx" ON "variants" USING btree ("product_id","external_id");--> statement-breakpoint
CREATE INDEX "variants_sku_idx" ON "variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "variants_inventory_item_idx" ON "variants" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE INDEX "collection_products_collection_idx" ON "collection_products" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "collection_products_product_idx" ON "collection_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "collections_supplier_idx" ON "collections" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "collections_external_id_idx" ON "collections" USING btree ("supplier_id","external_id");--> statement-breakpoint
CREATE INDEX "collections_handle_idx" ON "collections" USING btree ("supplier_id","handle");--> statement-breakpoint
CREATE INDEX "inventory_variant_idx" ON "inventory" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "connections_supplier_idx" ON "connections" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "connections_retailer_idx" ON "connections" USING btree ("retailer_id");--> statement-breakpoint
CREATE INDEX "connections_status_idx" ON "connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "integrations_org_idx" ON "integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integrations_provider_idx" ON "integrations" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE INDEX "sync_cursors_integration_idx" ON "sync_cursors" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "api_keys_org_idx" ON "api_keys" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "api_keys_prefix_idx" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "api_keys_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "events_org_idx" ON "events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "events_processed_idx" ON "events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "processed_webhook_provider_event_idx" ON "processed_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_logs_sub_idx" ON "webhook_logs" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "webhook_logs_event_idx" ON "webhook_logs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "webhook_logs_created_at_idx" ON "webhook_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_subs_org_idx" ON "webhook_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "webhook_subs_active_idx" ON "webhook_subscriptions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "uploaded_files_organization_idx" ON "uploaded_files" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "uploaded_files_purpose_idx" ON "uploaded_files" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "uploaded_files_entity_idx" ON "uploaded_files" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "organization_addresses_org_idx" ON "organization_addresses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_addresses_default_idx" ON "organization_addresses" USING btree ("organization_id","is_default");--> statement-breakpoint
CREATE INDEX "connection_sync_settings_connection_idx" ON "connection_sync_settings" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "connection_sync_settings_integration_idx" ON "connection_sync_settings" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX "connection_sync_settings_enabled_idx" ON "connection_sync_settings" USING btree ("sync_enabled");--> statement-breakpoint
CREATE INDEX "synced_products_sync_settings_idx" ON "synced_products" USING btree ("sync_settings_id");--> statement-breakpoint
CREATE INDEX "synced_products_source_product_idx" ON "synced_products" USING btree ("source_product_id");--> statement-breakpoint
CREATE INDEX "synced_products_status_idx" ON "synced_products" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "synced_products_external_product_idx" ON "synced_products" USING btree ("external_product_id");--> statement-breakpoint
CREATE INDEX "synced_products_external_variant_idx" ON "synced_products" USING btree ("external_variant_id");--> statement-breakpoint
CREATE INDEX "feed_requests_feed_idx" ON "feed_requests" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_requests_retailer_idx" ON "feed_requests" USING btree ("retailer_id");--> statement-breakpoint
CREATE INDEX "feed_sources_feed_idx" ON "feed_sources" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_sources_active_idx" ON "feed_sources" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "feed_subscriptions_feed_idx" ON "feed_subscriptions" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "feed_subscriptions_retailer_idx" ON "feed_subscriptions" USING btree ("retailer_id");--> statement-breakpoint
CREATE INDEX "feed_sync_logs_source_idx" ON "feed_sync_logs" USING btree ("feed_source_id");--> statement-breakpoint
CREATE INDEX "feed_sync_logs_started_idx" ON "feed_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "feeds_status_idx" ON "feeds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feeds_slug_idx" ON "feeds" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "retailer_field_mappings_org_idx" ON "retailer_field_mappings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "retailer_field_mappings_integration_idx" ON "retailer_field_mappings" USING btree ("integration_id");