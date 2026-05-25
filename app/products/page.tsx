import Link from "next/link";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { seedProducts } from "@/lib/seed/products";

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function CatalogPage() {
  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-12 md:pt-20 pb-12">
        <div className="flex items-baseline justify-between mb-12 md:mb-16">
          <h1
            className="font-display text-4xl md:text-6xl leading-[1.05]"
            style={{
              fontVariationSettings: '"opsz" 96, "wght" 400',
              textWrap: "balance",
            }}
          >
            Catalog.
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
            {seedProducts.length.toString().padStart(2, "0")} pieces
          </span>
        </div>

        {/* Broken-grid product list — alternating column spans for editorial rhythm. */}
        <ul className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-14 md:gap-y-20">
          {seedProducts.map((product, idx) => {
            // 3-2-3-1-3 rhythm.
            const spans = ["md:col-span-5", "md:col-span-4 md:col-start-8", "md:col-span-6", "md:col-span-4 md:col-start-9"];
            const span = spans[idx % spans.length];
            return (
              <li key={product.slug} className={span}>
                <Link
                  href={`/products/${product.slug}` as `/products/${string}`}
                  className="group block"
                  style={{ viewTransitionName: `product-${product.slug}` }}
                >
                  <div
                    className="surface-noise hairline aspect-[4/5] mb-5 transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-craft)] group-hover:-translate-y-1"
                    style={{
                      background: `color-mix(in oklch, var(--color-mat-${product.material}) 22%, var(--color-paper-100))`,
                    }}
                  />
                  <div className="flex items-baseline justify-between gap-4">
                    <h2
                      className="font-display text-2xl md:text-3xl"
                      style={{
                        fontVariationSettings: '"opsz" 32, "wght" 440',
                      }}
                    >
                      {product.name}
                    </h2>
                    <span className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] nums-tabular">
                      {formatPrice(product.basePriceCents)}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] nums-tabular">
                    {product.dimensionsMm} · {product.decoration}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
