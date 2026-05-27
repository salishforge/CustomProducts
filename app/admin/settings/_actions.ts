"use server";

import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { siteSettings } from "@/drizzle/schema";
import { upsertSiteSettingSchema } from "@/lib/parse/admin";
import { AdminValidationError } from "@/lib/admin/errors";

export async function upsertSettingAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const rawValue = formData.get("value");
  // Allow the operator to enter JSON literally, e.g. `true`, `42`, `"hello"`,
  // `{"foo": 1}`. If parse fails, treat as a plain string.
  let parsedValue: unknown = rawValue;
  if (typeof rawValue === "string" && rawValue.trim().length > 0) {
    try {
      parsedValue = JSON.parse(rawValue);
    } catch {
      parsedValue = rawValue;
    }
  }

  const raw = {
    key: formData.get("key"),
    value: parsedValue,
    scope: formData.get("scope") ?? "misc",
  };
  const parsed = upsertSiteSettingSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AdminValidationError(parsed.error.flatten().fieldErrors);
  }

  // z.unknown() is optional-by-default in Zod; narrow explicitly so the
  // jsonb NOT NULL column is satisfied.
  if (parsed.data.value === undefined) {
    throw new AdminValidationError({ value: ["Value is required"] });
  }
  const value: unknown = parsed.data.value;

  await db
    .insert(siteSettings)
    .values({
      key: parsed.data.key,
      scope: parsed.data.scope,
      value,
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value,
        scope: parsed.data.scope,
        updatedAt: new Date(),
      },
    });

  revalidateTag("settings");
  revalidatePath("/admin/settings");
}

export async function deleteSettingAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = formData.get("key");
  if (typeof key !== "string" || !key) {
    throw new AdminValidationError({ key: ["Missing setting key"] });
  }
  await db.delete(siteSettings).where(eq(siteSettings.key, key));
  revalidateTag("settings");
  revalidatePath("/admin/settings");
}
