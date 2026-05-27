import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { getSession } from "@/lib/auth";
import { getCurrentCartLines } from "@/lib/queries/cart";
import { formatPriceCents } from "@/lib/display/product";

import {
  removeCartItemAction,
  updateCartItemQuantityAction,
} from "./_actions";
import { createCheckoutSessionAction } from "./_checkout";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;
  const { lines, subtotalCents } = await getCurrentCartLines(customerId);

  if (lines.length === 0) {
    return (
      <>
        <SiteHeader />
        <main className="px-6 md:px-14 pt-12 md:pt-20 pb-12">
          <h1
            className="font-display text-4xl md:text-6xl leading-[1.05]"
            style={{
              fontVariationSettings: '"opsz" 96, "wght" 400',
              textWrap: "balance",
            }}
          >
            Cart.
          </h1>
          <div className="mt-16 md:mt-24 max-w-md">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
              Nothing on the bench yet.
            </p>
            <p className="mt-3 text-[color:var(--color-ink-800)]" style={{ textWrap: "pretty" }}>
              Pick a piece from the{" "}
              <Link
                href="/products"
                className="underline decoration-[color:var(--color-ember-500)] decoration-2 underline-offset-4"
              >
                catalog
              </Link>{" "}
              and start customizing.
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-12 md:pt-20 pb-12">
        <h1
          className="font-display text-4xl md:text-6xl leading-[1.05] mb-12 md:mb-16"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 400', textWrap: "balance" }}
        >
          Cart.
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14">
          <section className="md:col-span-8 flex flex-col">
            {lines.map((line) => (
              <div
                key={line.item.id}
                className="grid grid-cols-12 gap-4 items-start py-6 border-t border-[color:var(--color-paper-300)]"
              >
                <div className="col-span-2">
                  <div className="aspect-[4/5] surface-noise hairline bg-[color:var(--color-paper-200)]" />
                </div>
                <div className="col-span-7">
                  <p
                    className="font-display text-2xl"
                    style={{ fontVariationSettings: '"opsz" 28, "wght" 440' }}
                  >
                    {line.product.name}
                  </p>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] nums-tabular">
                    {line.variant.name} · {line.draft ? "custom design" : "as shown"}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <form action={updateCartItemQuantityAction} className="flex items-center gap-2">
                      <input type="hidden" name="cartItemId" value={line.item.id} />
                      <input
                        type="number"
                        name="quantity"
                        min={1}
                        max={99}
                        defaultValue={line.item.quantity}
                        className="w-16 px-2 py-1 text-sm border border-[color:var(--color-paper-300)] focus:border-[color:var(--color-ink-800)] focus:outline-none nums-tabular"
                      />
                      <button
                        type="submit"
                        className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
                      >
                        Update
                      </button>
                    </form>
                    <form action={removeCartItemAction}>
                      <input type="hidden" name="cartItemId" value={line.item.id} />
                      <button
                        type="submit"
                        className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ember-700)] hover:text-[color:var(--color-ember-900)] transition-colors"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <p className="font-display text-xl nums-tabular"
                    style={{ fontVariationSettings: '"opsz" 22, "wght" 440' }}
                  >
                    {formatPriceCents(line.item.unitPriceCents * line.item.quantity)}
                  </p>
                  <p className="mt-1 font-mono text-[0.65rem] text-[color:var(--color-ink-600)] nums-tabular">
                    {formatPriceCents(line.item.unitPriceCents)} × {line.item.quantity}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <aside className="md:col-span-4 md:pl-8 md:border-l md:border-[color:var(--color-paper-300)]/60">
            <div className="flex items-baseline justify-between pb-4 border-b border-[color:var(--color-paper-300)]">
              <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
                Subtotal
              </span>
              <span
                className="font-display text-3xl nums-tabular"
                style={{ fontVariationSettings: '"opsz" 36, "wght" 440' }}
              >
                {formatPriceCents(subtotalCents)}
              </span>
            </div>
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
              Tax + shipping at checkout
            </p>
            <form action={createCheckoutSessionAction} className="mt-6">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-between px-6 py-4 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] hover:bg-[color:var(--color-ember-900)] transition-colors"
              >
                Checkout
                <span aria-hidden>→</span>
              </button>
            </form>
            <p className="mt-3 text-xs text-[color:var(--color-ink-600)]">
              Apple Pay and Google Pay surface on the Stripe page.
            </p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
