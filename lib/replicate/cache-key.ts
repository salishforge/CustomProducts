/*
 * Cache-key derivation for Replicate generations.
 *
 * Same prompt + same references + same model + same params → same cache_key →
 * existing row returned, $0 cost. The UNIQUE index on ai_generations.cache_key
 * makes the lookup-or-insert atomic.
 */

import { createHash } from "node:crypto";

export type CacheKeyInput = {
  prompt: string;
  /** Asset ids (cuid2) of reference images. Order is normalized inside. */
  referenceAssetIds: readonly string[];
  model: string;
  /** Any model-specific knobs (aspect ratio, seed, steps, guidance). */
  params: Record<string, unknown>;
};

/** Lowercase, trim, collapse whitespace, strip trailing punctuation.
 *  Tight enough to dedupe formatting near-misses; loose enough not to collide
 *  semantically distinct prompts. */
export function normalizePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:]+$/g, "");
}

function canonicalizeParams(params: Record<string, unknown>): string {
  const sortedKeys = Object.keys(params).sort();
  const ordered: Record<string, unknown> = {};
  for (const k of sortedKeys) ordered[k] = params[k];
  return JSON.stringify(ordered);
}

export function deriveCacheKey(input: CacheKeyInput): string {
  const promptHash = createHash("sha256")
    .update(normalizePrompt(input.prompt))
    .digest("hex");
  const refs = [...input.referenceAssetIds].sort().join(",");
  const paramsCanonical = canonicalizeParams(input.params);
  return createHash("sha256")
    .update(`${promptHash}|${refs}|${input.model}|${paramsCanonical}`)
    .digest("hex");
}
