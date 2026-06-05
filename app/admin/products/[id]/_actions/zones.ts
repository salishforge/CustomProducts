"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { decorationZones } from "@/drizzle/schema";
import {
  createDecorationZoneSchema,
  deleteDecorationZoneSchema,
  updateDecorationZoneSchema,
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

export async function createZoneAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const productId = requiredString(formData, "productId");

  const parsed = createDecorationZoneSchema.safeParse({
    productVariantId: formData.get("productVariantId"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    geometry: parseJsonField(formData, "geometry"),
    printSpec: parseJsonField(formData, "printSpec"),
    ordering: Number(formData.get("ordering") ?? 0),
  });
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  await db.insert(decorationZones).values({
    id: newId(),
    productVariantId: parsed.data.productVariantId,
    name: parsed.data.name,
    kind: parsed.data.kind,
    geometry: parsed.data.geometry,
    printSpec: parsed.data.printSpec,
    ordering: parsed.data.ordering,
  });

  revalidateTag("products");
  revalidatePath(`/admin/products/${productId}/zones`);
  redirect(`/admin/products/${productId}/zones`);
}

export async function updateZoneAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const productId = requiredString(formData, "productId");

  const parsed = updateDecorationZoneSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    geometry: parseJsonField(formData, "geometry"),
    printSpec: parseJsonField(formData, "printSpec"),
    ordering: Number(formData.get("ordering") ?? 0),
  });
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  const { id, ...updates } = parsed.data;
  await db.update(decorationZones).set(updates).where(eq(decorationZones.id, id));

  revalidateTag("products");
  revalidatePath(`/admin/products/${productId}/zones`);
  redirect(`/admin/products/${productId}/zones`);
}

export async function deleteZoneAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const productId = requiredString(formData, "productId");

  const parsed = deleteDecorationZoneSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  await db.delete(decorationZones).where(eq(decorationZones.id, parsed.data.id));

  revalidateTag("products");
  revalidatePath(`/admin/products/${productId}/zones`);
  redirect(`/admin/products/${productId}/zones`);
}
