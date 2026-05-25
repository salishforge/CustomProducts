import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductBySlug, seedProducts } from "@/lib/seed/products";

export function generateStaticParams() {
  return seedProducts.map((p) => ({ slug: p.slug }));
}

/*
 * Customizer placeholder.
 *
 * The real Konva stage + layer model + AI panel lands in Phase 2. This page
 * exists so the navigation flow from PDP works end-to-end and so the
 * customizer's chrome (full-bleed, single floating back-button, no global
 * nav) is established as a discrete surface from the rest of the site.
 */

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  return (
    <div
      className="min-h-dvh relative"
      style={{
        background: `color-mix(in oklch, var(--color-mat-${product.material}) 8%, var(--color-paper-50))`,
      }}
    >
      <header className="absolute top-6 left-6 md:top-8 md:left-10 z-20">
        <Link
          href={`/products/${product.slug}` as `/products/${string}`}
          className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← {product.name}
        </Link>
      </header>

      <main className="flex min-h-dvh items-center justify-center px-6 py-24 md:py-32">
        <div className="text-center max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] nums-tabular">
            Coming next
          </p>
          <h1
            className="mt-4 font-display text-4xl md:text-5xl leading-[1.05]"
            style={{
              fontVariationSettings: '"opsz" 56, "wght" 400',
              textWrap: "balance",
            }}
          >
            The customizer arrives in Phase 2.
          </h1>
          <p
            className="mt-6 text-[color:var(--color-ink-800)]"
            style={{ fontSize: "var(--text-md)", textWrap: "pretty" }}
          >
            Konva stage with text + image + AI layers, decoration-zone
            magnetism, real-time mock-up preview, and the in-context AI panel
            that treats generation as a layer type.
          </p>
        </div>
      </main>
    </div>
  );
}
