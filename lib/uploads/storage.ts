/*
 * Customizer upload storage (fixture mode).
 *
 * Mirrors lib/print/storage.ts: in dev we write uploaded image bytes to
 * ./upload-fixtures/{assetId}.{ext} and serve them back through
 * /api/assets/[id]. When the R2 pipeline lands (creds in env) the write
 * target swaps to r2://uploads/ and the serving route returns a signed URL —
 * the uploaded_assets.r2_key column already carries the public locator either
 * way, so callers (the customizer, the print resolver) don't change shape.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = "upload-fixtures";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Raster image types the direct-upload path accepts. Vector/SVG go through
 *  the R2 presign path (lib/parse presignUploadRequestSchema), not here. */
export const ALLOWED_UPLOAD_MIME = new Set(Object.keys(EXT_BY_MIME));

export function uploadExt(mimeType: string): string {
  return EXT_BY_MIME[mimeType] ?? "bin";
}

export function uploadFixturePath(assetId: string, mimeType: string): string {
  return path.join(
    process.cwd(),
    UPLOAD_DIR,
    `${assetId}.${uploadExt(mimeType)}`,
  );
}

export async function storeUpload(
  assetId: string,
  mimeType: string,
  bytes: Uint8Array,
): Promise<void> {
  await mkdir(path.join(process.cwd(), UPLOAD_DIR), { recursive: true });
  await writeFile(uploadFixturePath(assetId, mimeType), bytes);
}
