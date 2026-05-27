import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/drizzle/schema";
import { getOrderWithItems } from "@/lib/queries/orders";
import { formatPriceCents } from "@/lib/display/product";

export const dynamic = "force-dynamic";

export default async function CustomerOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, session.user.email))
    .limit(1);
  if (!customer) notFound();

  const result = await getOrderWithItems(id, customer.id);
  if (!result) notFound();
  const { order, items, stages } = result;

  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-12 md:pt-20 pb-12">
        <Link
          href="/account"
          className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← Account
        </Link>

        <div className="mt-6 flex items-baseline justify-between">
          <h1
            className="font-display text-4xl md:text-5xl leading-[1.05]"
            style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
          >
            {order.orderNumber}
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
            {order.status.replace("_", " ")}
          </span>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-12 gap-10">
          <section className="md:col-span-8">
            <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
              Line items
            </h2>
            <ul>
              {items.map((it) => {
                const snap = it.productSnapshot as {
                  name?: string;
                  variantName?: string;
                };
                const itemStages = stages.filter((s) => s.orderItemId === it.id);
                const latestStage = itemStages[0];
                return (
                  <li
                    key={it.id}
                    className="grid grid-cols-12 gap-4 py-5 border-t border-[color:var(--color-paper-300)]"
                  >
                    <div className="col-span-7">
                      <p className="font-display text-2xl" style={{ fontVariationSettings: '"opsz" 28, "wght" 440' }}>
                        {snap.name ?? "Product"}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[color:var(--color-ink-600)] nums-tabular">
                        {snap.variantName ?? ""} · ×{it.quantity}
                      </p>
                      <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                        Production:{" "}
                        <span className="text-[color:var(--color-ink-950)]">
                          {(latestStage?.stage ?? it.productionStatus).replace("_", " ")}
                        </span>
                      </p>
                    </div>
                    <div className="col-span-5 text-right font-display text-xl nums-tabular"
                      style={{ fontVariationSettings: '"opsz" 22, "wght" 440' }}>
                      {formatPriceCents(it.lineTotalCents)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="md:col-span-4 md:pl-8 md:border-l md:border-[color:var(--color-paper-300)]/60">
            <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-4">
              Totals
            </h2>
            <dl className="flex flex-col gap-2 font-mono text-sm nums-tabular">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatPriceCents(order.subtotalCents)}</dd></div>
              {order.taxCents > 0 ? (
                <div className="flex justify-between text-[color:var(--color-ink-600)]"><dt>Tax</dt><dd>{formatPriceCents(order.taxCents)}</dd></div>
              ) : null}
              {order.shippingCents > 0 ? (
                <div className="flex justify-between text-[color:var(--color-ink-600)]"><dt>Shipping</dt><dd>{formatPriceCents(order.shippingCents)}</dd></div>
              ) : null}
              <div className="flex justify-between mt-3 pt-3 border-t border-[color:var(--color-paper-300)] font-display text-xl"
                style={{ fontVariationSettings: '"opsz" 22, "wght" 440' }}>
                <dt>Total</dt><dd>{formatPriceCents(order.totalCents)}</dd>
              </div>
            </dl>

            {order.trackingNumber ? (
              <div className="mt-8">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-2">
                  Shipping
                </p>
                <p className="font-mono text-sm">{order.trackingCarrier} {order.trackingNumber}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
