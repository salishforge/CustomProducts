import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products } from "@/drizzle/schema";
import { VariantForm } from "@/components/admin/VariantForm";

import { createVariantAction } from "../../_actions/variants";

export default async function NewVariantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
  const product = rows[0];
  if (!product) notFound();

  return (
    <div className="max-w-2xl">
      <header className="mb-8">
        <Link
          href={`/admin/products/${product.id}` as never}
          className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← {product.name}
        </Link>
        <h1
          className="mt-4 font-display text-4xl leading-[1.1]"
          style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
        >
          New variant.
        </h1>
      </header>
      <VariantForm productId={product.id} action={createVariantAction} submitLabel="Create variant" />
    </div>
  );
}
