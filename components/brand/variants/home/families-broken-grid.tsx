import { FamilyTile } from "@/components/brand/FamilyTile";

import type { FamilyItem } from "./types";

/*
 * Families — broken grid (shipped default).
 *
 * Aesop-rhythm tiles: the span and height cycle so the grid never reads as a
 * uniform 3-up. The cycles are deliberately not a clean divisor of any likely
 * family count, so adding a category shifts the rhythm rather than tiling.
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

export function FamiliesBrokenGrid({ items }: { items: FamilyItem[] }) {
  return (
    <section className="px-6 md:px-14 py-16 md:py-24">
      <div className="flex items-baseline justify-between mb-10 md:mb-14">
        <h2
          className="font-display text-2xl md:text-3xl"
          style={{ fontVariationSettings: '"opsz" 32, "wght" 440' }}
        >
          By the material.
        </h2>
        <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
          {items.length.toString().padStart(2, "0")} families
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-min">
        {items.map((item, idx) => {
          const span = TILE_SPANS[idx % TILE_SPANS.length];
          const size = TILE_SIZES[idx % TILE_SIZES.length] ?? "md";
          return (
            <div key={item.category} className={span}>
              <FamilyTile
                href={item.href}
                name={item.name}
                caption={item.caption}
                material={item.material}
                size={size}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
