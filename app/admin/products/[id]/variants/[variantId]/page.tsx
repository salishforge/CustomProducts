import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, productVariants } from "@/drizzle/schema";
import { VariantForm } from "@/components/admin/VariantForm";
import { SecondaryButton } from "@/components/admin/Field";

import {
  deleteVariantAction,
  updateVariantAction,
} from "../../_actions/variants";

export default async function EditVariantPage({
  params,
}: {
  params: Promise<{ id: string; variantId: string }>;
}) {
  await requireAdmin();
  const { id, variantId } = await params;

  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) notFound();
  const [variant] = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, id)))
    .limit(1);
  if (!variant) notFound();

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
          {variant.name}
        </h1>
        <p className="mt-1 font-mono text-xs text-[color:var(--color-ink-600)]">
          {variant.sku}
        </p>
      </header>

      <VariantForm
        productId={product.id}
        variant={variant}
        action={updateVariantAction}
        submitLabel="Save changes"
      />

      <form
        action={deleteVariantAction}
        className="mt-16 pt-8 border-t border-[color:var(--color-paper-300)]"
      >
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-3">
          Danger zone
        </h2>
        <input type="hidden" name="id" value={variant.id} />
        <input type="hidden" name="productId" value={product.id} />
        <p className="text-sm text-[color:var(--color-ink-800)] mb-4">
          Deleting a variant is permanent. Existing orders that reference it
          retain their data through the order snapshot.
        </p>
        <SecondaryButton type="submit">Delete variant</SecondaryButton>
      </form>
    </div>
  );
}
