/*
 * Admin mutation input schemas.
 *
 * Every admin Server Action parses its input through a schema in this file.
 * Per the doctrine: parse, don't validate. Internal functions trust the
 * parsed result.
 */

import { z } from "zod";

const productCategoryValues = [
  "drinkware",
  "leather_patch",
  "dog_tag",
  "bookmark",
  "zippo",
  "coin",
  "tcg_accessory",
  "phone_case",
  "crystal_engraving",
] as const;

const decorationMethodValues = [
  "laser",
  "uv_print",
  "crystal_engrave",
  "dye_sub",
] as const;

const productStatusValues = ["draft", "active", "archived"] as const;

const featuredSlotValues = [
  "home_hero",
  "home_secondary",
  "made_this_week",
] as const;

/** URL-safe slug: lowercase letters, digits, hyphens; cannot start/end with a hyphen. */
const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits, and hyphens only");

export const createProductSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(120),
  category: z.enum(productCategoryValues),
  decorationMethod: z.enum(decorationMethodValues),
  basePriceCents: z.number().int().nonnegative().max(10_000_00),
  leadTimeDays: z.number().int().min(1).max(120).default(7),
  status: z.enum(productStatusValues).default("draft"),
  descriptionMdx: z.string().max(20_000).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema
  .partial()
  .extend({ id: z.string().min(1) });
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const archiveProductSchema = z.object({
  id: z.string().min(1),
  archive: z.boolean(),
});

export const createVariantSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  attributes: z.record(z.string(), z.unknown()).default({}),
  priceDeltaCents: z.number().int().default(0),
  inventoryCount: z.number().int().nonnegative().nullable().optional(),
  weightGrams: z.number().int().nonnegative().nullable().optional(),
  dimensionsMm: z
    .object({
      w: z.number().nonnegative(),
      h: z.number().nonnegative(),
      d: z.number().nonnegative(),
    })
    .nullable()
    .optional(),
});

export const updateVariantSchema = createVariantSchema
  .partial()
  .extend({ id: z.string().min(1) });

export const deleteVariantSchema = z.object({
  id: z.string().min(1),
});

export const upsertCategorySchema = z.object({
  category: z.enum(productCategoryValues),
  displayName: z.string().min(1).max(60),
  blurb: z.string().max(280).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const upsertSiteSettingSchema = z.object({
  key: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/i, "snake_case keys only"),
  value: z.unknown(),
  scope: z.string().min(1).max(40).default("misc"),
});

export const upsertFeaturedProductSchema = z.object({
  productId: z.string().min(1),
  slot: z.enum(featuredSlotValues),
  sortOrder: z.number().int().min(0).default(0),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

export const deleteFeaturedSchema = z.object({
  id: z.string().min(1),
});

// -----------------------------------------------------------------------------
// Decoration zones
//
// geometry and print_spec are jsonb columns. Until the Phase 2b visual editor
// lands, the admin edits them as raw JSON; these schemas are what that JSON is
// parsed against before it reaches the database. A "rect" geometry is expressed
// in the customizer's canonical 720×900 canvas frame so it overlays the Konva
// stage 1:1; a "box_mm" geometry describes a crystal engraving volume.
// -----------------------------------------------------------------------------

const decorationZoneKindValues = [
  "text_only",
  "image_only",
  "mixed",
  "crystal_volume",
] as const;

const zoneRectGeometrySchema = z.object({
  shape: z.literal("rect"),
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
});

const zoneBoxMmGeometrySchema = z.object({
  shape: z.literal("box_mm"),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive(),
});

export const zoneGeometrySchema = z.discriminatedUnion("shape", [
  zoneRectGeometrySchema,
  zoneBoxMmGeometrySchema,
]);
export type ZoneGeometry = z.infer<typeof zoneGeometrySchema>;

export const zonePrintSpecSchema = z.object({
  dpi: z.number().int().positive().max(2400),
  colorProfile: z.enum(["sRGB", "CMYK", "grayscale"]).default("sRGB"),
  maxWidthMm: z.number().positive().nullable().optional(),
  maxHeightMm: z.number().positive().nullable().optional(),
  vectorRequired: z.boolean().default(false),
});
export type ZonePrintSpec = z.infer<typeof zonePrintSpecSchema>;

export const createDecorationZoneSchema = z.object({
  productVariantId: z.string().min(1),
  name: z.string().min(1).max(80),
  kind: z.enum(decorationZoneKindValues),
  geometry: zoneGeometrySchema,
  printSpec: zonePrintSpecSchema,
  ordering: z.number().int().min(0).default(0),
});

export const updateDecorationZoneSchema = createDecorationZoneSchema
  .partial()
  .extend({ id: z.string().min(1) });

export const deleteDecorationZoneSchema = z.object({
  id: z.string().min(1),
});

// -----------------------------------------------------------------------------
// Mock-up templates
//
// overlay_config is a jsonb column describing how a variant's decoration zones
// project onto its product photo. Until the Phase 2b visual calibrator lands,
// the admin edits it as raw JSON validated against the schema below. A 2D
// overlay maps each zone's rectangular art onto a destination quad in the base
// image's pixel space (a perspective warp) and optionally composites shadow /
// highlight masks for realism; a 3D template instead points at a GLB model.
// -----------------------------------------------------------------------------

const mockupFormatValues = ["2d_overlay", "3d_r3f"] as const;

/** A destination point in base-image pixels: [x, y]. */
const mockupPointSchema = z.tuple([z.number(), z.number()]);

const mockupZoneOverlaySchema = z.object({
  zoneId: z.string().min(1),
  /** Destination quad in base-image px: top-left, top-right, bottom-right, bottom-left. */
  corners: z.object({
    tl: mockupPointSchema,
    tr: mockupPointSchema,
    br: mockupPointSchema,
    bl: mockupPointSchema,
  }),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: z
    .enum(["normal", "multiply", "screen", "overlay"])
    .default("multiply"),
});

export const mockupOverlayConfigSchema = z.object({
  baseWidth: z.number().int().positive(),
  baseHeight: z.number().int().positive(),
  zones: z.array(mockupZoneOverlaySchema),
  shadowMaskImageId: z.string().nullable().optional(),
  highlightMaskImageId: z.string().nullable().optional(),
});
export type MockupOverlayConfig = z.infer<typeof mockupOverlayConfigSchema>;

const mockupTemplateBaseSchema = z.object({
  variantId: z.string().min(1).nullable().optional(),
  baseImageId: z.string().min(1).nullable().optional(),
  overlayConfig: mockupOverlayConfigSchema,
  format: z.enum(mockupFormatValues).default("2d_overlay"),
  r3fModelUrl: z.string().url().nullable().optional(),
});

/** A 3D template is meaningless without a model URL to load. */
const mockupTemplateNeeds3dModel = (t: {
  format?: (typeof mockupFormatValues)[number];
  r3fModelUrl?: string | null;
}) => t.format !== "3d_r3f" || Boolean(t.r3fModelUrl);
const mockupTemplate3dRefinement = {
  message: "A 3D (r3f) template needs an r3fModelUrl pointing at a GLB.",
  path: ["r3fModelUrl"],
};

export const createMockupTemplateSchema = mockupTemplateBaseSchema.refine(
  mockupTemplateNeeds3dModel,
  mockupTemplate3dRefinement,
);

export const updateMockupTemplateSchema = mockupTemplateBaseSchema
  .extend({ id: z.string().min(1) })
  .refine(mockupTemplateNeeds3dModel, mockupTemplate3dRefinement);

export const deleteMockupTemplateSchema = z.object({
  id: z.string().min(1),
});
