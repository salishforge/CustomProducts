import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/drizzle/schema";
import { getOrderWithItems } from "@/lib/queries/orders";
import { formatPriceCents } from "@/lib/display/product";
import { PrimaryButton, SecondaryButton } from "@/components/admin/Field";

import {
  advanceOrderItemStageAction,
  setOrderStatusAction,
} from "./_actions";

export const dynamic = "force-dynamic";

const STAGE_NEXT: Record<string, string | null> = {
  pending: "files_ready",
  files_ready: "in_queue",
  in_queue: "in_production",
  in_production: "qc",
  qc: "packed",
  packed: "shipped",
  shipped: null,
};

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const result = await getOrderWithItems(id);
  if (!result) notFound();
  const { order, items, stages } = result;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, order.customerId))
    .limit(1);

  return (
    <div className="max-w-5xl">
      <header className="mb-8">
        <Link
          href="/admin/orders"
          className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← Orders
        </Link>
        <div className="mt-4 flex items-baseline justify-between">
          <h1
            className="font-display text-4xl leading-[1.1]"
            style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
          >
            {order.orderNumber}
          </h1>
          <form action={setOrderStatusAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={order.id} />
            <select
              name="status"
              defaultValue={order.status}
              className="px-3 py-2 text-sm bg-[color:var(--color-paper-50)] border border-[color:var(--color-paper-300)] focus:outline-none focus:border-[color:var(--color-ink-800)]"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
            <PrimaryButton type="submit">Save</PrimaryButton>
          </form>
        </div>
        <p className="mt-2 font-mono text-xs text-[color:var(--color-ink-600)] nums-tabular">
          {order.placedAt ? new Date(order.placedAt).toLocaleString() : "—"} · {customer?.email}
        </p>
      </header>

      <section className="mb-12">
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
          Line items
        </h2>
        <ul>
          {items.map((it) => {
            const snap = it.productSnapshot as { name?: string; variantName?: string; sku?: string };
            const nextStage = STAGE_NEXT[it.productionStatus];
            const itemStages = stages
              .filter((s) => s.orderItemId === it.id)
              .map((s) => s.stage);
            return (
              <li
                key={it.id}
                className="grid grid-cols-12 gap-4 py-5 border-t border-[color:var(--color-paper-300)]"
              >
                <div className="col-span-5">
                  <p
                    className="font-display text-xl"
                    style={{ fontVariationSettings: '"opsz" 24, "wght" 440' }}
                  >
                    {snap.name ?? "Product"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[color:var(--color-ink-600)]">
                    {snap.sku ?? ""} · {snap.variantName ?? ""} · ×{it.quantity}
                  </p>
                  <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ember-700)]">
                    {it.customizationSnapshot ? "custom design" : "as shown"}
                  </p>
                </div>
                <div className="col-span-4">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-2">
                    Production
                  </p>
                  <p className="font-mono text-sm">
                    {it.productionStatus.replace("_", " ")}
                  </p>
                  {itemStages.length > 0 ? (
                    <p className="mt-1 font-mono text-[0.6rem] text-[color:var(--color-ink-400)]">
                      history: {itemStages.join(" → ")}
                    </p>
                  ) : null}
                  {Array.isArray(it.printReadyFiles) && (it.printReadyFiles as unknown[]).length > 0 ? (
                    <div className="mt-3">
                      <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-1">
                        Print files
                      </p>
                      <ul className="flex flex-col gap-0.5">
                        {(it.printReadyFiles as Array<{ filename: string; kind: string }>).map((f) => (
                          <li key={f.filename}>
                            <a
                              href={`/api/admin/print-fixtures/${order.id}/${it.id}/${encodeURIComponent(f.filename)}`}
                              className="font-mono text-xs text-[color:var(--color-ink-800)] hover:text-[color:var(--color-ember-700)] transition-colors"
                            >
                              ↓ {f.filename}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="col-span-3 text-right">
                  <p className="font-display text-lg nums-tabular"
                    style={{ fontVariationSettings: '"opsz" 22, "wght" 440' }}>
                    {formatPriceCents(it.lineTotalCents)}
                  </p>
                  {nextStage ? (
                    <form action={advanceOrderItemStageAction} className="mt-3">
                      <input type="hidden" name="orderItemId" value={it.id} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="targetStage" value={nextStage} />
                      <SecondaryButton type="submit" className="!py-1.5 !text-[0.6rem]">
                        → {nextStage.replace("_", " ")}
                      </SecondaryButton>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-10">
        <div>
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-3">
            Customer
          </h2>
          <p className="font-mono text-sm">{customer?.displayName ?? customer?.email}</p>
          <p className="font-mono text-xs text-[color:var(--color-ink-600)] mt-1">{customer?.email}</p>
          {order.shippingAddress ? (
            <pre className="mt-3 font-mono text-xs whitespace-pre-wrap text-[color:var(--color-ink-800)]">
              {JSON.stringify(order.shippingAddress, null, 2)}
            </pre>
          ) : null}
        </div>
        <div>
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-3">
            Totals
          </h2>
          <dl className="flex flex-col gap-2 font-mono text-sm nums-tabular">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPriceCents(order.subtotalCents)}</dd></div>
            <div className="flex justify-between text-[color:var(--color-ink-600)]"><dt>Tax</dt><dd>{formatPriceCents(order.taxCents)}</dd></div>
            <div className="flex justify-between text-[color:var(--color-ink-600)]"><dt>Shipping</dt><dd>{formatPriceCents(order.shippingCents)}</dd></div>
            <div className="flex justify-between mt-2 pt-2 border-t border-[color:var(--color-paper-300)] font-display text-xl"
              style={{ fontVariationSettings: '"opsz" 22, "wght" 440' }}>
              <dt>Total</dt><dd>{formatPriceCents(order.totalCents)}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}
