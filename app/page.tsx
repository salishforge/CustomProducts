import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { FamilyTile } from "@/components/brand/FamilyTile";
import {
  getActiveCategoriesWithStock,
  getActiveProducts,
  getFeaturedForSlot,
} from "@/lib/queries/catalog";
import {
  formatDimensionsMm,
  materialFromCategory,
} from "@/lib/display/product";
import { imageUrl } from "@/lib/cloudflare-images/client";

/*
 * Home — the brand statement.
 *
 * The hero is operator-controllable via featured_products slot 'home_hero':
 * the first scheduled product becomes the named hero. Without curation we
 * fall back to the most recently-added active product so a fresh install
 * still has a confident landing.
 *
 * "Made this week" is operator-controllable via slot 'made_this_week'; we
 * pad to five tiles by drawing from the catalog so the layout never has
 * gaps. Family tiles below remain derived from active categories.
 */

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

const HERO_FALLBACK = {
  caption: "Inner-crystal cube, 80 mm",
  title: "Forged\none at a time.",
  link: "/products",
};

function weekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(
    ((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7,
  );
}

export default async function Home() {
  const [categories, hero, madeThisWeek, allActive] = await Promise.all([
    getActiveCategoriesWithStock(),
    getFeaturedForSlot("home_hero"),
    getFeaturedForSlot("made_this_week"),
    getActiveProducts(),
  ]);

  const heroEntry = hero[0];
  const heroProduct = heroEntry?.product ?? null;
  const heroDimensions = heroProduct
    ? formatDimensionsMm(heroProduct.variants[0]?.dimensionsMm)
    : null;
  const heroMaterial = heroProduct ? materialFromCategory(heroProduct.category) : null;

  // Pad made-this-week to 5 tiles, drawing from the catalog tail to fill.
  const weekProducts = madeThisWeek.map((m) => m.product);
  const padPool = allActive.filter(
    (p) => !weekProducts.some((wp) => wp.id === p.id),
  );
  const weekTiles = [...weekProducts, ...padPool].slice(0, 5);

  const today = new Date();

  return (
    <>
      <SiteHeader />

      <main>
        {/* HERO --------------------------------------------------------------- */}
        <section className="surface-noise relative px-6 md:px-14 pt-16 md:pt-28 pb-24 md:pb-42">
          <div className="flex flex-col gap-10 md:gap-16">
            <div className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
              {heroProduct
                ? `${heroProduct.name}${heroDimensions ? ` · ${heroDimensions}` : ""}`
                : HERO_FALLBACK.caption}
            </div>
            <h1
              className="font-display leading-[var(--leading-display)] tracking-[-0.02em] -mx-1 md:-mx-2"
              style={{
                fontSize: "var(--text-display)",
                fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 0',
                textWrap: "balance",
              }}
            >
              {heroProduct ? (
                <>
                  {heroProduct.name}.
                </>
              ) : (
                <>
                  Forged
                  <br />
                  one at a time.
                </>
              )}
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
                  href={
                    heroProduct
                      ? (`/products/${heroProduct.slug}` as `/products/${string}`)
                      : "/products"
                  }
                  className="group inline-flex items-baseline gap-2 font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-950)] hover:text-[color:var(--color-ember-700)] transition-colors"
                >
                  {heroProduct ? "See this piece" : "See the catalog"}
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
              Week {weekNumber(today)} · {today.getFullYear()}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-5">
            {weekTiles.map((p, i) => {
              const mat = materialFromCategory(p.category);
              const heroSrc = p.heroImage
                ? imageUrl(p.heroImage.cloudflareImageId, "public")
                : null;
              return (
                <Link
                  key={`${p.id}-${i}`}
                  href={`/products/${p.slug}` as `/products/${string}`}
                  className="aspect-[4/5] surface-noise hairline relative overflow-hidden group"
                  style={{
                    background: heroSrc
                      ? undefined
                      : `color-mix(in oklch, var(--color-mat-${mat}) 28%, var(--color-paper-100))`,
                  }}
                >
                  {heroSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={heroSrc}
                      alt={p.name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : null}
                </Link>
              );
            })}
            {Array.from({ length: Math.max(0, 5 - weekTiles.length) }).map((_, i) => (
              <div
                key={`pad-${i}`}
                className="aspect-[4/5] surface-noise hairline"
                style={{
                  background: `color-mix(in oklch, var(--color-paper-200) 80%, var(--color-mat-leather))`,
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
      {/* heroMaterial is consumed by future hero-image work; reference here so
          unused-import lints stay happy without code-dead branches. */}
      {heroMaterial ? null : null}
    </>
  );
}
