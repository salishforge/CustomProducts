-- Required Postgres extensions (Neon supports CREATE EXTENSION without superuser).
CREATE EXTENSION IF NOT EXISTS "citext";--> statement-breakpoint
CREATE TYPE "public"."ai_generation_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."asset_kind" AS ENUM('upload', 'ai_generation');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('open', 'converted', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."decoration_method" AS ENUM('laser', 'uv_print', 'crystal_engrave', 'dye_sub');--> statement-breakpoint
CREATE TYPE "public"."decoration_zone_kind" AS ENUM('text_only', 'image_only', 'mixed', 'crystal_volume');--> statement-breakpoint
CREATE TYPE "public"."design_draft_status" AS ENUM('draft', 'saved', 'added_to_cart', 'converted_to_order');--> statement-breakpoint
CREATE TYPE "public"."featured_product_slot" AS ENUM('home_hero', 'home_secondary', 'made_this_week');--> statement-breakpoint
CREATE TYPE "public"."mockup_format" AS ENUM('2d_overlay', '3d_r3f');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'flagged', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'in_production', 'shipped', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('drinkware', 'leather_patch', 'dog_tag', 'bookmark', 'zippo', 'coin', 'tcg_accessory', 'phone_case', 'crystal_engraving');--> statement-breakpoint
CREATE TYPE "public"."product_image_kind" AS ENUM('hero', 'gallery', 'mockup_base', 'swatch', 'process', 'macro');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."production_stage" AS ENUM('pending', 'files_ready', 'in_queue', 'in_production', 'qc', 'packed', 'shipped');--> statement-breakpoint
CREATE TYPE "public"."theme_revision_status" AS ENUM('draft', 'proposed', 'applied', 'retired');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('stripe', 'replicate', 'inngest', 'workos');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"label" text,
	"recipient_name" text NOT NULL,
	"street1" text NOT NULL,
	"street2" text,
	"city" text NOT NULL,
	"region" text NOT NULL,
	"postal_code" text NOT NULL,
	"country_code" text NOT NULL,
	"phone" text,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"prompt" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"model" text NOT NULL,
	"model_version" text,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reference_image_asset_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cache_key" text NOT NULL,
	"replicate_prediction_id" text,
	"status" "ai_generation_status" DEFAULT 'queued' NOT NULL,
	"output_asset_id" text,
	"cost_usd_cents" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"product_variant_id" text NOT NULL,
	"design_draft_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"session_token" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "cart_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"workos_user_id" text,
	"email" "citext" NOT NULL,
	"display_name" text,
	"phone" text,
	"default_shipping_address_id" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decoration_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"product_variant_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "decoration_zone_kind" NOT NULL,
	"geometry" jsonb NOT NULL,
	"print_spec" jsonb NOT NULL,
	"ordering" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"product_variant_id" text NOT NULL,
	"name" text,
	"design_state" jsonb NOT NULL,
	"preview_image_id" text,
	"status" "design_draft_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "featured_products" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"slot" "featured_product_slot" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mockup_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"variant_id" text,
	"base_image_id" text,
	"overlay_config" jsonb NOT NULL,
	"format" "mockup_format" DEFAULT '2d_overlay' NOT NULL,
	"r3f_model_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_variant_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"product_snapshot" jsonb NOT NULL,
	"customization_snapshot" jsonb NOT NULL,
	"mockup_image_id" text,
	"print_ready_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"production_status" "production_stage" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"order_number" text NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"shipping_address" jsonb,
	"billing_address" jsonb,
	"placed_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"tracking_number" text,
	"tracking_carrier" text,
	"notes_for_customer" text,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"category" "product_category" PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"blurb" text,
	"hero_image_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text,
	"cloudflare_image_id" text NOT NULL,
	"alt_text" text,
	"kind" "product_image_kind" NOT NULL,
	"ordering" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_delta_cents" integer DEFAULT 0 NOT NULL,
	"inventory_count" integer,
	"weight_grams" integer,
	"dimensions_mm" jsonb,
	"mockup_template_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"order_item_id" text NOT NULL,
	"stage" "production_stage" NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" "product_category" NOT NULL,
	"description_mdx" text,
	"base_price_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"decoration_method" "decoration_method" NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"hero_image_id" text,
	"lead_time_days" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"scope" text DEFAULT 'misc' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"tokens" jsonb NOT NULL,
	"proposed_by_email" text NOT NULL,
	"proposed_by_llm_session_id" text,
	"conversation" jsonb,
	"status" "theme_revision_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "uploaded_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text,
	"kind" "asset_kind" NOT NULL,
	"r2_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"width_px" integer,
	"height_px" integer,
	"byte_size" integer NOT NULL,
	"original_filename" text,
	"generation_id" text,
	"content_hash" text NOT NULL,
	"moderation_status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"event_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_summary" jsonb
);
--> statement-breakpoint
CREATE INDEX "addresses_customer_idx" ON "addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generations_cache_uniq" ON "ai_generations" USING btree ("cache_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_generations_replicate_uniq" ON "ai_generations" USING btree ("replicate_prediction_id");--> statement-breakpoint
CREATE INDEX "ai_generations_customer_idx" ON "ai_generations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "ai_generations_status_idx" ON "ai_generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_generations_cost_window_idx" ON "ai_generations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cart_items_cart_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "carts_customer_idx" ON "carts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "carts_session_idx" ON "carts" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "carts_status_idx" ON "carts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_uniq" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_workos_uniq" ON "customers" USING btree ("workos_user_id");--> statement-breakpoint
CREATE INDEX "decoration_zones_variant_idx" ON "decoration_zones" USING btree ("product_variant_id");--> statement-breakpoint
CREATE INDEX "design_drafts_customer_idx" ON "design_drafts" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "design_drafts_variant_idx" ON "design_drafts" USING btree ("product_variant_id");--> statement-breakpoint
CREATE INDEX "featured_products_slot_idx" ON "featured_products" USING btree ("slot");--> statement-breakpoint
CREATE INDEX "featured_products_product_idx" ON "featured_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_variant_idx" ON "order_items" USING btree ("product_variant_id");--> statement-breakpoint
CREATE INDEX "order_items_production_idx" ON "order_items" USING btree ("production_status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_uniq" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_stripe_pi_uniq" ON "orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_uniq" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "production_stages_item_idx" ON "production_stages" USING btree ("order_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_uniq" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "theme_revisions_status_idx" ON "theme_revisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "theme_revisions_parent_idx" ON "theme_revisions" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uploaded_assets_r2_uniq" ON "uploaded_assets" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "uploaded_assets_customer_idx" ON "uploaded_assets" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "uploaded_assets_content_hash_idx" ON "uploaded_assets" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uniq" ON "webhook_events" USING btree ("provider","event_id");