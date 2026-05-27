"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { featuredProducts } from "@/drizzle/schema";
import { newId } from "@/lib/db/id";
import {
  deleteFeaturedSchema,
  upsertFeaturedProductSchema,
} from "@/lib/parse/admin";
import { AdminValidationError } from "@/lib/admin/errors";

export async function addFeaturedAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const raw = {
    productId: formData.get("productId"),
    slot: formData.get("slot"),
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    startsAt: formData.get("startsAt") || null,
    endsAt: formData.get("endsAt") || null,
  };
  const parsed = upsertFeaturedProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  await db.insert(featuredProducts).values({
    id: newId(),
    productId: parsed.data.productId,
    slot: parsed.data.slot,
    sortOrder: parsed.data.sortOrder,
    startsAt: parsed.data.startsAt ?? null,
    endsAt: parsed.data.endsAt ?? null,
  });

  revalidateTag("featured");
  revalidatePath("/admin/featured");
}

export async function removeFeaturedAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = deleteFeaturedSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }
  await db.delete(featuredProducts).where(eq(featuredProducts.id, parsed.data.id));
  revalidateTag("featured");
  revalidatePath("/admin/featured");
}
