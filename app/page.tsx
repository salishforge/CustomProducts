import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { FamilyTile } from "@/components/brand/FamilyTile";

/*
 * Home — the brand statement.
 *
 * Three sections that scroll on a quiet rhythm:
 *   1. Single hero product, named in GT Sectra/Fraunces at display scale.
 *   2. "Made this week" strip (placeholder until photography exists).
 *   3. Family entry points — six broken-grid tiles.
 *
 * Restrained chrome. Generous whitespace. One accent color. The whole site
 * dies if this page looks like another AI-generated React landing.
 */

export default function Home() {
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
              Week 21 · 2026
            </span>
          </div>
          {/* Placeholder strip — replaced when photography exists. */}
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
        <section className="px-6 md:px-14 py-16 md:py-24">
          <div className="flex items-baseline justify-between mb-10 md:mb-14">
            <h2
              className="font-display text-2xl md:text-3xl"
              style={{ fontVariationSettings: '"opsz" 32, "wght" 440' }}
            >
              By the material.
            </h2>
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
              Six families
            </span>
          </div>
          {/* Broken-grid rhythm: 3-2-3-1 across rows on desktop, single column on mobile.
              CSS Grid with explicit areas. */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-min">
            <div className="md:col-span-7">
              <FamilyTile
                href="/products?category=crystal_engraving"
                name="Crystal."
                caption="Inner-engraved"
                material="crystal"
                size="lg"
              />
            </div>
            <div className="md:col-span-5 md:row-span-2 flex flex-col gap-4 md:gap-6">
              <FamilyTile
                href="/products?category=drinkware"
                name="Drinkware."
                caption="UV print on tumblers"
                material="uv"
                size="md"
              />
              <FamilyTile
                href="/products?category=leather_patch"
                name="Leather."
                caption="Laser-engraved patches"
                material="leather"
                size="md"
              />
            </div>
            <div className="md:col-span-4">
              <FamilyTile
                href="/products?category=coin"
                name="Coins & tags."
                caption="Brass, steel, copper"
                material="metal"
                size="sm"
              />
            </div>
            <div className="md:col-span-3">
              <FamilyTile
                href="/products?category=bookmark"
                name="Bookmarks."
                caption="Maple, walnut, cherry"
                material="laser"
                size="sm"
              />
            </div>
            <div className="md:col-span-12">
              <FamilyTile
                href="/products?category=tcg_accessory"
                name="Deck boxes, cases, playmats."
                caption="For the table"
                material="uv"
                size="md"
              />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
