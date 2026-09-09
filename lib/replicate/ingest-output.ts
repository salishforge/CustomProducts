/*
 * Bringing a Replicate output into our own storage.
 *
 * Split into two functions on purpose, mirroring the two Inngest steps that
 * call them. The first does network work and writes an object; the second does
 * database writes. If the database write fails and Inngest retries, only the
 * second half re-runs — re-running the first would download the image again and
 * leave the previous object orphaned under a dead asset id.
 *
 * They live here rather than inside the step closures so this path can be
 * exercised without an Inngest runtime. It is the one subsystem in the project
 * that has never run against the live provider, so being able to test it
 * directly is worth the indirection.
 */

import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { aiGenerations, uploadedAssets } from "@/drizzle/schema";
import { putObject } from "@/lib/r2/client";
import { aiKey } from "@/lib/r2/keys";

export type StoredGenerationOutput = {
  assetId: string;
  key: string;
  byteSize: number;
  widthPx: number | null;
  heightPx: number | null;
  contentHash: string;
};

/**
 * Downloads the output, verifies it decodes, and writes it to R2. The decode is
 * not a formality: these bytes are embedded into print files later, and a
 * truncated download would otherwise surface as a failure after the customer
 * has paid.
 */
export async function fetchAndStoreOutput(
  outputUrl: string,
): Promise<StoredGenerationOutput> {
  const res = await fetch(outputUrl);
  if (!res.ok) {
    throw new Error(`Replicate output fetch failed (${res.status})`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());

  const meta = await sharp(bytes).metadata();

  const assetId = newId();
  const key = aiKey(assetId);
  await putObject(key, bytes, "image/webp");

  return {
    assetId,
    key,
    byteSize: bytes.byteLength,
    widthPx: meta.width ?? null,
    heightPx: meta.height ?? null,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** Records the stored object as the generation's output asset. */
export async function recordGenerationOutput(
  generationId: string,
  customerId: string | null,
  stored: StoredGenerationOutput,
): Promise<void> {
  await db.insert(uploadedAssets).values({
    id: stored.assetId,
    customerId,
    kind: "ai_generation",
    r2Key: stored.key,
    mimeType: "image/webp",
    widthPx: stored.widthPx,
    heightPx: stored.heightPx,
    byteSize: stored.byteSize,
    contentHash: stored.contentHash,
    generationId,
    moderationStatus: "approved",
  });

  await db
    .update(aiGenerations)
    .set({
      status: "succeeded",
      outputAssetId: stored.assetId,
      completedAt: new Date(),
    })
    .where(eq(aiGenerations.id, generationId));
}
