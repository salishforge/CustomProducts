import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { products } from "@/drizzle/schema";
import { getProductBySlug } from "@/lib/queries/catalog";
import { materialFromCategory } from "@/lib/display/product";

export async function generateStaticParams() {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.status, "active"));
  return rows.map((r) => ({ slug: r.slug }));
}

/*
 * Customizer placeholder.
 *
 * The real Konva stage + layer model + AI panel lands in Phase 2b. This page
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
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const material = materialFromCategory(product.category);

  return (
    <div
      className="min-h-dvh relative"
      style={{
        background: `color-mix(in oklch, var(--color-mat-${material}) 8%, var(--color-paper-50))`,
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
            The customizer arrives in Phase 2b.
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
