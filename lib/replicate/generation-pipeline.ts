/*
 * AI generation entry point.
 *
 * The single function the customizer's "Generate" button calls. It is a
 * Server Action — runs on the server, never exposes the Replicate token.
 *
 * Pipeline:
 *   1. Auth context (current customer or guest IP).
 *   2. Zod-parse the payload → GenerationRequest.
 *   3. Compute cache_key from (normalized prompt, sorted ref hashes, model, params).
 *   4. SELECT existing generation by cache_key — return on hit ($0).
 *   5. Rate-limit (per-customer cap, per-IP cap for guests, daily cost ceiling).
 *   6. Moderation pre-check on prompt text.
 *   7. INSERT ai_generations with status='queued' and cache_key.
 *   8. inngest.send('ai.generation.requested') — durable function picks up.
 *
 * Deep module, narrow interface. See plan §AI integration boundary.
 */

"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { aiGenerations } from "@/drizzle/schema";
import { getSession } from "@/lib/auth";
import { inngest } from "@/inngest/client";
import {
  generationRequestSchema,
  type GenerationRequest,
} from "@/lib/parse";

import { deriveCacheKey, normalizePrompt } from "./cache-key";
import { moderatePrompt } from "./moderation";
import {
  checkCustomerDailyCap,
  checkDailyCostCeiling,
  checkGuestIpDailyCap,
} from "./rate-limit";

export type CreateGenerationResult =
  | { ok: true; generationId: string; cached: boolean }
  | {
      ok: false;
      reason:
        | "rate_limited_customer"
        | "rate_limited_guest"
        | "rate_limited_cost"
        | "moderation_failed"
        | "invalid_request";
      detail?: string;
    };

export async function createGeneration(
  input: GenerationRequest,
  ctx?: { guestIp?: string },
): Promise<CreateGenerationResult> {
  const parsed = generationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid_request", detail: parsed.error.message };
  }
  const request = parsed.data;

  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;

  const cacheKey = deriveCacheKey({
    prompt: request.prompt,
    referenceAssetIds: request.referenceAssetIds,
    model: request.model,
    params: {
      aspectRatio: request.aspectRatio,
      referenceWeight: request.referenceWeight,
      stylePreset: request.stylePreset ?? null,
      seed: request.seed ?? null,
    },
  });

  // Cache hit — return immediately.
  const existing = await db
    .select()
    .from(aiGenerations)
    .where(eq(aiGenerations.cacheKey, cacheKey))
    .limit(1);
  if (existing[0]) {
    return { ok: true, generationId: existing[0].id, cached: true };
  }

  // Rate limits.
  const costGate = await checkDailyCostCeiling();
  if (!costGate.ok) return { ok: false, reason: "rate_limited_cost" };

  if (customerId) {
    const customerGate = await checkCustomerDailyCap(customerId);
    if (!customerGate.ok) return { ok: false, reason: "rate_limited_customer" };
  } else if (ctx?.guestIp) {
    const guestGate = await checkGuestIpDailyCap(ctx.guestIp);
    if (!guestGate.ok) return { ok: false, reason: "rate_limited_guest" };
  }

  // Moderation.
  const moderation = await moderatePrompt(request.prompt);
  if (!moderation.ok) {
    return {
      ok: false,
      reason: "moderation_failed",
      detail: moderation.categories.join(","),
    };
  }

  // Insert (UNIQUE on cache_key catches concurrent dupes — if it races,
  // we re-select).
  const generationId = newId();
  try {
    await db.insert(aiGenerations).values({
      id: generationId,
      customerId,
      prompt: request.prompt,
      promptHash: normalizePrompt(request.prompt),
      model: request.model,
      params: {
        aspectRatio: request.aspectRatio,
        referenceWeight: request.referenceWeight,
        stylePreset: request.stylePreset ?? null,
        seed: request.seed ?? null,
      },
      referenceImageAssetIds: request.referenceAssetIds,
      cacheKey,
      status: "queued",
    });
  } catch {
    const racedExisting = await db
      .select()
      .from(aiGenerations)
      .where(eq(aiGenerations.cacheKey, cacheKey))
      .limit(1);
    if (racedExisting[0]) {
      return { ok: true, generationId: racedExisting[0].id, cached: true };
    }
    throw new Error("failed to record generation request");
  }

  await inngest.send({
    name: "ai.generation.requested",
    data: { generationId },
  });

  return { ok: true, generationId, cached: false };
}
