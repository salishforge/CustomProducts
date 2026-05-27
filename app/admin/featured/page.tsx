import { asc, eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { featuredProducts, products } from "@/drizzle/schema";
import {
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextInput,
} from "@/components/admin/Field";

import { addFeaturedAction, removeFeaturedAction } from "./_actions";

export const dynamic = "force-dynamic";

const SLOTS = [
  { value: "home_hero", label: "Home — hero" },
  { value: "home_secondary", label: "Home — secondary" },
  { value: "made_this_week", label: "Made this week strip" },
];

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

export default async function AdminFeatured() {
  await requireAdmin();

  const active = await db
    .select()
    .from(products)
    .where(eq(products.status, "active"))
    .orderBy(asc(products.name));

  const current = await db
    .select({ featured: featuredProducts, product: products })
    .from(featuredProducts)
    .innerJoin(products, eq(products.id, featuredProducts.productId))
    .orderBy(asc(featuredProducts.slot), asc(featuredProducts.sortOrder));

  return (
    <div className="max-w-4xl">
      <header className="mb-10">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Catalog
        </p>
        <h1
          className="mt-2 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          Featured.
        </h1>
        <p className="mt-4 text-sm text-[color:var(--color-ink-800)] max-w-2xl">
          Curate which products appear in the home hero, the home secondary
          slot, and the &ldquo;made this week&rdquo; strip. Optional date range
          schedules the entry to surface only between those dates.
        </p>
      </header>

      <section className="mb-14">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Currently featured
        </h2>
        {current.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-600)]">Nothing featured yet.</p>
        ) : (
          <ul className="flex flex-col">
            {current.map((row) => (
              <li
                key={row.featured.id}
                className="border-t border-[color:var(--color-paper-300)] py-4 grid grid-cols-12 gap-4 items-center"
              >
                <div className="col-span-4">
                  <p className="font-display text-lg" style={{ fontVariationSettings: '"opsz" 22, "wght" 440' }}>
                    {row.product.name}
                  </p>
                  <p className="font-mono text-[0.65rem] text-[color:var(--color-ink-600)] mt-1">
                    {row.product.slug}
                  </p>
                </div>
                <div className="col-span-3 font-mono text-xs">{row.featured.slot}</div>
                <div className="col-span-2 nums-tabular font-mono text-xs">#{row.featured.sortOrder}</div>
                <div className="col-span-2 font-mono text-[0.65rem] text-[color:var(--color-ink-600)]">
                  {fmtDate(row.featured.startsAt)} → {fmtDate(row.featured.endsAt)}
                </div>
                <form action={removeFeaturedAction} className="col-span-1 flex justify-end">
                  <input type="hidden" name="id" value={row.featured.id} />
                  <SecondaryButton type="submit">Remove</SecondaryButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Add to a slot
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-[color:var(--color-ink-600)]">
            No active products to feature. Activate a product first.
          </p>
        ) : (
          <form action={addFeaturedAction} className="grid grid-cols-12 gap-4">
            <div className="col-span-5">
              <Field label="Product" htmlFor="productId" required>
                <SelectInput id="productId" name="productId" required>
                  {active.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.slug}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <div className="col-span-3">
              <Field label="Slot" htmlFor="slot" required>
                <SelectInput id="slot" name="slot" required>
                  {SLOTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Sort" htmlFor="sortOrder">
                <NumberInput id="sortOrder" name="sortOrder" min={0} defaultValue={0} />
              </Field>
            </div>
            <div className="col-span-2 flex items-end">
              <PrimaryButton type="submit" className="w-full">
                Add
              </PrimaryButton>
            </div>
            <div className="col-span-3">
              <Field label="Starts at" htmlFor="startsAt" hint="Optional">
                <TextInput id="startsAt" name="startsAt" type="datetime-local" />
              </Field>
            </div>
            <div className="col-span-3">
              <Field label="Ends at" htmlFor="endsAt" hint="Optional">
                <TextInput id="endsAt" name="endsAt" type="datetime-local" />
              </Field>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
