"use server";

import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { designDrafts, uploadedAssets } from "@/drizzle/schema";
import { getSession } from "@/lib/auth";
import { designStateSchema, type DesignState } from "@/lib/parse";
import {
  createGeneration,
  type CreateGenerationResult,
} from "@/lib/replicate/generation-pipeline";
import { getGenerationStatus } from "@/lib/queries/generations";
import { ALLOWED_UPLOAD_MIME, storeUpload } from "@/lib/uploads/storage";

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

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type UploadImageResult =
  | {
      ok: true;
      assetId: string;
      url: string;
      width: number | null;
      height: number | null;
    }
  | { ok: false; reason: string };

/**
 * Direct image upload from the customizer. The bytes are validated with sharp
 * (a real decode, not a trusted mime string), written to fixture storage, and
 * recorded in uploaded_assets. The returned url is what the client sets as the
 * image layer's source; it is also what the print resolver fetches later.
 */
export async function uploadCustomizerImageAction(
  formData: FormData,
): Promise<UploadImageResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, reason: "No file provided" };
  }
  if (!ALLOWED_UPLOAD_MIME.has(file.type)) {
    return { ok: false, reason: "Use a PNG, JPEG, WebP, or AVIF image" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: "Image exceeds 15 MB" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    return { ok: false, reason: "Could not read that image" };
  }

  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;

  const assetId = newId();
  await storeUpload(assetId, file.type, bytes);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await db.insert(uploadedAssets).values({
    id: assetId,
    customerId,
    kind: "upload",
    r2Key: `${appUrl}/api/assets/${assetId}`,
    mimeType: file.type,
    widthPx: width,
    heightPx: height,
    byteSize: bytes.byteLength,
    originalFilename: file.name.slice(0, 255),
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    // No upload-moderation pipeline in MVP; uploads are usable immediately.
    moderationStatus: "approved",
  });

  return { ok: true, assetId, url: `/api/assets/${assetId}`, width, height };
}
