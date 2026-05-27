import Link from "next/link";
import { desc } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orders } from "@/drizzle/schema";
import { formatPriceCents } from "@/lib/display/product";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  pending_payment: "text-[color:var(--color-ink-600)] border-[color:var(--color-paper-300)]",
  paid: "text-[color:var(--color-ember-700)] border-[color:var(--color-ember-500)]/40",
  in_production: "text-[color:var(--color-ember-700)] border-[color:var(--color-ember-500)]/40",
  shipped: "text-[color:var(--color-mat-uv)] border-[color:var(--color-mat-uv)]/40",
  delivered: "text-[color:var(--color-ink-400)] border-[color:var(--color-paper-300)]",
  cancelled: "text-[color:var(--color-ink-400)] border-[color:var(--color-paper-300)]",
  refunded: "text-[color:var(--color-ink-400)] border-[color:var(--color-paper-300)]",
};

export default async function AdminOrdersList() {
  await requireAdmin();

  const rows = await db.select().from(orders).orderBy(desc(orders.placedAt));

  return (
    <div className="max-w-6xl">
      <header className="mb-10">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Commerce
        </p>
        <h1
          className="mt-2 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          Orders.
        </h1>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--color-ink-600)]">No orders yet.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[color:var(--color-paper-300)] text-left">
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Order
              </th>
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Placed
              </th>
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Status
              </th>
              <th className="py-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] text-right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr
                key={o.id}
                className="border-b border-[color:var(--color-paper-200)] hover:bg-[color:var(--color-paper-100)] transition-colors"
              >
                <td className="py-4">
                  <Link
                    href={`/admin/orders/${o.id}` as never}
                    className="font-mono text-sm text-[color:var(--color-ink-950)] hover:text-[color:var(--color-ember-700)] transition-colors"
                  >
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="py-4 font-mono text-xs text-[color:var(--color-ink-600)] nums-tabular">
                  {o.placedAt ? new Date(o.placedAt).toLocaleString() : "—"}
                </td>
                <td className="py-4">
                  <span
                    className={`inline-block px-2 py-0.5 border font-mono text-[0.6rem] uppercase tracking-[0.18em] ${STATUS_BADGE[o.status] ?? STATUS_BADGE.pending_payment}`}
                  >
                    {o.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-4 text-right font-mono text-sm nums-tabular">
                  {formatPriceCents(o.totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
