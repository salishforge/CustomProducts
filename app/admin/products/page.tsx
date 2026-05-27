import Link from "next/link";
import { desc } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products } from "@/drizzle/schema";

export const dynamic = "force-dynamic"; // admin views read live, no cache

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const STATUS_BADGE: Record<"draft" | "active" | "archived", string> = {
  draft: "text-[color:var(--color-ink-600)] border-[color:var(--color-paper-300)]",
  active: "text-[color:var(--color-ember-700)] border-[color:var(--color-ember-500)]/40",
  archived: "text-[color:var(--color-ink-400)] border-[color:var(--color-paper-200)]",
};

export default async function AdminProductsList() {
  await requireAdmin();

  const rows = await db
    .select()
    .from(products)
    .orderBy(desc(products.updatedAt));

  return (
    <div className="max-w-6xl">
      <header className="flex items-baseline justify-between mb-10">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
            Catalog
          </p>
          <h1
            className="mt-2 font-display text-4xl leading-[1.1]"
            style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
          >
            Products.
          </h1>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center px-5 py-2.5 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] hover:bg-[color:var(--color-ember-900)] transition-colors"
        >
          + New product
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="border border-dashed border-[color:var(--color-paper-300)] p-12 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
            No products yet
          </p>
          <p className="mt-3 text-[color:var(--color-ink-800)]">
            Add your first product to populate the catalog.
          </p>
          <Link
            href="/admin/products/new"
            className="mt-6 inline-flex items-center px-5 py-2.5 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em]"
          >
            + New product
          </Link>
        </div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[color:var(--color-paper-300)] text-left">
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Name
              </th>
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Category
              </th>
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Status
              </th>
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] text-right">
                Price
              </th>
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] text-right">
                Lead time
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[color:var(--color-paper-200)] hover:bg-[color:var(--color-paper-100)] transition-colors"
              >
                <td className="py-4">
                  <Link
                    href={`/admin/products/${p.id}` as never}
                    className="font-display text-lg text-[color:var(--color-ink-950)] hover:text-[color:var(--color-ember-700)] transition-colors"
                    style={{ fontVariationSettings: '"opsz" 22, "wght" 460' }}
                  >
                    {p.name}
                  </Link>
                  <div className="font-mono text-[0.7rem] text-[color:var(--color-ink-600)]">
                    {p.slug}
                  </div>
                </td>
                <td className="py-4 font-mono text-xs text-[color:var(--color-ink-800)]">
                  {p.category}
                </td>
                <td className="py-4">
                  <span
                    className={`inline-block px-2 py-0.5 border font-mono text-[0.6rem] uppercase tracking-[0.18em] ${STATUS_BADGE[p.status]}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-4 text-right font-mono text-sm nums-tabular text-[color:var(--color-ink-950)]">
                  {formatPrice(p.basePriceCents)}
                </td>
                <td className="py-4 text-right font-mono text-sm nums-tabular text-[color:var(--color-ink-800)]">
                  {p.leadTimeDays}d
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
