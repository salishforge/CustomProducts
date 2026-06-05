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
import { SECTION_IDS } from "@/lib/design/layouts";
import { AdminValidationError } from "@/lib/admin/errors";

/**
 * Make `revisionId` the active theme: swap the site_settings pointer, mark the
 * revision applied, and revalidate the theme/settings caches plus the customer
 * entry point. The single chokepoint for "this revision is now live" — shared
 * by the manual form, the LLM-proposal apply, and rollback.
 */
async function setActiveRevision(revisionId: string): Promise<void> {
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

export async function proposeAndApplyRevisionAction(
  formData: FormData,
): Promise<void> {
  const session = await requireAdmin();

  const layoutAssignments: Record<string, string> = {};
  for (const section of SECTION_IDS) {
    const value = formData.get(`layout:${section}`);
    if (typeof value === "string" && value) layoutAssignments[section] = value;
  }

  const tokens: ThemeRevisionTokens = {
    palette_id: String(formData.get("palette_id") ?? ""),
    font_pairing_id: String(formData.get("font_pairing_id") ?? ""),
    spacing_scale_id: String(formData.get("spacing_scale_id") ?? ""),
    layout_assignments: layoutAssignments,
  };

  const validation = validateRevision(tokens);
  if (!validation.ok) {
    throw new AdminValidationError({
      brand_rules: validation.violations.map((v) => `${v.rule}: ${v.message}`),
    });
  }

  const id = newId();
  await db.insert(themeRevisions).values({
    id,
    parentId: null,
    tokens: tokens as unknown as Record<string, unknown>,
    proposedByEmail: session.user.email ?? "admin",
    status: "draft",
  });

  await setActiveRevision(id);
}

/** Apply a revision the LLM already drafted (inserted by propose_revision). */
export async function applyProposedRevisionAction(
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
  await setActiveRevision(revisionId);
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
  await setActiveRevision(revisionId);
}

export async function listRevisions(limit = 25) {
  await requireAdmin();
  return db
    .select()
    .from(themeRevisions)
    .orderBy(desc(themeRevisions.createdAt))
    .limit(limit);
}
