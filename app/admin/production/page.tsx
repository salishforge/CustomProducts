import Link from "next/link";
import { eq, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, orderItems, orders } from "@/drizzle/schema";
import { advanceOrderItemStageAction } from "../orders/[id]/_actions";

export const dynamic = "force-dynamic";

const COLUMNS: Array<{ stage: string; label: string }> = [
  { stage: "pending", label: "Queue" },
  { stage: "files_ready", label: "Files ready" },
  { stage: "in_queue", label: "In queue" },
  { stage: "in_production", label: "In production" },
  { stage: "qc", label: "QC" },
  { stage: "packed", label: "Packed" },
  { stage: "shipped", label: "Shipped" },
];

const STAGE_NEXT: Record<string, string | null> = {
  pending: "files_ready",
  files_ready: "in_queue",
  in_queue: "in_production",
  in_production: "qc",
  qc: "packed",
  packed: "shipped",
  shipped: null,
};

export default async function ProductionBoard() {
  await requireAdmin();

  // Pull every order_item not yet shipped + the related order + customer
  // email for the card label. shipped items kept for the rightmost column
  // limited to recent 25 so the column stays usable.
  const rows = await db
    .select({
      item: orderItems,
      order: orders,
      customerEmail: customers.email,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .orderBy(sql`${orders.placedAt} desc nulls last`);

  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const stage = r.item.productionStatus;
    const arr = grouped.get(stage) ?? [];
    arr.push(r);
    grouped.set(stage, arr);
  }

  return (
    <div className="max-w-[1600px]">
      <header className="mb-8">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          Commerce
        </p>
        <div className="mt-2 flex items-baseline justify-between">
          <h1
            className="font-display text-4xl leading-[1.1]"
            style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
          >
            Production.
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
            {rows.length.toString().padStart(2, "0")} items in flight
          </span>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-3 overflow-x-auto">
        {COLUMNS.map((col) => {
          const items = (grouped.get(col.stage) ?? []).slice(
            0,
            col.stage === "shipped" ? 25 : 999,
          );
          return (
            <section
              key={col.stage}
              className="min-w-[180px] bg-[color:var(--color-paper-100)] p-3 flex flex-col gap-2"
            >
              <header className="flex items-baseline justify-between pb-2 border-b border-[color:var(--color-paper-300)]">
                <h2 className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-800)]">
                  {col.label}
                </h2>
                <span className="font-mono text-[0.6rem] text-[color:var(--color-ink-600)] nums-tabular">
                  {items.length}
                </span>
              </header>
              {items.map((r) => {
                const snap = r.item.productSnapshot as { name?: string; variantName?: string };
                const nextStage = STAGE_NEXT[r.item.productionStatus];
                return (
                  <article
                    key={r.item.id}
                    className="bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] p-3 flex flex-col gap-2"
                  >
                    <Link
                      href={`/admin/orders/${r.order.id}` as never}
                      className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ember-700)] hover:text-[color:var(--color-ember-900)] transition-colors"
                    >
                      {r.order.orderNumber}
                    </Link>
                    <p
                      className="font-display text-sm leading-tight"
                      style={{ fontVariationSettings: '"opsz" 18, "wght" 440' }}
                    >
                      {snap.name ?? "Item"}
                    </p>
                    <p className="font-mono text-[0.6rem] text-[color:var(--color-ink-600)]">
                      {snap.variantName ?? ""} · ×{r.item.quantity}
                    </p>
                    <p className="font-mono text-[0.55rem] text-[color:var(--color-ink-400)] truncate">
                      {r.customerEmail}
                    </p>
                    {nextStage ? (
                      <form action={advanceOrderItemStageAction}>
                        <input type="hidden" name="orderItemId" value={r.item.id} />
                        <input type="hidden" name="orderId" value={r.order.id} />
                        <input type="hidden" name="targetStage" value={nextStage} />
                        <button
                          type="submit"
                          className="w-full text-left font-mono text-[0.55rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors py-1 border-t border-[color:var(--color-paper-300)] mt-1"
                        >
                          → {nextStage.replace("_", " ")}
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
              {items.length === 0 ? (
                <p className="font-mono text-[0.65rem] text-[color:var(--color-ink-400)] italic px-1">
                  —
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
