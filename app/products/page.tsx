import { MorphLink } from "@/components/brand/view-transitions";

import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { getActiveProducts } from "@/lib/queries/catalog";
import {
  displayDecoration,
  formatDimensionsMm,
  formatPriceCents,
  materialFromCategory,
} from "@/lib/display/product";
import { imageUrl } from "@/lib/cloudflare-images/client";

export default async function CatalogPage() {
  const products = await getActiveProducts();

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
            {products.length.toString().padStart(2, "0")} pieces
          </span>
        </div>

        {products.length === 0 ? (
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
            The shop is quiet. Nothing on the bench yet.
          </p>
        ) : (
          /* Broken-grid product list — alternating column spans for editorial rhythm. */
          <ul className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-14 md:gap-y-20">
            {products.map((product, idx) => {
              const spans = [
                "md:col-span-5",
                "md:col-span-4 md:col-start-8",
                "md:col-span-6",
                "md:col-span-4 md:col-start-9",
              ];
              const span = spans[idx % spans.length];
              const material = materialFromCategory(product.category);
              const dimensions = formatDimensionsMm(
                product.variants[0]?.dimensionsMm,
              );
              const heroSrc = product.heroImage
                ? imageUrl(product.heroImage.cloudflareImageId, "public")
                : null;
              return (
                <li key={product.slug} className={span}>
                  <MorphLink
                    href={`/products/${product.slug}` as `/products/${string}`}
                    className="group block"
                  >
                    <div
                      className="surface-noise hairline aspect-[4/5] mb-5 overflow-hidden transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-craft)] group-hover:-translate-y-1"
                      style={{
                        background: heroSrc
                          ? undefined
                          : `color-mix(in oklch, var(--color-mat-${material}) 22%, var(--color-paper-100))`,
                        viewTransitionName: `product-${product.slug}`,
                      }}
                    >
                      {heroSrc ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={heroSrc}
                          alt={product.heroImage?.altText ?? product.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
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
                        {formatPriceCents(product.basePriceCents, product.currency)}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] nums-tabular">
                      {dimensions ? `${dimensions} · ` : ""}
                      {displayDecoration(product.decorationMethod)}
                    </p>
                  </MorphLink>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
