"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { productVariants } from "@/drizzle/schema";
import {
  createVariantSchema,
  deleteVariantSchema,
  updateVariantSchema,
} from "@/lib/parse/admin";
import { AdminValidationError } from "@/lib/admin/errors";

function parseDimensions(formData: FormData):
  | { w?: number; h?: number; d?: number; label?: string }
  | null {
  const w = formData.get("dimW");
  const h = formData.get("dimH");
  const d = formData.get("dimD");
  const label = formData.get("dimLabel");
  const dim: { w?: number; h?: number; d?: number; label?: string } = {};
  if (w !== null && w !== "") dim.w = Number(w);
  if (h !== null && h !== "") dim.h = Number(h);
  if (d !== null && d !== "") dim.d = Number(d);
  if (typeof label === "string" && label.length > 0) dim.label = label;
  return Object.keys(dim).length === 0 ? null : dim;
}

function readNullableInt(formData: FormData, field: string): number | null {
  const v = formData.get(field);
  if (v === null || v === "") return null;
  return Number(v);
}

export async function createVariantAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const productId = formData.get("productId");
  if (typeof productId !== "string" || !productId) {
    throw new AdminValidationError({ productId: ["Missing product id"] });
  }

  const raw = {
    productId,
    sku: formData.get("sku"),
    name: formData.get("name"),
    attributes: {},
    priceDeltaCents: Number(formData.get("priceDeltaCents") ?? 0),
    inventoryCount: readNullableInt(formData, "inventoryCount"),
    weightGrams: readNullableInt(formData, "weightGrams"),
    dimensionsMm: parseDimensions(formData),
  };

  const parsed = createVariantSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  await db.insert(productVariants).values({
    id: newId(),
    productId: parsed.data.productId,
    sku: parsed.data.sku,
    name: parsed.data.name,
    attributes: parsed.data.attributes,
    priceDeltaCents: parsed.data.priceDeltaCents,
    inventoryCount: parsed.data.inventoryCount ?? null,
    weightGrams: parsed.data.weightGrams ?? null,
    dimensionsMm: parsed.data.dimensionsMm ?? null,
  });

  revalidateTag("products");
  revalidatePath(`/admin/products/${parsed.data.productId}`);
  redirect(`/admin/products/${parsed.data.productId}`);
}

export async function updateVariantAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = formData.get("id");
  const productId = formData.get("productId");
  if (typeof id !== "string" || !id) {
    throw new AdminValidationError({ id: ["Missing variant id"] });
  }

  const raw: Record<string, unknown> = { id };
  for (const f of ["sku", "name"] as const) {
    const v = formData.get(f);
    if (v !== null) raw[f] = v;
  }
  for (const f of ["priceDeltaCents", "inventoryCount", "weightGrams"] as const) {
    const v = formData.get(f);
    if (v !== null && v !== "") raw[f] = Number(v);
  }
  const dim = parseDimensions(formData);
  if (dim) raw.dimensionsMm = dim;

  const parsed = updateVariantSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  const { id: vid, ...updates } = parsed.data;
  await db
    .update(productVariants)
    .set(updates)
    .where(eq(productVariants.id, vid));

  revalidateTag("products");
  if (typeof productId === "string") {
    revalidatePath(`/admin/products/${productId}`);
  }
}

export async function deleteVariantAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = deleteVariantSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }
  const productId = formData.get("productId");

  await db.delete(productVariants).where(eq(productVariants.id, parsed.data.id));

  revalidateTag("products");
  if (typeof productId === "string") {
    revalidatePath(`/admin/products/${productId}`);
  }
}
