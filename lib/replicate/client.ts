/*
 * Replicate client + model resolution.
 *
 * The single place that talks to Replicate's SDK. Everything Replicate-specific
 * lives here — the API token, the selector→slug map, per-model pricing, and the
 * shape of each model's `input` object — so callers (the Inngest orchestrator,
 * the webhook) work in our own vocabulary and never import the SDK directly.
 *
 * Server-only. Instantiating the client requires REPLICATE_API_TOKEN; with the
 * token unset the getter throws, which is the intended feature gate — no token,
 * no live prediction, no spend. Enabling generation is one env var.
 */

import Replicate from "replicate";

import type { GenerationRequest } from "@/lib/parse";

export type GenerationModel = GenerationRequest["model"];

/** Selector (our Zod-enforced allow-list) → Replicate model slug. The enum in
 *  lib/parse IS the allow-list; this map is the only place the slugs live. */
const MODEL_SLUGS: Record<GenerationModel, `${string}/${string}`> = {
  "flux-schnell": "black-forest-labs/flux-schnell",
  "flux-dev": "black-forest-labs/flux-dev",
  "flux-1.1-pro": "black-forest-labs/flux-1.1-pro",
  "flux-redux-dev": "black-forest-labs/flux-redux-dev",
};

/**
 * Per-image list price in USD cents, rounded UP to the integer that
 * ai_generations.cost_usd_cents stores. flux-schnell's real ~$0.003 is
 * sub-cent; ceiling it to 1 means the daily cost ceiling (a kill switch) counts
 * every image as non-zero and can therefore only ever trip EARLY — the
 * fail-safe direction for a spend guard. Precise sub-cent billing needs a finer
 * unit than integer cents and is Phase 2b.
 */
const MODEL_COST_CENTS: Record<GenerationModel, number> = {
  "flux-schnell": 1, // ~$0.003
  "flux-dev": 3, // ~$0.025
  "flux-1.1-pro": 4, // ~$0.04
  "flux-redux-dev": 3, // ~$0.025
};

let client: Replicate | null = null;

/** Lazy singleton. Throws when REPLICATE_API_TOKEN is unset — the feature gate. */
export function getReplicateClient(): Replicate {
  if (client) return client;
  const auth = process.env.REPLICATE_API_TOKEN;
  if (!auth) {
    throw new Error("REPLICATE_API_TOKEN is not set");
  }
  client = new Replicate({ auth });
  return client;
}

export function modelSlug(model: GenerationModel): `${string}/${string}` {
  return MODEL_SLUGS[model];
}

export function modelCostCents(model: GenerationModel): number {
  return MODEL_COST_CENTS[model];
}

export type BuildInputArgs = {
  model: GenerationModel;
  prompt: string;
  aspectRatio: string;
  seed: number | null;
  /** Public URLs of reference images, request order preserved. */
  referenceImageUrls: readonly string[];
};

/**
 * Maps a generation request into the model's `input` object.
 *
 * We send only the cross-model-safe intersection — prompt (or redux_image),
 * aspect_ratio, and seed. A key a given Flux variant doesn't accept returns a
 * 422, and the live call isn't exercisable in dev yet, so we stay minimal.
 * Richer per-model knobs (guidance, inference steps, output_format) land once
 * the call can be driven end-to-end and its 422s observed.
 *
 * References only influence flux-redux-dev (image variation); the pure
 * text-to-image Flux models take no image input, so a reference attached to
 * them is silently unused — the customizer selects redux when references exist.
 */
export function buildModelInput(args: BuildInputArgs): Record<string, unknown> {
  const base: Record<string, unknown> = { aspect_ratio: args.aspectRatio };
  if (args.seed !== null) base.seed = args.seed;

  if (args.model === "flux-redux-dev") {
    const guide = args.referenceImageUrls[0];
    if (!guide) {
      throw new Error("flux-redux-dev requires a reference image");
    }
    return { ...base, redux_image: guide };
  }

  return { ...base, prompt: args.prompt };
}
