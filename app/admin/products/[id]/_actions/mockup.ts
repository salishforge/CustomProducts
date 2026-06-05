"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { mockupTemplates } from "@/drizzle/schema";
import {
  createMockupTemplateSchema,
  deleteMockupTemplateSchema,
  updateMockupTemplateSchema,
} from "@/lib/parse/admin";
import { AdminValidationError } from "@/lib/admin/errors";

/** Parse a JSON-textarea field, surfacing a parse failure as a field error. */
function parseJsonField(formData: FormData, field: string): unknown {
  const raw = formData.get(field);
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new AdminValidationError({ [field]: ["Required"] });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new AdminValidationError({ [field]: ["Not valid JSON"] });
  }
}

function requiredString(formData: FormData, field: string): string {
  const v = formData.get(field);
  if (typeof v !== "string" || !v) {
    throw new AdminValidationError({ [field]: ["Missing"] });
  }
  return v;
}

/** A blank <select>/<input> submits "" — treat that as "no value" (null). */
function optionalString(formData: FormData, field: string): string | null {
  const v = formData.get(field);
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

export async function createMockupTemplateAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const productId = requiredString(formData, "productId");

  const parsed = createMockupTemplateSchema.safeParse({
    variantId: optionalString(formData, "variantId"),
    baseImageId: optionalString(formData, "baseImageId"),
    overlayConfig: parseJsonField(formData, "overlayConfig"),
    format: formData.get("format"),
    r3fModelUrl: optionalString(formData, "r3fModelUrl"),
  });
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  await db.insert(mockupTemplates).values({
    id: newId(),
    variantId: parsed.data.variantId ?? null,
    baseImageId: parsed.data.baseImageId ?? null,
    overlayConfig: parsed.data.overlayConfig,
    format: parsed.data.format,
    r3fModelUrl: parsed.data.r3fModelUrl ?? null,
  });

  revalidateTag("products");
  revalidatePath(`/admin/products/${productId}/mockup`);
  redirect(`/admin/products/${productId}/mockup`);
}

export async function updateMockupTemplateAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const productId = requiredString(formData, "productId");

  const parsed = updateMockupTemplateSchema.safeParse({
    id: formData.get("id"),
    variantId: optionalString(formData, "variantId"),
    baseImageId: optionalString(formData, "baseImageId"),
    overlayConfig: parseJsonField(formData, "overlayConfig"),
    format: formData.get("format"),
    r3fModelUrl: optionalString(formData, "r3fModelUrl"),
  });
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  const { id, ...updates } = parsed.data;
  await db
    .update(mockupTemplates)
    .set({
      variantId: updates.variantId ?? null,
      baseImageId: updates.baseImageId ?? null,
      overlayConfig: updates.overlayConfig,
      format: updates.format,
      r3fModelUrl: updates.r3fModelUrl ?? null,
    })
    .where(eq(mockupTemplates.id, id));

  revalidateTag("products");
  revalidatePath(`/admin/products/${productId}/mockup`);
  redirect(`/admin/products/${productId}/mockup`);
}

export async function deleteMockupTemplateAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const productId = requiredString(formData, "productId");

  const parsed = deleteMockupTemplateSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  await db.delete(mockupTemplates).where(eq(mockupTemplates.id, parsed.data.id));

  revalidateTag("products");
  revalidatePath(`/admin/products/${productId}/mockup`);
  redirect(`/admin/products/${productId}/mockup`);
}
