"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { productCategories } from "@/drizzle/schema";
import { upsertCategorySchema } from "@/lib/parse/admin";
import { AdminValidationError } from "@/lib/admin/errors";

export async function upsertCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const raw = {
    category: formData.get("category"),
    displayName: formData.get("displayName"),
    blurb: formData.get("blurb") || null,
    sortOrder: Number(formData.get("sortOrder") ?? 0),
    isActive: formData.get("isActive") === "true",
  };
  const parsed = upsertCategorySchema.safeParse(raw);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  await db
    .insert(productCategories)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: productCategories.category,
      set: {
        displayName: parsed.data.displayName,
        blurb: parsed.data.blurb,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
        updatedAt: new Date(),
      },
    });

  revalidateTag("categories");
  revalidatePath("/admin/categories");
}
