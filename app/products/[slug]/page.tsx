import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { getProductBySlug, seedProducts } from "@/lib/seed/products";

export function generateStaticParams() {
  return seedProducts.map((p) => ({ slug: p.slug }));
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-8 md:pt-12 pb-16">
        <Link
          href="/products"
          className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← Catalog
        </Link>

        <article className="mt-10 md:mt-16 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
          {/* Hero photo (placeholder) ----------------------------------------------- */}
          <div
            className="surface-noise hairline md:col-span-7 aspect-[4/5]"
            style={{
              background: `color-mix(in oklch, var(--color-mat-${product.material}) 22%, var(--color-paper-100))`,
              viewTransitionName: `product-${product.slug}`,
            }}
          />

          {/* Copy ------------------------------------------------------------------- */}
          <div className="md:col-span-5 md:pt-4">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
              {product.decoration} · {product.dimensionsMm}
            </p>
            <h1
              className="mt-3 font-display text-5xl md:text-6xl leading-[1.05] -mx-1"
              style={{
                fontVariationSettings: '"opsz" 96, "wght" 380',
                textWrap: "balance",
              }}
            >
              {product.name}.
            </h1>
            <p
              className="mt-8 text-[color:var(--color-ink-800)]"
              style={{ fontSize: "var(--text-md)", textWrap: "pretty" }}
            >
              {product.shortDescription}
            </p>

            <div className="mt-10 flex items-baseline justify-between hairline hairline-b pb-4">
              <span
                className="font-display text-3xl nums-tabular"
                style={{ fontVariationSettings: '"opsz" 36, "wght" 440' }}
              >
                {formatPrice(product.basePriceCents)}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] nums-tabular">
                Ships in {product.leadDays} days
              </span>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <Link
                href={`/customize/${product.slug}` as `/customize/${string}`}
                className="group inline-flex items-center justify-between px-6 py-4 bg-[color:var(--color-ink-950)] text-[color:var(--color-paper-50)] font-mono text-xs uppercase tracking-[0.22em] transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-thumb)] active:translate-y-px"
              >
                Customize
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
              <button
                type="button"
                disabled
                className="inline-flex items-center justify-between px-6 py-4 hairline font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] disabled:cursor-not-allowed"
                title="Buy-as-shown is wired in Phase 2"
              >
                Buy as shown
                <span aria-hidden>—</span>
              </button>
            </div>

            <details className="mt-10 group">
              <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors">
                Fabrication
              </summary>
              <p
                className="mt-4 text-[color:var(--color-ink-800)] nums-tabular"
                style={{ fontSize: "var(--text-sm)", textWrap: "pretty" }}
              >
                {product.fabrication}
              </p>
            </details>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
