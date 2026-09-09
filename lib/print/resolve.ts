/*
 * Resolves a stored design_state into concrete layers ready for file
 * generation. The customizer's runtime model carries CSS variable references
 * for fontFamily and the asset URL out-of-band; for print output we need a
 * single self-contained object.
 *
 * Image bytes are fetched here so subsequent builders are pure functions of
 * the resolved shape.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { getObject } from "@/lib/r2/client";
import { uploadedAssets } from "@/drizzle/schema";
import type { DesignState, Layer } from "@/lib/parse";

export type ResolvedTextLayer = {
  kind: "text";
  id: string;
  content: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  transform: { x: number; y: number; width: number; height: number; rotation: number };
};

export type ResolvedImageLayer = {
  kind: "image";
  id: string;
  /** Source URL the asset was fetched from. Kept for auditability. */
  source: string;
  /** Raw bytes, ready to embed. */
  bytes: Uint8Array;
  mimeType: string;
  transform: { x: number; y: number; width: number; height: number; rotation: number };
};

export type ResolvedLayer = ResolvedTextLayer | ResolvedImageLayer;

const CSS_VAR_FONT_MAP: Record<string, string> = {
  "var(--font-fraunces)": "Fraunces",
  "var(--font-inter-tight)": "Inter Tight",
  "var(--font-jetbrains-mono)": "JetBrains Mono",
};

function resolveFontFamily(raw: string): string {
  return CSS_VAR_FONT_MAP[raw] ?? raw;
}

async function fetchAssetBytes(
  assetId: string,
): Promise<{ bytes: Uint8Array; mimeType: string; source: string } | null> {
  const [row] = await db
    .select()
    .from(uploadedAssets)
    .where(eq(uploadedAssets.id, assetId))
    .limit(1);
  if (!row) return null;

  // Every asset kind now lives in R2, so this reads the object directly rather
  // than going through /api/assets — no HTTP hop, and no app URL needed.
  const object = await getObject(row.r2Key);
  return { bytes: object.bytes, mimeType: object.contentType, source: row.r2Key };
}

export async function resolveDesignState(
  state: DesignState,
  zoneId = "main",
): Promise<ResolvedLayer[]> {
  const layers: Layer[] = state.zones?.[zoneId]?.layers ?? [];
  const out: ResolvedLayer[] = [];

  for (const l of layers) {
    if (l.kind === "text") {
      out.push({
        kind: "text",
        id: l.id,
        content: l.content,
        fontFamily: resolveFontFamily(l.fontFamily),
        fontWeight: l.fontWeight,
        fontSize: l.fontSize,
        color: l.color,
        transform: l.transform,
      });
    } else if (l.kind === "image") {
      const asset = await fetchAssetBytes(l.assetId);
      if (!asset) continue;
      out.push({
        kind: "image",
        id: l.id,
        source: asset.source,
        bytes: asset.bytes,
        mimeType: asset.mimeType,
        transform: l.transform,
      });
    } else if (l.kind === "ai") {
      const asset = await fetchAssetBytes(l.generationId);
      if (!asset) continue;
      out.push({
        kind: "image",
        id: l.id,
        source: asset.source,
        bytes: asset.bytes,
        mimeType: asset.mimeType,
        transform: l.transform,
      });
    }
  }
  return out;
}
