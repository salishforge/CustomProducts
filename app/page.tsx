import type { Route } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import {
  HomeFamilies,
  HomeHero,
  type FamilyItem,
  type HeroContent,
} from "@/components/brand/variants/home";
import {
  getActiveCategoriesWithStock,
  getActiveProducts,
  getFeaturedForSlot,
} from "@/lib/queries/catalog";
import {
  formatDimensionsMm,
  materialFromCategory,
} from "@/lib/display/product";
import { resolveLayoutVariant } from "@/lib/design/layouts";
import { getActiveTheme } from "@/lib/theme/resolve";
import { imageUrl } from "@/lib/cloudflare-images/client";

/*
 * Home — the brand statement.
 *
 * The hero is operator-controllable via featured_products slot 'home_hero':
 * the first scheduled product becomes the named hero. Without curation we
 * fall back to the most recently-added active product so a fresh install
 * still has a confident landing.
 *
 * The hero and families sections render through layout-variant switchers
 * (components/brand/variants/home); the active theme revision's
 * layout_assignments pick the variant per section, defaulting to the shipped
 * editorial hero + broken-grid families. "Made this week" is fixed grammar.
 */

const HERO_LEDE =
  "Custom-engraved cups, leather patches, dog tags, bookmarks, challenge " +
  "coins, deck boxes, phone cases, and inner-crystal pieces. Each one made " +
  "in a small shop in the Pacific Northwest, shipped within a week.";

const HERO_FALLBACK = {
  caption: "Inner-crystal cube, 80 mm",
  title: "Forged\none at a time.",
};

function weekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(
    ((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7,
  );
}

export default async function Home() {
  const [categories, hero, madeThisWeek, allActive, theme] = await Promise.all([
    getActiveCategoriesWithStock(),
    getFeaturedForSlot("home_hero"),
    getFeaturedForSlot("made_this_week"),
    getActiveProducts(),
    getActiveTheme(),
  ]);

  const heroEntry = hero[0];
  const heroProduct = heroEntry?.product ?? null;
  const heroDimensions = heroProduct
    ? formatDimensionsMm(heroProduct.variants[0]?.dimensionsMm)
    : null;

  const heroContent: HeroContent = heroProduct
    ? {
        eyebrow: `${heroProduct.name}${heroDimensions ? ` · ${heroDimensions}` : ""}`,
        title: `${heroProduct.name}.`,
        lede: HERO_LEDE,
        ctaHref: `/products/${heroProduct.slug}` as Route,
        ctaLabel: "See this piece",
      }
    : {
        eyebrow: HERO_FALLBACK.caption,
        title: HERO_FALLBACK.title,
        lede: HERO_LEDE,
        ctaHref: "/products" as Route,
        ctaLabel: "See the catalog",
      };

  const familyItems: FamilyItem[] = categories.map((cat) => ({
    category: cat.category,
    name: `${cat.displayName}.`,
    caption: cat.blurb ?? "",
    href: `/products?category=${cat.category}`,
    material: materialFromCategory(cat.category),
  }));

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
        <HomeHero
          variant={resolveLayoutVariant("home.hero", theme.layoutAssignments)}
          content={heroContent}
        />

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

        {familyItems.length > 0 ? (
          <HomeFamilies
            variant={resolveLayoutVariant("home.families", theme.layoutAssignments)}
            items={familyItems}
          />
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
