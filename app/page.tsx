import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { FamilyTile } from "@/components/brand/FamilyTile";
import { getActiveCategoriesWithStock } from "@/lib/queries/catalog";
import { materialFromCategory } from "@/lib/display/product";

/*
 * Home — the brand statement.
 *
 * Family tiles are DB-driven: only categories with at least one active
 * product appear, ordered by product_categories.sortOrder. Admin edits to
 * category metadata or product status surface here within seconds via
 * revalidateTag('categories'/'products').
 *
 * Hero copy and "Made this week" remain hardcoded for Phase 2a; both get
 * wired to site_settings / featured_products in a follow-up.
 */

/** Broken-grid span cycle. Index into the array by category position to get a
 *  CSS Grid column-span. Crafted to never land two same-width tiles next to
 *  each other and to read as editorial rhythm rather than a uniform grid. */
const TILE_SPANS = [
  "md:col-span-7",
  "md:col-span-5",
  "md:col-span-4",
  "md:col-span-3",
  "md:col-span-5",
  "md:col-span-7",
  "md:col-span-6",
  "md:col-span-6",
  "md:col-span-12",
] as const;

const TILE_SIZES: Array<"sm" | "md" | "lg"> = [
  "lg", "md", "sm", "sm", "md", "lg", "md", "md", "md",
];

export default async function Home() {
  const categories = await getActiveCategoriesWithStock();

  return (
    <>
      <SiteHeader />

      <main>
        {/* HERO --------------------------------------------------------------- */}
        <section className="surface-noise relative px-6 md:px-14 pt-16 md:pt-28 pb-24 md:pb-42">
          <div className="flex flex-col gap-10 md:gap-16">
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
              No. 04 · Inner-crystal cube, 80 mm
            </div>
            <h1
              className="font-display leading-[var(--leading-display)] tracking-[-0.02em] -mx-1 md:-mx-2"
              style={{
                fontSize: "var(--text-display)",
                fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 0',
                textWrap: "balance",
              }}
            >
              Forged
              <br />
              one at a time.
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-end">
              <p
                className="md:col-span-5 md:col-start-1 text-[color:var(--color-ink-800)]"
                style={{ fontSize: "var(--text-md)", textWrap: "pretty" }}
              >
                Custom-engraved cups, leather patches, dog tags, bookmarks,
                challenge coins, deck boxes, phone cases, and inner-crystal
                pieces. Each one made in a small shop in the Pacific Northwest,
                shipped within a week.
              </p>
              <div className="md:col-span-3 md:col-start-9 flex items-baseline gap-4">
                <Link
                  href="/products"
                  className="group inline-flex items-baseline gap-2 font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-950)] hover:text-[color:var(--color-ember-700)] transition-colors"
                >
                  See the catalog
                  <span
                    aria-hidden
                    className="inline-block transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* MADE THIS WEEK ---------------------------------------------------- */}
        <section className="hairline hairline-t px-6 md:px-14 py-16 md:py-24">
          <div className="flex items-baseline justify-between mb-10 md:mb-14">
            <h2
              className="font-display text-2xl md:text-3xl"
              style={{ fontVariationSettings: '"opsz" 32, "wght" 440' }}
            >
              Made this week.
            </h2>
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
              Week 22 · 2026
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] surface-noise hairline"
                style={{
                  background: `color-mix(in oklch, var(--color-paper-200) ${
                    70 + i * 5
                  }%, var(--color-mat-leather))`,
                }}
              />
            ))}
          </div>
        </section>

        {/* FAMILIES ---------------------------------------------------------- */}
        {categories.length > 0 ? (
          <section className="px-6 md:px-14 py-16 md:py-24">
            <div className="flex items-baseline justify-between mb-10 md:mb-14">
              <h2
                className="font-display text-2xl md:text-3xl"
                style={{ fontVariationSettings: '"opsz" 32, "wght" 440' }}
              >
                By the material.
              </h2>
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
                {categories.length.toString().padStart(2, "0")} families
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-min">
              {categories.map((cat, idx) => {
                const span = TILE_SPANS[idx % TILE_SPANS.length];
                const size = TILE_SIZES[idx % TILE_SIZES.length] ?? "md";
                return (
                  <div key={cat.category} className={span}>
                    <FamilyTile
                      href={`/products?category=${cat.category}`}
                      name={`${cat.displayName}.`}
                      caption={cat.blurb ?? ""}
                      material={materialFromCategory(cat.category)}
                      size={size}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
