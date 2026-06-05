import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  deriveCacheKey,
  normalizePrompt,
  type CacheKeyInput,
} from "../lib/replicate/cache-key";

describe("normalizePrompt", () => {
  it("lowercases and trims", () => {
    assert.equal(normalizePrompt("  A Dragon  "), "a dragon");
  });

  it("collapses interior whitespace runs to a single space", () => {
    assert.equal(normalizePrompt("a\t  red\n\ndragon"), "a red dragon");
  });

  it("strips trailing punctuation so formatting near-misses dedupe", () => {
    assert.equal(normalizePrompt("a red dragon!!!"), "a red dragon");
    assert.equal(normalizePrompt("a red dragon..."), "a red dragon");
  });
});

describe("deriveCacheKey", () => {
  const base: CacheKeyInput = {
    prompt: "a red dragon",
    referenceAssetIds: ["a", "b"],
    model: "flux-schnell",
    params: { aspect_ratio: "1:1", seed: 7 },
  };

  it("returns a 64-char hex sha256 digest", () => {
    const key = deriveCacheKey(base);
    assert.match(key, /^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical input", () => {
    assert.equal(deriveCacheKey(base), deriveCacheKey(base));
  });

  it("ignores reference-id ordering", () => {
    const reordered: CacheKeyInput = { ...base, referenceAssetIds: ["b", "a"] };
    assert.equal(deriveCacheKey(base), deriveCacheKey(reordered));
  });

  it("ignores param key ordering", () => {
    const reordered: CacheKeyInput = {
      ...base,
      params: { seed: 7, aspect_ratio: "1:1" },
    };
    assert.equal(deriveCacheKey(base), deriveCacheKey(reordered));
  });

  it("treats formatting-equivalent prompts as the same key", () => {
    const noisy: CacheKeyInput = { ...base, prompt: "  A Red Dragon.  " };
    assert.equal(deriveCacheKey(base), deriveCacheKey(noisy));
  });

  it("changes when the model changes", () => {
    const other: CacheKeyInput = { ...base, model: "flux-dev" };
    assert.notEqual(deriveCacheKey(base), deriveCacheKey(other));
  });

  it("changes when a param value changes", () => {
    const other: CacheKeyInput = { ...base, params: { ...base.params, seed: 8 } };
    assert.notEqual(deriveCacheKey(base), deriveCacheKey(other));
  });
});
