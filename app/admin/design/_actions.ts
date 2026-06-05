"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { siteSettings, themeRevisions } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth";
import {
  validateRevision,
  type ThemeRevisionTokens,
} from "@/lib/design/brand-rules";
import { AdminValidationError } from "@/lib/admin/errors";

export async function proposeAndApplyRevisionAction(
  formData: FormData,
): Promise<void> {
  const session = await requireAdmin();

  const tokens: ThemeRevisionTokens = {
    palette_id: String(formData.get("palette_id") ?? ""),
    font_pairing_id: String(formData.get("font_pairing_id") ?? ""),
    spacing_scale_id: String(formData.get("spacing_scale_id") ?? ""),
  };

  const validation = validateRevision(tokens);
  if (!validation.ok) {
    throw new AdminValidationError({
      brand_rules: validation.violations.map((v) => `${v.rule}: ${v.message}`),
    });
  }

  // Insert new revision (applied immediately for the operator-form path;
  // the LLM-chat path will land as a 'proposed' revision the operator
  // confirms separately).
  const id = newId();
  const now = new Date();
  await db.insert(themeRevisions).values({
    id,
    parentId: null,
    tokens: tokens as unknown as Record<string, unknown>,
    proposedByEmail: session.user.email ?? "admin",
    status: "applied",
    appliedAt: now,
  });

  // Atomic pointer swap.
  await db
    .insert(siteSettings)
    .values({
      key: "active_theme_revision_id",
      value: id,
      scope: "theme",
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: id, updatedAt: new Date() },
    });

  revalidateTag("theme");
  revalidateTag("settings");
  revalidatePath("/admin/design");
  // Also revalidate the customer entry points so the new theme is visible
  // on next request without a manual refresh.
  revalidatePath("/");
}

export async function rollbackToRevisionAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();
  const revisionId = formData.get("revisionId");
  if (typeof revisionId !== "string" || !revisionId) {
    throw new AdminValidationError({ revisionId: ["Missing"] });
  }
  const [revision] = await db
    .select()
    .from(themeRevisions)
    .where(eq(themeRevisions.id, revisionId))
    .limit(1);
  if (!revision) {
    throw new AdminValidationError({ revisionId: ["Not found"] });
  }
  await db
    .insert(siteSettings)
    .values({
      key: "active_theme_revision_id",
      value: revisionId,
      scope: "theme",
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: revisionId, updatedAt: new Date() },
    });
  await db
    .update(themeRevisions)
    .set({ status: "applied", appliedAt: new Date() })
    .where(eq(themeRevisions.id, revisionId));

  revalidateTag("theme");
  revalidateTag("settings");
  revalidatePath("/admin/design");
  revalidatePath("/");
}

export async function listRevisions(limit = 25) {
  await requireAdmin();
  return db
    .select()
    .from(themeRevisions)
    .orderBy(desc(themeRevisions.createdAt))
    .limit(limit);
}
