"use server";

/*
 * Product CRUD Server Actions.
 *
 * Every mutation: Zod parse → DB write → revalidateTag('products') → redirect
 * or revalidatePath. Validation failures throw — caught by app/admin/error.tsx
 * with a coarse error UX. A polished UX with field-level errors lives in a
 * follow-up using `useActionState` + a thin client wrapper.
 *
 * If a write changes whether a category has any active products, also
 * revalidateTag('categories') so the home family tiles update.
 */

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { products } from "@/drizzle/schema";
import {
  archiveProductSchema,
  createProductSchema,
  updateProductSchema,
} from "@/lib/parse/admin";
import { AdminValidationError } from "@/lib/admin/errors";

function readForm(formData: FormData, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = formData.get(f);
    if (v !== null) out[f] = v;
  }
  return out;
}

export async function createProductAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const raw = {
    slug: formData.get("slug"),
    name: formData.get("name"),
    category: formData.get("category"),
    decorationMethod: formData.get("decorationMethod"),
    basePriceCents: Number(formData.get("basePriceCents")),
    leadTimeDays: Number(formData.get("leadTimeDays")),
    status: formData.get("status"),
    descriptionMdx: formData.get("descriptionMdx") || undefined,
  };

  const parsed = createProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  const id = newId();
  await db.insert(products).values({ id, ...parsed.data });

  revalidateTag("products");
  revalidateTag("categories");
  redirect(`/admin/products/${id}`);
}

export async function updateProductAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    throw new AdminValidationError({ id: ["Missing product id"] });
  }

  const raw: Record<string, unknown> = { id, ...readForm(formData, [
    "slug",
    "name",
    "category",
    "decorationMethod",
    "status",
    "descriptionMdx",
  ]) };
  for (const f of ["basePriceCents", "leadTimeDays"] as const) {
    const v = formData.get(f);
    if (v !== null && v !== "") raw[f] = Number(v);
  }

  const parsed = updateProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  const { id: pid, ...updates } = parsed.data;
  await db
    .update(products)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(products.id, pid));

  revalidateTag("products");
  revalidateTag("categories");
  revalidatePath(`/admin/products/${pid}`);
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const raw = {
    id: formData.get("id"),
    archive: formData.get("archive") === "true",
  };
  const parsed = archiveProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  await db
    .update(products)
    .set({
      status: parsed.data.archive ? "archived" : "draft",
      updatedAt: new Date(),
    })
    .where(eq(products.id, parsed.data.id));

  revalidateTag("products");
  revalidateTag("categories");
  revalidatePath(`/admin/products/${parsed.data.id}`);
}
