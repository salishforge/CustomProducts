import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { MorphLink } from "@/components/brand/view-transitions";
import { SiteFooter } from "@/components/brand/SiteFooter";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { db } from "@/lib/db/client";
import { products } from "@/drizzle/schema";
import { getProductBySlug } from "@/lib/queries/catalog";
import {
  displayDecoration,
  formatDimensionsMm,
  formatPriceCents,
  leadParagraph,
  materialFromCategory,
  tailParagraphs,
} from "@/lib/display/product";
import { imageUrl } from "@/lib/cloudflare-images/client";
import { addProductBuyAsShownAction } from "@/app/cart/_actions";

export async function generateStaticParams() {
  // Active products only — drafts/archived aren't routable for the public.
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.status, "active"));
  return rows.map((r) => ({ slug: r.slug }));
}

export default async function ProductDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const material = materialFromCategory(product.category);
  const dimensions = formatDimensionsMm(product.variants[0]?.dimensionsMm);
  const lede = leadParagraph(product.descriptionMdx);
  const fabrication = tailParagraphs(product.descriptionMdx);
  const heroSrc = product.heroImage
    ? imageUrl(product.heroImage.cloudflareImageId, "public")
    : null;

  return (
    <>
      <SiteHeader />
      <main className="px-6 md:px-14 pt-8 md:pt-12 pb-16">
        <MorphLink
          href="/products"
          className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← Catalog
        </MorphLink>

        <article className="mt-10 md:mt-16 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16">
          {/* Hero photo — Cloudflare Images when present, else material-tinted placeholder. */}
          <div
            className="surface-noise hairline md:col-span-7 aspect-[4/5] overflow-hidden"
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
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>

          <div className="md:col-span-5 md:pt-4">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
              {displayDecoration(product.decorationMethod)}
              {dimensions ? ` · ${dimensions}` : ""}
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
            {lede ? (
              <p
                className="mt-8 text-[color:var(--color-ink-800)]"
                style={{ fontSize: "var(--text-md)", textWrap: "pretty" }}
              >
                {lede}
              </p>
            ) : null}

            <div className="mt-10 flex items-baseline justify-between hairline hairline-b pb-4">
              <span
                className="font-display text-3xl nums-tabular"
                style={{ fontVariationSettings: '"opsz" 36, "wght" 440' }}
              >
                {formatPriceCents(product.basePriceCents, product.currency)}
              </span>
              <span className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-600)] nums-tabular">
                Ships in {product.leadTimeDays} days
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
              <form action={addProductBuyAsShownAction}>
                <input type="hidden" name="productId" value={product.id} />
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-between px-6 py-4 hairline font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-800)] hover:text-[color:var(--color-ink-950)] hover:border-[color:var(--color-ink-800)] transition-colors"
                >
                  Buy as shown
                  <span aria-hidden>→</span>
                </button>
              </form>
            </div>

            {fabrication ? (
              <details className="mt-10 group">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors">
                  Fabrication
                </summary>
                <p
                  className="mt-4 text-[color:var(--color-ink-800)] nums-tabular"
                  style={{ fontSize: "var(--text-sm)", textWrap: "pretty" }}
                >
                  {fabrication}
                </p>
              </details>
            ) : null}
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
