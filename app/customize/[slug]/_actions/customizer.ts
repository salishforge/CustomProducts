"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { designDrafts } from "@/drizzle/schema";
import { getSession } from "@/lib/auth";
import { designStateSchema, type DesignState } from "@/lib/parse";
import {
  createGeneration,
  type CreateGenerationResult,
} from "@/lib/replicate/generation-pipeline";
import { getGenerationStatus } from "@/lib/queries/generations";

export type SaveDraftResult =
  | { ok: true; draftId: string }
  | { ok: false; reason: string };

export async function saveDesignDraftAction(input: {
  productVariantId: string;
  designState: DesignState;
  name?: string;
}): Promise<SaveDraftResult> {
  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;

  const parsed = designStateSchema.safeParse(input.designState);
  if (!parsed.success) {
    return { ok: false, reason: "Invalid design state" };
  }

  // Upsert pattern: if there's an open draft for this (customer, variant),
  // overwrite it; otherwise insert. Guests get a fresh row each save (their
  // draft id is what's threaded through localStorage on the client).
  if (customerId) {
    const existing = await db
      .select({ id: designDrafts.id })
      .from(designDrafts)
      .where(
        and(
          eq(designDrafts.customerId, customerId),
          eq(designDrafts.productVariantId, input.productVariantId),
          eq(designDrafts.status, "draft"),
        ),
      )
      .limit(1);

    const existingId = existing[0]?.id;
    if (existingId) {
      await db
        .update(designDrafts)
        .set({
          designState: parsed.data,
          name: input.name ?? null,
          updatedAt: new Date(),
        })
        .where(eq(designDrafts.id, existingId));
      return { ok: true, draftId: existingId };
    }
  }

  const id = newId();
  await db.insert(designDrafts).values({
    id,
    customerId,
    productVariantId: input.productVariantId,
    name: input.name ?? null,
    designState: parsed.data,
    status: "draft",
  });
  return { ok: true, draftId: id };
}

/**
 * Thin server-action wrapper around the existing Replicate pipeline so client
 * components can call it from "use client".
 */
export async function generateForCustomizerAction(input: {
  prompt: string;
  productVariantId: string;
  zoneId: string;
}): Promise<CreateGenerationResult> {
  return createGeneration({
    prompt: input.prompt,
    productVariantId: input.productVariantId,
    zoneId: input.zoneId,
    aspectRatio: "1:1",
    model: "flux-schnell",
    referenceAssetIds: [],
    referenceWeight: 60,
  });
}

export async function pollGenerationStatusAction(generationId: string) {
  return getGenerationStatus(generationId);
}

export async function publishDraftPreviewAction(_draftId: string): Promise<void> {
  // Hook for future SSE/preview-bus integration. No-op for MVP.
  revalidatePath("/cart");
}
