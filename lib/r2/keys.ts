/*
 * R2 object keys.
 *
 * One bucket holds every asset the application stores, partitioned by four
 * prefixes rather than split across buckets. The reason is that public access
 * in R2 is a bucket-level property — attaching a public custom domain exposes
 * the whole bucket — and print files must never be publicly readable. Since
 * every read is therefore mediated by a presigned GET anyway, a second bucket
 * would buy nothing but another name to keep in sync. (ADR-001.)
 *
 * Keys are addressed by asset id, not by content hash. Content addressing
 * would let two uploaded_assets rows share one object, which the UNIQUE index
 * on uploaded_assets.r2_key forbids, and would then require reference counting
 * before any object referenced by a paid order could be deleted. Generation-
 * level dedupe already happens a layer up via the UNIQUE ai_generations.cache_key.
 * (ADR-002.)
 *
 * This module is the only place a prefix is spelled. Nothing else in the
 * codebase should build a key by string concatenation.
 */

/** Quarantine for browser-uploaded bytes that have not yet been decoded and
 *  hash-verified by the server. An R2 lifecycle rule expires this prefix after
 *  24h, which is the only garbage collection in the design — objects here are
 *  orphans whenever the upload was abandoned before /api/uploads/complete. */
export function incomingKey(assetId: string): string {
  return `incoming/${assetId}`;
}

export function uploadKey(assetId: string, ext: string): string {
  return `uploads/${assetId}.${ext}`;
}

/** Replicate returns webp for every model we call (lib/replicate/client.ts). */
export function aiKey(assetId: string): string {
  return `ai/${assetId}.webp`;
}

/** Filenames come from the print builders, not from user input. */
export function printKey(
  orderId: string,
  orderItemId: string,
  filename: string,
): string {
  return `print/${orderId}/${orderItemId}/${filename}`;
}
