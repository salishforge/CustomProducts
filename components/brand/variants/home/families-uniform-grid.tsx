import { FamilyTile } from "@/components/brand/FamilyTile";

import type { FamilyItem } from "./types";

/*
 * Families — uniform grid.
 *
 * Even three-up cards of equal height — the conventional catalog read. Exists
 * so the registry has a non-broken-grid option to demonstrate (and so the
 * brand-rule guard has something to reject on the home families section).
 */

export function FamiliesUniformGrid({ items }: { items: FamilyItem[] }) {
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {items.map((item) => (
          <FamilyTile
            key={item.category}
            href={item.href}
            name={item.name}
            caption={item.caption}
            material={item.material}
            size="md"
          />
        ))}
      </div>
    </section>
  );
}
