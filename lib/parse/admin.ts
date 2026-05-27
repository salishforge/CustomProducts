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
