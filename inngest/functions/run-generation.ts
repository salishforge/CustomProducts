/*
 * Replicate generation orchestrator.
 *
 * Flow:
 *   1. Mark the ai_generations row as 'running'.
 *   2. Resolve reference images from R2 → upload to Replicate Files API.
 *   3. Call Replicate predictions.create() with a webhook callback URL.
 *   4. Suspend with step.waitForEvent('ai.generation.completed', { match: ... }).
 *   5. The /api/webhooks/replicate route fires that event when Replicate calls back.
 *
 * Skeleton — Replicate / R2 wiring is filled in when credentials arrive.
 * The signature is final; the body is incremental.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { aiGenerations } from "@/drizzle/schema";
import { inngest } from "@/inngest/client";

export const runGeneration = inngest.createFunction(
  {
    id: "ai-run-generation",
    name: "Run AI generation (Replicate)",
    concurrency: { limit: 8 },
    retries: 1,
  },
  { event: "ai.generation.requested" },
  async ({ event, step, logger }) => {
    const { generationId } = event.data;

    await step.run("mark-running", async () => {
      await db
        .update(aiGenerations)
        .set({ status: "running" })
        .where(eq(aiGenerations.id, generationId));
    });

    const generation = await step.run("load-generation", async () => {
      const rows = await db
        .select()
        .from(aiGenerations)
        .where(eq(aiGenerations.id, generationId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new Error(`Generation ${generationId} not found`);
      }
      return row;
    });

    // TODO: Phase 2 — upload references from R2 → Replicate Files,
    // then predictions.create with webhook URL pointing at
    // `${NEXT_PUBLIC_APP_URL}/api/webhooks/replicate`.
    logger.info({ generationId, prompt: generation.prompt }, "would call Replicate");

    // Suspend until the Replicate webhook fans out the completion event.
    const completion = await step.waitForEvent("await-completion", {
      event: "ai.generation.completed",
      timeout: "5m",
      match: "data.generationId",
    });

    if (!completion) {
      await step.run("mark-failed-timeout", async () => {
        await db
          .update(aiGenerations)
          .set({ status: "failed", errorMessage: "timeout waiting for Replicate" })
          .where(eq(aiGenerations.id, generationId));
      });
      return { ok: false, reason: "timeout" };
    }

    return { ok: true, generationId };
  },
);
