/*
 * Idempotent dev seed.
 *
 * Populates product_categories metadata for all 9 enum values, the 8 launch
 * products, and one default variant per product carrying its display
 * dimensions. Safe to re-run — uses ON CONFLICT DO NOTHING on the natural
 * keys (category PK, product slug, variant sku).
 *
 * Run: `pnpm db:seed` (auto-loads .env.local).
 */

import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import {
  decorationZones,
  productCategories,
  products,
  productVariants,
} from "@/drizzle/schema";

/** Customizer canonical canvas frame (must match STAGE_WIDTH/HEIGHT). */
const CANVAS_W = 720;
const CANVAS_H = 900;

/**
 * A centered rect zone whose aspect mirrors the product's real proportions,
 * fitted into ~70% of the canvas. Expressed in the canvas frame so the
 * customizer overlays it 1:1 over the Konva stage.
 */
function rectZoneForDimensions(dim: { w?: number; h?: number }): {
  shape: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
} {
  const aspect = dim.w && dim.h ? dim.w / dim.h : 0.8;
  const maxW = CANVAS_W * 0.7;
  const maxH = CANVAS_H * 0.7;
  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return {
    shape: "rect",
    x: Math.round((CANVAS_W - width) / 2),
    y: Math.round((CANVAS_H - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
    rotation: 0,
  };
}

/** Default zone kind + print spec per decoration method. */
const ZONE_SPEC_BY_METHOD = {
  laser: { kind: "mixed", dpi: 600, colorProfile: "grayscale", vectorRequired: true },
  uv_print: { kind: "mixed", dpi: 300, colorProfile: "sRGB", vectorRequired: false },
  crystal_engrave: { kind: "crystal_volume", dpi: 300, colorProfile: "grayscale", vectorRequired: false },
  dye_sub: { kind: "mixed", dpi: 300, colorProfile: "sRGB", vectorRequired: false },
} as const;

const CATEGORY_META = [
  { category: "crystal_engraving", displayName: "Crystal engravings", blurb: "Inner-engraved K9 optical crystal — photographs, logos, hand-drawn art.", sortOrder: 0 },
  { category: "drinkware",         displayName: "Drinkware",          blurb: "UV-printed wraps on stainless tumblers and cups.",                   sortOrder: 1 },
  { category: "leather_patch",     displayName: "Leather patches",    blurb: "Laser-engraved veg-tan leather, heat-set adhesive backing.",        sortOrder: 2 },
  { category: "dog_tag",           displayName: "Dog tags",           blurb: "Stainless mil-spec, engraved both faces.",                         sortOrder: 3 },
  { category: "coin",              displayName: "Challenge coins",    blurb: "Solid brass, engraved both faces.",                                sortOrder: 4 },
  { category: "bookmark",          displayName: "Bookmarks",          blurb: "Solid hardwood, oiled.",                                           sortOrder: 5 },
  { category: "zippo",             displayName: "Zippo lighters",     blurb: "Laser-engraved engraving area on classic Zippo cases.",            sortOrder: 6 },
  { category: "tcg_accessory",     displayName: "TCG accessories",    blurb: "Deck boxes, card cases, and playmats for the table.",             sortOrder: 7 },
  { category: "phone_case",        displayName: "Phone cases",        blurb: "Slim TPU/PC hybrid, UV-printed edge to edge.",                    sortOrder: 8 },
] as const;

type SeedProduct = {
  slug: string;
  name: string;
  category:
    | "drinkware"
    | "leather_patch"
    | "dog_tag"
    | "bookmark"
    | "zippo"
    | "coin"
    | "tcg_accessory"
    | "phone_case"
    | "crystal_engraving";
  decorationMethod: "laser" | "uv_print" | "crystal_engrave" | "dye_sub";
  basePriceCents: number;
  leadTimeDays: number;
  /** First paragraph = PDP lede; second = fabrication spec. Split on \n\n. */
  descriptionMdx: string;
  /** Default variant attached on seed so dimensions appear on PDP/catalog. */
  defaultVariant: {
    skuSuffix: string;
    name: string;
    dimensionsMm: { w?: number; h?: number; d?: number; label?: string };
    weightGrams?: number;
    priceDeltaCents?: number;
  };
};

const SEED_PRODUCTS: readonly SeedProduct[] = [
  {
    slug: "crystal-cube-80",
    name: "Crystal cube",
    category: "crystal_engraving",
    decorationMethod: "crystal_engrave",
    basePriceCents: 12800,
    leadTimeDays: 7,
    descriptionMdx:
      "An 80 mm optically-clear cube, engraved from the inside with a photo, logo, or hand-drawn line.\n\nK9 optical crystal · 80 × 80 × 80 mm · sub-surface laser at 60 µm voxel pitch · felt-lined cherry box included.",
    defaultVariant: {
      skuSuffix: "80",
      name: '80 mm cube',
      dimensionsMm: { w: 80, h: 80, d: 80 },
      weightGrams: 1024,
    },
  },
  {
    slug: "tumbler-12oz-black",
    name: "12 oz tumbler",
    category: "drinkware",
    decorationMethod: "uv_print",
    basePriceCents: 3400,
    leadTimeDays: 5,
    descriptionMdx:
      "Powder-coated stainless tumbler with vacuum walls. Full 360° UV print wrap.\n\n18/8 stainless · powder coat · UV-cured ink at 1440 DPI · dishwasher safe (top rack).",
    defaultVariant: {
      skuSuffix: "12-blk",
      name: "12 oz · black",
      dimensionsMm: { w: 85, h: 178, label: "85 × 178 mm · 12 oz" },
      weightGrams: 320,
    },
  },
  {
    slug: "leather-patch-3x2",
    name: "Leather hat patch",
    category: "leather_patch",
    decorationMethod: "laser",
    basePriceCents: 1200,
    leadTimeDays: 4,
    descriptionMdx:
      "Vegetable-tanned leather patch with engraved art. Backed with iron-on adhesive.\n\n4 mm veg-tan leather · engraved at 600 DPI, 8 mm/s, 45% power · heat-set adhesive backing.",
    defaultVariant: {
      skuSuffix: "3x2",
      name: '3" × 2"',
      dimensionsMm: { w: 76, h: 51 },
      weightGrams: 12,
    },
  },
  {
    slug: "dog-tag-mil",
    name: "Dog tag",
    category: "dog_tag",
    decorationMethod: "laser",
    basePriceCents: 1600,
    leadTimeDays: 4,
    descriptionMdx:
      "Stainless mil-spec tag, engraved on both faces.\n\n304 stainless · 1 mm thick · 600 DPI engraving · ball-chain included.",
    defaultVariant: {
      skuSuffix: "std",
      name: "Standard",
      dimensionsMm: { w: 50, h: 28, d: 1 },
      weightGrams: 10,
    },
  },
  {
    slug: "bookmark-maple",
    name: "Maple bookmark",
    category: "bookmark",
    decorationMethod: "laser",
    basePriceCents: 1400,
    leadTimeDays: 4,
    descriptionMdx:
      "Solid maple bookmark with engraved art and a leather tassel.\n\nHard maple · 3 mm · finished with food-safe oil.",
    defaultVariant: {
      skuSuffix: "150",
      name: "150 × 30 mm",
      dimensionsMm: { w: 150, h: 30, d: 3 },
      weightGrams: 14,
    },
  },
  {
    slug: "challenge-coin-40",
    name: "Challenge coin",
    category: "coin",
    decorationMethod: "laser",
    basePriceCents: 1800,
    leadTimeDays: 5,
    descriptionMdx:
      "Brass coin engraved on both faces. Carries well.\n\nSolid brass · 40 mm diameter · engraved at 600 DPI.",
    defaultVariant: {
      skuSuffix: "40",
      name: "40 mm",
      dimensionsMm: { w: 40, d: 3, label: "40 mm · 3 mm thick" },
      weightGrams: 38,
    },
  },
  {
    slug: "deck-box-100",
    name: "Deck box — 100",
    category: "tcg_accessory",
    decorationMethod: "uv_print",
    basePriceCents: 4400,
    leadTimeDays: 6,
    descriptionMdx:
      "Holds 100 sleeved cards. UV-printed art with laser-cut accent panels.\n\n5 mm birch ply · UV print on exterior · magnet-closed lid.",
    defaultVariant: {
      skuSuffix: "100",
      name: "100-card",
      dimensionsMm: { w: 97, h: 76, d: 76 },
      weightGrams: 180,
    },
  },
  {
    slug: "phone-case-iphone-16",
    name: "Phone case — iPhone 16",
    category: "phone_case",
    decorationMethod: "uv_print",
    basePriceCents: 3800,
    leadTimeDays: 5,
    descriptionMdx:
      "Slim TPU/PC hybrid case with UV-printed art, edge-to-edge.\n\nTPU bumper + PC shell · UV-cured ink with clear top-coat.",
    defaultVariant: {
      skuSuffix: "16",
      name: "iPhone 16",
      dimensionsMm: { label: "Fits iPhone 16" },
      weightGrams: 28,
    },
  },
];

export async function runSeed(): Promise<void> {
  console.log("[seed] inserting product categories…");
  for (const c of CATEGORY_META) {
    await db
      .insert(productCategories)
      .values({
        category: c.category,
        displayName: c.displayName,
        blurb: c.blurb,
        sortOrder: c.sortOrder,
        isActive: true,
      })
      .onConflictDoNothing({ target: productCategories.category });
  }

  console.log("[seed] inserting products + default variants…");
  for (const p of SEED_PRODUCTS) {
    const productId = newId();
    const inserted = await db
      .insert(products)
      .values({
        id: productId,
        slug: p.slug,
        name: p.name,
        category: p.category,
        decorationMethod: p.decorationMethod,
        basePriceCents: p.basePriceCents,
        leadTimeDays: p.leadTimeDays,
        status: "active",
        descriptionMdx: p.descriptionMdx,
      })
      .onConflictDoNothing({ target: products.slug })
      .returning({ id: products.id });

    // Resolve product id (existing row if dupe; fresh insert otherwise).
    let resolvedId = inserted[0]?.id;
    if (!resolvedId) {
      const existing = await db.execute<{ id: string }>(
        sql`SELECT id FROM products WHERE slug = ${p.slug}`,
      );
      resolvedId = existing[0]?.id;
    }
    if (!resolvedId) {
      console.warn(`[seed] could not resolve product id for ${p.slug}`);
      continue;
    }

    const variantSku = `SF-${p.slug}-${p.defaultVariant.skuSuffix}`;
    const variantInserted = await db
      .insert(productVariants)
      .values({
        id: newId(),
        productId: resolvedId,
        sku: variantSku,
        name: p.defaultVariant.name,
        attributes: {},
        priceDeltaCents: p.defaultVariant.priceDeltaCents ?? 0,
        weightGrams: p.defaultVariant.weightGrams,
        dimensionsMm: p.defaultVariant.dimensionsMm,
      })
      .onConflictDoNothing({ target: productVariants.sku })
      .returning({ id: productVariants.id });

    let variantId = variantInserted[0]?.id;
    if (!variantId) {
      const existing = await db.execute<{ id: string }>(
        sql`SELECT id FROM product_variants WHERE sku = ${variantSku}`,
      );
      variantId = existing[0]?.id;
    }
    if (!variantId) continue;

    // One default decoration zone per variant. No natural unique key on
    // decoration_zones, so guard against duplicates by skipping variants that
    // already have a zone (keeps the seed idempotent).
    const zoneCount = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int as n FROM decoration_zones WHERE product_variant_id = ${variantId}`,
    );
    if ((zoneCount[0]?.n ?? 0) === 0) {
      const spec = ZONE_SPEC_BY_METHOD[p.decorationMethod];
      await db.insert(decorationZones).values({
        id: newId(),
        productVariantId: variantId,
        name: "Print area",
        kind: spec.kind,
        geometry: rectZoneForDimensions(p.defaultVariant.dimensionsMm),
        printSpec: {
          dpi: spec.dpi,
          colorProfile: spec.colorProfile,
          maxWidthMm: p.defaultVariant.dimensionsMm.w ?? null,
          maxHeightMm: p.defaultVariant.dimensionsMm.h ?? null,
          vectorRequired: spec.vectorRequired,
        },
        ordering: 0,
      });
    }
  }

  const productRows = await db.execute<{ productCount: number }>(
    sql`SELECT count(*)::int as "productCount" FROM products`,
  );
  const categoryRows = await db.execute<{ categoryCount: number }>(
    sql`SELECT count(*)::int as "categoryCount" FROM product_categories`,
  );
  const variantRows = await db.execute<{ variantCount: number }>(
    sql`SELECT count(*)::int as "variantCount" FROM product_variants`,
  );
  const zoneRows = await db.execute<{ zoneCount: number }>(
    sql`SELECT count(*)::int as "zoneCount" FROM decoration_zones`,
  );
  const productCount = productRows[0]?.productCount ?? 0;
  const categoryCount = categoryRows[0]?.categoryCount ?? 0;
  const variantCount = variantRows[0]?.variantCount ?? 0;
  const zoneCount = zoneRows[0]?.zoneCount ?? 0;
  console.log(
    `[seed] done — ${categoryCount} categories, ${productCount} products, ${variantCount} variants, ${zoneCount} zones`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed] failed", err);
      process.exit(1);
    });
}
