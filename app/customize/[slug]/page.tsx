import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db/client";
import { products } from "@/drizzle/schema";
import { getProductBySlug } from "@/lib/queries/catalog";
import { findOpenDraft } from "@/lib/queries/drafts";
import { getSession } from "@/lib/auth";
import { Customizer } from "@/components/customizer/Customizer";
import { designStateSchema, type DesignState } from "@/lib/parse";

export async function generateStaticParams() {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.status, "active"));
  return rows.map((r) => ({ slug: r.slug }));
}

export const dynamic = "force-dynamic";

export default async function CustomizePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const variant = product.variants[0];
  if (!variant) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-10">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[color:var(--color-ink-600)]">
          No variants configured for {product.name}.
        </p>
      </div>
    );
  }

  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;
  const draft = await findOpenDraft(customerId, variant.id);

  let initialDesignState: DesignState | null = null;
  if (draft) {
    const parsed = designStateSchema.safeParse(draft.designState);
    if (parsed.success) initialDesignState = parsed.data;
  }

  return (
    <Customizer
      productName={product.name}
      productSlug={product.slug}
      productVariantId={variant.id}
      initialDesignState={initialDesignState}
    />
  );
}
