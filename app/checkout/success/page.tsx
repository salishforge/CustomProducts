import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";

/*
 * Stripe success redirect target. The order row is created out-of-band by
 * the Stripe webhook handler (checkout.session.completed) so by the time the
 * customer lands here the row may or may not exist yet. We show a confident
 * confirmation message regardless and link to the order history.
 */

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-12 md:pt-24 pb-20">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ember-700)]">
            Order confirmed
          </p>
          <h1
            className="mt-3 font-display text-5xl md:text-6xl leading-[1.05] -mx-1"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 380', textWrap: "balance" }}
          >
            On the bench.
          </h1>
          <p
            className="mt-8 text-[color:var(--color-ink-800)]"
            style={{ fontSize: "var(--text-md)", textWrap: "pretty" }}
          >
            Your order is in. You&rsquo;ll get an email confirmation within a
            minute. Once the piece ships you&rsquo;ll get tracking; production
            stages are visible in your account in the meantime.
          </p>
          {session_id ? (
            <p className="mt-4 font-mono text-[0.7rem] text-[color:var(--color-ink-600)] nums-tabular">
              Stripe session: {session_id}
            </p>
          ) : null}
          <div className="mt-10 flex gap-3">
            <Link
              href="/account"
              className="inline-flex items-center px-5 py-3 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] hover:bg-[color:var(--color-ember-900)] transition-colors"
            >
              View order
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center px-5 py-3 hairline font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-800)] hover:text-[color:var(--color-ink-950)] transition-colors"
            >
              Keep browsing
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
