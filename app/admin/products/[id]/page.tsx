import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, productVariants } from "@/drizzle/schema";
import {
  Field,
  NumberInput,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/admin/Field";

import {
  archiveProductAction,
  updateProductAction,
} from "../_actions/products";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "drinkware",
  "leather_patch",
  "dog_tag",
  "bookmark",
  "zippo",
  "coin",
  "tcg_accessory",
  "phone_case",
  "crystal_engraving",
];

const METHODS = ["laser", "uv_print", "crystal_engrave", "dye_sub"];

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  const product = rows[0];
  if (!product) notFound();

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id));

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <Link
          href="/admin/products"
          className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
        >
          ← Products
        </Link>
        <div className="mt-4 flex items-baseline justify-between gap-6">
          <h1
            className="font-display text-4xl leading-[1.1]"
            style={{ fontVariationSettings: '"opsz" 56, "wght" 420' }}
          >
            {product.name}
          </h1>
          <Link
            href={`/products/${product.slug}` as never}
            className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] hover:text-[color:var(--color-ink-950)] transition-colors"
            target="_blank"
          >
            View public ↗
          </Link>
        </div>
        <p className="mt-2 font-mono text-xs text-[color:var(--color-ink-600)]">
          {product.slug} · {product.category} · {product.status}
        </p>
      </header>

      <nav className="border-b border-[color:var(--color-paper-300)] mb-10">
        <ul className="flex gap-8 font-mono text-[0.7rem] uppercase tracking-[0.22em]">
          <li className="pb-3 border-b-2 border-[color:var(--color-ink-950)] -mb-px text-[color:var(--color-ink-950)]">
            Details
          </li>
          <li className="pb-3 text-[color:var(--color-ink-400)]">
            Variants ({variants.length})
            <span className="ml-2 text-[0.6rem] tracking-[0.18em]">soon</span>
          </li>
          <li className="pb-3 text-[color:var(--color-ink-400)]">
            Decoration zones <span className="ml-2 text-[0.6rem]">soon</span>
          </li>
          <li className="pb-3 text-[color:var(--color-ink-400)]">
            Mock-up <span className="ml-2 text-[0.6rem]">soon</span>
          </li>
          <li className="pb-3 text-[color:var(--color-ink-400)]">
            Images <span className="ml-2 text-[0.6rem]">soon</span>
          </li>
        </ul>
      </nav>

      <form action={updateProductAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={product.id} />

        <Field label="Name" htmlFor="name" required>
          <TextInput
            id="name"
            name="name"
            required
            defaultValue={product.name}
          />
        </Field>

        <Field label="Slug" htmlFor="slug" required>
          <TextInput
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={product.slug}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Category" htmlFor="category" required>
            <SelectInput
              id="category"
              name="category"
              required
              defaultValue={product.category}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Decoration method" htmlFor="decorationMethod" required>
            <SelectInput
              id="decorationMethod"
              name="decorationMethod"
              required
              defaultValue={product.decorationMethod}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Base price (cents)" htmlFor="basePriceCents" required>
            <NumberInput
              id="basePriceCents"
              name="basePriceCents"
              required
              min={0}
              step={100}
              defaultValue={product.basePriceCents}
            />
          </Field>
          <Field label="Lead time (days)" htmlFor="leadTimeDays" required>
            <NumberInput
              id="leadTimeDays"
              name="leadTimeDays"
              required
              min={1}
              max={120}
              defaultValue={product.leadTimeDays}
            />
          </Field>
        </div>

        <Field label="Status" htmlFor="status">
          <SelectInput id="status" name="status" defaultValue={product.status}>
            <option value="draft">Draft — not visible on site</option>
            <option value="active">Active — live on site</option>
            <option value="archived">Archived — hidden, kept for orders</option>
          </SelectInput>
        </Field>

        <Field label="Description (MDX)" htmlFor="descriptionMdx">
          <TextArea
            id="descriptionMdx"
            name="descriptionMdx"
            rows={8}
            defaultValue={product.descriptionMdx ?? ""}
          />
        </Field>

        <div className="flex items-center gap-3 pt-4">
          <PrimaryButton type="submit">Save changes</PrimaryButton>
        </div>
      </form>

      <form
        action={archiveProductAction}
        className="mt-16 pt-8 border-t border-[color:var(--color-paper-300)]"
      >
        <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-600)] mb-3">
          Danger zone
        </h2>
        <input type="hidden" name="id" value={product.id} />
        <input
          type="hidden"
          name="archive"
          value={product.status === "archived" ? "false" : "true"}
        />
        <p className="text-sm text-[color:var(--color-ink-800)] mb-4">
          {product.status === "archived"
            ? "This product is archived. Restoring sets status back to draft."
            : "Archiving hides this product from the public site. Orders that reference it are preserved via the order snapshot."}
        </p>
        <SecondaryButton type="submit">
          {product.status === "archived" ? "Restore to draft" : "Archive product"}
        </SecondaryButton>
      </form>
    </div>
  );
}
