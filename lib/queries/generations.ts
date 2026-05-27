/*
 * Read-side helpers for AI generations.
 *
 * Customizer polls getGenerationStatus while a generation is in flight; on
 * 'succeeded' the consumer fetches the asset URL and inserts an image layer.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { aiGenerations, uploadedAssets } from "@/drizzle/schema";

export type GenerationStatusResult =
  | { status: "queued" | "running" }
  | { status: "succeeded"; assetUrl: string; assetId: string }
  | { status: "failed" | "cancelled"; error: string | null };

export async function getGenerationStatus(
  generationId: string,
): Promise<GenerationStatusResult | null> {
  const [row] = await db
    .select()
    .from(aiGenerations)
    .where(eq(aiGenerations.id, generationId))
    .limit(1);
  if (!row) return null;

  if (row.status === "queued" || row.status === "running") {
    return { status: row.status };
  }
  if (row.status === "succeeded") {
    if (!row.outputAssetId) {
      return { status: "running" };
    }
    const [asset] = await db
      .select()
      .from(uploadedAssets)
      .where(eq(uploadedAssets.id, row.outputAssetId))
      .limit(1);
    if (!asset) return { status: "running" };
    return {
      status: "succeeded",
      assetUrl: asset.r2Key,
      assetId: asset.id,
    };
  }
  return {
    status: row.status === "cancelled" ? "cancelled" : "failed",
    error: row.errorMessage,
  };
}
