/*
 * Replicate generation orchestrator.
 *
 * Flow:
 *   1. Mark the ai_generations row 'running'.
 *   2. Resolve reference-image asset ids → signed R2 URLs Replicate can fetch.
 *   3. predictions.create() with a webhook pointed at /api/webhooks/replicate,
 *      storing the returned prediction id (the webhook matches on it).
 *   4. Suspend on step.waitForEvent('ai.generation.completed').
 *   5. The webhook fans out 'ai.generation.output_ready'; the ingest function
 *      stores the output in R2 and then sends the event this waits on. So the
 *      wait covers the download too, not just Replicate's own runtime.
 */

import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { aiGenerations, uploadedAssets } from "@/drizzle/schema";
import { inngest } from "@/inngest/client";
import { presignGet } from "@/lib/r2/client";
import {
  buildModelInput,
  getReplicateClient,
  modelSlug,
  type GenerationModel,
} from "@/lib/replicate/client";

export const runGeneration = inngest.createFunction(
  {
    id: "ai-run-generation",
    name: "Run AI generation (Replicate)",
    concurrency: { limit: 8 },
    retries: 1,
  },
  { event: "ai.generation.requested" },
  async ({ event, step }) => {
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

    const referenceUrls = await step.run("resolve-references", async () => {
      const ids = generation.referenceImageAssetIds as string[];
      if (ids.length === 0) return [];
      const rows = await db
        .select({ id: uploadedAssets.id, r2Key: uploadedAssets.r2Key })
        .from(uploadedAssets)
        .where(inArray(uploadedAssets.id, ids));
      const byId = new Map(rows.map((r) => [r.id, r.r2Key]));
      // The bucket is private, so Replicate needs a signed URL to fetch a
      // reference image. An hour covers queue time on their side.
      // Order is preserved — redux models use the first entry.
      const keys = ids
        .map((id) => byId.get(id))
        .filter((key): key is string => typeof key === "string");
      return Promise.all(
        keys.map((key) => presignGet(key, { expiresIn: 3600 })),
      );
    });

    // Create the prediction. On any failure — including an unset token — mark
    // the row failed in the same step so the customizer stops polling, rather
    // than letting Inngest retry-then-abandon it in 'running'.
    const created = await step.run("create-prediction", async () => {
      try {
        const client = getReplicateClient();
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL ?? "https://salishforge.com";
        const model = generation.model as GenerationModel;
        const params = generation.params as {
          aspectRatio?: string;
          seed?: number | null;
        };

        const prediction = await client.predictions.create({
          model: modelSlug(model),
          input: buildModelInput({
            model,
            prompt: generation.prompt,
            aspectRatio: params.aspectRatio ?? "1:1",
            seed: params.seed ?? null,
            referenceImageUrls: referenceUrls,
          }),
          webhook: `${appUrl}/api/webhooks/replicate`,
          webhook_events_filter: ["completed"],
        });

        await db
          .update(aiGenerations)
          .set({
            replicatePredictionId: prediction.id,
            modelVersion: prediction.version,
          })
          .where(eq(aiGenerations.id, generationId));

        return { ok: true as const, predictionId: prediction.id };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "replicate create failed";
        await db
          .update(aiGenerations)
          .set({ status: "failed", errorMessage: message, completedAt: new Date() })
          .where(eq(aiGenerations.id, generationId));
        return { ok: false as const, message };
      }
    });

    if (!created.ok) {
      return { ok: false, reason: "create_failed", detail: created.message };
    }

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
