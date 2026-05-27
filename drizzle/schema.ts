/*
 * Salishforge data model — single source of truth.
 *
 * Conventions:
 *   - Ids are cuid2 text, generated client-side (see lib/db/id.ts).
 *   - Money in cents (integer), paired with a `currency` field where relevant.
 *   - Timestamps are timestamptz, named `*_at`.
 *   - Enums modeled as Postgres enums for grep-ability in psql.
 *   - Order state is SNAPSHOTTED — `orders` and `order_items` carry frozen
 *     product + customization jsonb so deleted products don't break history.
 *
 * Read CLAUDE.md and ~/.claude/plans/salishforge-is-a-small-jiggly-hamming.md
 * before adding tables.
 */

import {
  pgEnum,
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgSchema,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// -----------------------------------------------------------------------------
// Custom types
// -----------------------------------------------------------------------------

/** Postgres `citext` for case-insensitive email storage. Requires the
 * `citext` extension — created in the first migration. */
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const productCategoryEnum = pgEnum("product_category", [
  "drinkware",
  "leather_patch",
  "dog_tag",
  "bookmark",
  "zippo",
  "coin",
  "tcg_accessory",
  "phone_case",
  "crystal_engraving",
]);

export const decorationMethodEnum = pgEnum("decoration_method", [
  "laser",
  "uv_print",
  "crystal_engrave",
  "dye_sub",
]);

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "archived",
]);

export const decorationZoneKindEnum = pgEnum("decoration_zone_kind", [
  "text_only",
  "image_only",
  "mixed",
  "crystal_volume",
]);

export const mockupFormatEnum = pgEnum("mockup_format", [
  "2d_overlay",
  "3d_r3f",
]);

export const productImageKindEnum = pgEnum("product_image_kind", [
  "hero",
  "gallery",
  "mockup_base",
  "swatch",
  "process",
  "macro",
]);

export const assetKindEnum = pgEnum("asset_kind", ["upload", "ai_generation"]);

export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "approved",
  "flagged",
  "rejected",
]);

export const aiGenerationStatusEnum = pgEnum("ai_generation_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const designDraftStatusEnum = pgEnum("design_draft_status", [
  "draft",
  "saved",
  "added_to_cart",
  "converted_to_order",
]);

export const cartStatusEnum = pgEnum("cart_status", [
  "open",
  "converted",
  "abandoned",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const productionStageEnum = pgEnum("production_stage", [
  "pending",
  "files_ready",
  "in_queue",
  "in_production",
  "qc",
  "packed",
  "shipped",
]);

export const webhookProviderEnum = pgEnum("webhook_provider", [
  "stripe",
  "replicate",
  "inngest",
  "workos",
]);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const id = () => text("id").primaryKey();
const fkRequired = (name: string) => text(name).notNull();
const fkOptional = (name: string) => text(name);
const cents = (name: string) => integer(name).notNull();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`);
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`);
const moneyCurrency = () => text("currency").notNull().default("USD");

// -----------------------------------------------------------------------------
// 1. products
// -----------------------------------------------------------------------------

export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: productCategoryEnum("category").notNull(),
    descriptionMdx: text("description_mdx"),
    basePriceCents: cents("base_price_cents"),
    currency: moneyCurrency(),
    decorationMethod: decorationMethodEnum("decoration_method").notNull(),
    status: productStatusEnum("status").notNull().default("draft"),
    heroImageId: fkOptional("hero_image_id"),
    leadTimeDays: integer("lead_time_days").notNull().default(7),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_slug_uniq").on(t.slug),
    index("products_status_idx").on(t.status),
  ],
);

// -----------------------------------------------------------------------------
// 2. product_variants
// -----------------------------------------------------------------------------

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: fkRequired("product_id"),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    /** Free-form attributes — color, size, material, etc. */
    attributes: jsonb("attributes").notNull().default(sql`'{}'::jsonb`),
    priceDeltaCents: integer("price_delta_cents").notNull().default(0),
    /** Null means made-to-order, unlimited. */
    inventoryCount: integer("inventory_count"),
    weightGrams: integer("weight_grams"),
    /** { w, h, d } in mm. */
    dimensionsMm: jsonb("dimensions_mm"),
    mockupTemplateId: fkOptional("mockup_template_id"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("product_variants_sku_uniq").on(t.sku),
    index("product_variants_product_idx").on(t.productId),
  ],
);

// -----------------------------------------------------------------------------
// 3. decoration_zones
// -----------------------------------------------------------------------------

export const decorationZones = pgTable(
  "decoration_zones",
  {
    id: id(),
    productVariantId: fkRequired("product_variant_id"),
    name: text("name").notNull(),
    kind: decorationZoneKindEnum("kind").notNull(),
    /** 2D: clip path + transform; crystal: bounding box mm. */
    geometry: jsonb("geometry").notNull(),
    /** DPI requirement, color profile, max dimensions mm, vector_required boolean. */
    printSpec: jsonb("print_spec").notNull(),
    ordering: integer("ordering").notNull().default(0),
  },
  (t) => [index("decoration_zones_variant_idx").on(t.productVariantId)],
);

// -----------------------------------------------------------------------------
// 4. mockup_templates
// -----------------------------------------------------------------------------

export const mockupTemplates = pgTable("mockup_templates", {
  id: id(),
  /** Null = shared template (used by multiple variants). */
  variantId: fkOptional("variant_id"),
  baseImageId: fkOptional("base_image_id"),
  /** Per-zone perspective transform + shadow/highlight masks. */
  overlayConfig: jsonb("overlay_config").notNull(),
  format: mockupFormatEnum("format").notNull().default("2d_overlay"),
  /** R2 URL to GLB; only when format='3d_r3f'. */
  r3fModelUrl: text("r3f_model_url"),
  createdAt: createdAt(),
});

// -----------------------------------------------------------------------------
// 5. product_images
// -----------------------------------------------------------------------------

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: fkOptional("product_id"),
    cloudflareImageId: text("cloudflare_image_id").notNull(),
    altText: text("alt_text"),
    kind: productImageKindEnum("kind").notNull(),
    ordering: integer("ordering").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

// -----------------------------------------------------------------------------
// 6. customers
// -----------------------------------------------------------------------------

export const customers = pgTable(
  "customers",
  {
    id: id(),
    /** Null until guest converts to account. */
    workosUserId: text("workos_user_id"),
    email: citext("email").notNull(),
    displayName: text("display_name"),
    phone: text("phone"),
    defaultShippingAddressId: fkOptional("default_shipping_address_id"),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("customers_email_uniq").on(t.email),
    uniqueIndex("customers_workos_uniq").on(t.workosUserId),
  ],
);

// -----------------------------------------------------------------------------
// 7. addresses
// -----------------------------------------------------------------------------

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    customerId: fkRequired("customer_id"),
    label: text("label"),
    recipientName: text("recipient_name").notNull(),
    street1: text("street1").notNull(),
    street2: text("street2"),
    city: text("city").notNull(),
    region: text("region").notNull(),
    postalCode: text("postal_code").notNull(),
    countryCode: text("country_code").notNull(),
    phone: text("phone"),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [index("addresses_customer_idx").on(t.customerId)],
);

// -----------------------------------------------------------------------------
// 8. design_drafts
// -----------------------------------------------------------------------------

export const designDrafts = pgTable(
  "design_drafts",
  {
    id: id(),
    /** Null = guest draft (lives only in localStorage until checkout). */
    customerId: fkOptional("customer_id"),
    productVariantId: fkRequired("product_variant_id"),
    name: text("name"),
    /** Canonical configurator state: zone → {text|image_asset_id|generation_id|transform}. */
    designState: jsonb("design_state").notNull(),
    previewImageId: fkOptional("preview_image_id"),
    status: designDraftStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("design_drafts_customer_idx").on(t.customerId),
    index("design_drafts_variant_idx").on(t.productVariantId),
  ],
);

// -----------------------------------------------------------------------------
// 9. uploaded_assets
// -----------------------------------------------------------------------------

export const uploadedAssets = pgTable(
  "uploaded_assets",
  {
    id: id(),
    customerId: fkOptional("customer_id"),
    kind: assetKindEnum("kind").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type").notNull(),
    widthPx: integer("width_px"),
    heightPx: integer("height_px"),
    byteSize: integer("byte_size").notNull(),
    /** Only for kind='upload'. */
    originalFilename: text("original_filename"),
    /** Only for kind='ai_generation'. */
    generationId: fkOptional("generation_id"),
    /** Content-addressed dedupe key — sha256 of bytes. */
    contentHash: text("content_hash").notNull(),
    moderationStatus: moderationStatusEnum("moderation_status")
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("uploaded_assets_r2_uniq").on(t.r2Key),
    index("uploaded_assets_customer_idx").on(t.customerId),
    index("uploaded_assets_content_hash_idx").on(t.contentHash),
  ],
);

// -----------------------------------------------------------------------------
// 10. ai_generations — every Replicate call. Costable, cacheable, re-usable.
// -----------------------------------------------------------------------------

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: id(),
    customerId: fkOptional("customer_id"),
    prompt: text("prompt").notNull(),
    promptHash: text("prompt_hash").notNull(),
    model: text("model").notNull(),
    modelVersion: text("model_version"),
    /** Aspect ratio, num inference steps, guidance, seed, etc. */
    params: jsonb("params").notNull().default(sql`'{}'::jsonb`),
    /** Ordered array of asset ids (sha256 of bytes, sorted for cache key). */
    referenceImageAssetIds: jsonb("reference_image_asset_ids")
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** sha256(normalized_prompt + sorted_reference_hashes + model + canonicalized_params).
     *  UNIQUE — atomically dedupes the entire generation. */
    cacheKey: text("cache_key").notNull(),
    replicatePredictionId: text("replicate_prediction_id"),
    status: aiGenerationStatusEnum("status").notNull().default("queued"),
    outputAssetId: fkOptional("output_asset_id"),
    costUsdCents: integer("cost_usd_cents"),
    errorMessage: text("error_message"),
    createdAt: createdAt(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("ai_generations_cache_uniq").on(t.cacheKey),
    uniqueIndex("ai_generations_replicate_uniq").on(t.replicatePredictionId),
    index("ai_generations_customer_idx").on(t.customerId),
    index("ai_generations_status_idx").on(t.status),
    index("ai_generations_cost_window_idx").on(t.createdAt),
  ],
);

// -----------------------------------------------------------------------------
// 11. carts + cart_items
// -----------------------------------------------------------------------------

export const carts = pgTable(
  "carts",
  {
    id: id(),
    customerId: fkOptional("customer_id"),
    sessionToken: text("session_token"),
    currency: moneyCurrency(),
    status: cartStatusEnum("status").notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("carts_customer_idx").on(t.customerId),
    index("carts_session_idx").on(t.sessionToken),
    index("carts_status_idx").on(t.status),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: id(),
    cartId: fkRequired("cart_id"),
    productVariantId: fkRequired("product_variant_id"),
    designDraftId: fkOptional("design_draft_id"),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: cents("unit_price_cents"),
    createdAt: createdAt(),
  },
  (t) => [index("cart_items_cart_idx").on(t.cartId)],
);

// -----------------------------------------------------------------------------
// 12. orders
// -----------------------------------------------------------------------------

export const orders = pgTable(
  "orders",
  {
    id: id(),
    customerId: fkRequired("customer_id"),
    /** Human-readable, e.g., "SF-2026-0001". */
    orderNumber: text("order_number").notNull(),
    status: orderStatusEnum("status").notNull().default("pending_payment"),
    subtotalCents: cents("subtotal_cents"),
    taxCents: integer("tax_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: cents("total_cents"),
    currency: moneyCurrency(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    /** Snapshotted — not a FK. */
    shippingAddress: jsonb("shipping_address"),
    billingAddress: jsonb("billing_address"),
    placedAt: timestamp("placed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    trackingNumber: text("tracking_number"),
    trackingCarrier: text("tracking_carrier"),
    notesForCustomer: text("notes_for_customer"),
    internalNotes: text("internal_notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_number_uniq").on(t.orderNumber),
    uniqueIndex("orders_stripe_pi_uniq").on(t.stripePaymentIntentId),
    index("orders_customer_idx").on(t.customerId),
    index("orders_status_idx").on(t.status),
  ],
);

// -----------------------------------------------------------------------------
// 13. order_items — the snapshot is the contract.
// -----------------------------------------------------------------------------

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: fkRequired("order_id"),
    /** RESTRICT — keep the link if the product still exists. */
    productVariantId: fkRequired("product_variant_id"),
    quantity: integer("quantity").notNull(),
    unitPriceCents: cents("unit_price_cents"),
    lineTotalCents: cents("line_total_cents"),
    /** Product name, SKU, attributes, dimensions, weight at time of purchase. */
    productSnapshot: jsonb("product_snapshot").notNull(),
    /** Frozen design_drafts.design_state. */
    customizationSnapshot: jsonb("customization_snapshot").notNull(),
    mockupImageId: fkOptional("mockup_image_id"),
    /** [{kind:'pdf'|'svg'|'png'|'depth_map', r2_key, generated_at}] */
    printReadyFiles: jsonb("print_ready_files")
      .notNull()
      .default(sql`'[]'::jsonb`),
    productionStatus: productionStageEnum("production_status")
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_variant_idx").on(t.productVariantId),
    index("order_items_production_idx").on(t.productionStatus),
  ],
);

// -----------------------------------------------------------------------------
// 14. production_stages — append-only audit log
// -----------------------------------------------------------------------------

export const productionStages = pgTable(
  "production_stages",
  {
    id: id(),
    orderItemId: fkRequired("order_item_id"),
    stage: productionStageEnum("stage").notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    /** Admin user id or 'system'. */
    actor: text("actor").notNull(),
    note: text("note"),
  },
  (t) => [index("production_stages_item_idx").on(t.orderItemId)],
);

// -----------------------------------------------------------------------------
// 15. webhook_events — idempotency for all incoming webhooks
// -----------------------------------------------------------------------------

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: webhookProviderEnum("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    payloadSummary: jsonb("payload_summary"),
  },
  (t) => [
    uniqueIndex("webhook_events_provider_event_uniq").on(t.provider, t.eventId),
  ],
);

// -----------------------------------------------------------------------------
// 16. product_categories — display metadata for the product_category enum
//
// The enum itself stays authoritative (decoration method, file pipeline, AI
// prompt scaffold are all keyed off it). This table carries operator-editable
// presentation: how each category appears in nav, on home, on category pages.
// PK is the enum value, so the row count is bounded and writes are upsert-like.
// -----------------------------------------------------------------------------

export const productCategories = pgTable("product_categories", {
  category: productCategoryEnum("category").primaryKey(),
  displayName: text("display_name").notNull(),
  blurb: text("blurb"),
  heroImageId: fkOptional("hero_image_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: updatedAt(),
});

// -----------------------------------------------------------------------------
// 17. site_settings — operator-editable KV
//
// Holds copy strings (shipping policy, lead-time disclosure, contact email),
// feature flags (ai_generation_enabled, design_console_enabled), and pointers
// (active_theme_revision_id). value is jsonb so it can carry strings, bools,
// numbers, or small structured objects without schema churn.
// -----------------------------------------------------------------------------

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  /** Coarse scope tag for the admin UI grouping (e.g., 'copy', 'flags', 'theme'). */
  scope: text("scope").notNull().default("misc"),
  updatedAt: updatedAt(),
});

// -----------------------------------------------------------------------------
// 18. featured_products — home-page slot scheduler
// -----------------------------------------------------------------------------

export const featuredProductSlotEnum = pgEnum("featured_product_slot", [
  "home_hero",
  "home_secondary",
  "made_this_week",
]);

export const featuredProducts = pgTable(
  "featured_products",
  {
    id: id(),
    productId: fkRequired("product_id"),
    slot: featuredProductSlotEnum("slot").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("featured_products_slot_idx").on(t.slot),
    index("featured_products_product_idx").on(t.productId),
  ],
);

// -----------------------------------------------------------------------------
// 19. theme_revisions — immutable snapshots of the active design state
//
// The active revision is referenced by site_settings.value where
// key='active_theme_revision_id'. Switching is a single jsonb-pointer write.
// Phase 4 (Design Console) writes here; Phase 2a creates the table so the
// schema is stable from the start.
// -----------------------------------------------------------------------------

export const themeRevisionStatusEnum = pgEnum("theme_revision_status", [
  "draft",
  "proposed",
  "applied",
  "retired",
]);

export const themeRevisions = pgTable(
  "theme_revisions",
  {
    id: id(),
    parentId: fkOptional("parent_id"),
    /** { palette_id, font_pairing_id, spacing_scale_id, layout_assignments: {section: variantId} } */
    tokens: jsonb("tokens").notNull(),
    proposedByEmail: text("proposed_by_email").notNull(),
    /** Set when the revision was produced by the LLM Console (links chat history in `conversation`). */
    proposedByLlmSessionId: text("proposed_by_llm_session_id"),
    /** Raw chat + tool-call log for the conversation that produced this revision (Console-only). */
    conversation: jsonb("conversation"),
    status: themeRevisionStatusEnum("status").notNull().default("draft"),
    createdAt: createdAt(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
  },
  (t) => [
    index("theme_revisions_status_idx").on(t.status),
    index("theme_revisions_parent_idx").on(t.parentId),
  ],
);

// -----------------------------------------------------------------------------
// Type exports
// -----------------------------------------------------------------------------

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type DecorationZone = typeof decorationZones.$inferSelect;
export type MockupTemplate = typeof mockupTemplates.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Address = typeof addresses.$inferSelect;
export type DesignDraft = typeof designDrafts.$inferSelect;
export type NewDesignDraft = typeof designDrafts.$inferInsert;
export type UploadedAsset = typeof uploadedAssets.$inferSelect;
export type NewUploadedAsset = typeof uploadedAssets.$inferInsert;
export type AiGeneration = typeof aiGenerations.$inferSelect;
export type NewAiGeneration = typeof aiGenerations.$inferInsert;
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type ProductionStage = typeof productionStages.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type ProductCategoryRow = typeof productCategories.$inferSelect;
export type NewProductCategoryRow = typeof productCategories.$inferInsert;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type NewSiteSetting = typeof siteSettings.$inferInsert;
export type FeaturedProduct = typeof featuredProducts.$inferSelect;
export type NewFeaturedProduct = typeof featuredProducts.$inferInsert;
export type ThemeRevision = typeof themeRevisions.$inferSelect;
export type NewThemeRevision = typeof themeRevisions.$inferInsert;
