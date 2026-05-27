/*
 * Idempotent dev seed.
 *
 * Populates product_categories metadata for all 9 enum values and inserts the
 * 8 launch products. Safe to re-run — uses ON CONFLICT DO NOTHING on the
 * natural keys (category PK, product slug).
 *
 * Run via: `pnpm exec tsx lib/db/seed.ts` (with DATABASE_URL set).
 */

import { sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { productCategories, products } from "@/drizzle/schema";
import { seedProducts } from "@/lib/seed/products";

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

const MATERIAL_TO_METHOD = {
  laser: "laser",
  uv: "uv_print",
  crystal: "crystal_engrave",
  leather: "laser",
  metal: "laser",
} as const;

const MATERIAL_TO_CATEGORY: Record<string, string> = {
  crystal: "crystal_engraving",
  uv: "drinkware", // overridden per slug below
  leather: "leather_patch",
  metal: "coin",   // overridden per slug
  laser: "bookmark",
};

const SLUG_CATEGORY_OVERRIDES: Record<string, { category: string; method: string }> = {
  "tumbler-12oz-black":   { category: "drinkware",         method: "uv_print" },
  "leather-patch-3x2":    { category: "leather_patch",     method: "laser" },
  "dog-tag-mil":          { category: "dog_tag",           method: "laser" },
  "bookmark-maple":       { category: "bookmark",          method: "laser" },
  "challenge-coin-40":    { category: "coin",              method: "laser" },
  "deck-box-100":         { category: "tcg_accessory",     method: "uv_print" },
  "phone-case-iphone-16": { category: "phone_case",        method: "uv_print" },
  "crystal-cube-80":      { category: "crystal_engraving", method: "crystal_engrave" },
};

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

  console.log("[seed] inserting products…");
  for (const p of seedProducts) {
    const override = SLUG_CATEGORY_OVERRIDES[p.slug] ?? {
      category: MATERIAL_TO_CATEGORY[p.material] ?? "bookmark",
      method: MATERIAL_TO_METHOD[p.material] ?? "laser",
    };
    await db
      .insert(products)
      .values({
        id: newId(),
        slug: p.slug,
        name: p.name,
        category: override.category as never,
        decorationMethod: override.method as never,
        basePriceCents: p.basePriceCents,
        leadTimeDays: p.leadDays,
        status: "active",
        descriptionMdx: `${p.shortDescription}\n\n${p.fabrication}`,
      })
      .onConflictDoNothing({ target: products.slug });
  }

  const productRows = await db.execute<{ productCount: number }>(
    sql`SELECT count(*)::int as "productCount" FROM products`,
  );
  const categoryRows = await db.execute<{ categoryCount: number }>(
    sql`SELECT count(*)::int as "categoryCount" FROM product_categories`,
  );
  const productCount = productRows[0]?.productCount ?? 0;
  const categoryCount = categoryRows[0]?.categoryCount ?? 0;
  console.log(`[seed] done — ${categoryCount} categories, ${productCount} products`);
}

// Allow `pnpm exec tsx lib/db/seed.ts` from the project root.
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed] failed", err);
      process.exit(1);
    });
}
