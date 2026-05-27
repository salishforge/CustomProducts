import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { getCustomerOrders } from "@/lib/queries/orders";
import { formatPriceCents } from "@/lib/display/product";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession();
  const email = session.user.email;

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, email))
    .limit(1);

  const orders = customer ? await getCustomerOrders(customer.id) : [];

  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-12 md:pt-20 pb-12">
        <div className="flex items-baseline justify-between mb-12">
          <h1
            className="font-display text-4xl md:text-6xl leading-[1.05]"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 400', textWrap: "balance" }}
          >
            Account.
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
            {email}
          </span>
        </div>

        <section>
          <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-6">
            Orders
          </h2>
          {orders.length === 0 ? (
            <p className="text-sm text-[color:var(--color-ink-800)]">
              You haven&rsquo;t placed any orders yet.{" "}
              <Link
                href="/products"
                className="underline decoration-[color:var(--color-ember-500)] decoration-2 underline-offset-4"
              >
                Pick a piece
              </Link>{" "}
              from the catalog.
            </p>
          ) : (
            <ul className="flex flex-col">
              {orders.map((o) => (
                <li
                  key={o.id}
                  className="grid grid-cols-12 gap-4 items-baseline py-5 border-t border-[color:var(--color-paper-300)]"
                >
                  <div className="col-span-4 font-mono text-sm">
                    <Link
                      href={`/account/orders/${o.id}` as never}
                      className="text-[color:var(--color-ink-950)] hover:text-[color:var(--color-ember-700)] transition-colors"
                    >
                      {o.orderNumber}
                    </Link>
                  </div>
                  <div className="col-span-3 font-mono text-xs text-[color:var(--color-ink-600)] nums-tabular">
                    {o.placedAt ? new Date(o.placedAt).toLocaleDateString() : "—"}
                  </div>
                  <div className="col-span-3 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)]">
                    {o.status.replace("_", " ")}
                  </div>
                  <div className="col-span-2 text-right font-display text-xl nums-tabular"
                    style={{ fontVariationSettings: '"opsz" 22, "wght" 440' }}>
                    {formatPriceCents(o.totalCents)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
