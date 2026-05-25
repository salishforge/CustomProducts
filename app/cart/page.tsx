import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";

export default function CartPage() {
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
