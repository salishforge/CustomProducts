/*
 * Durable wrapper around the generation-output ingest.
 *
 * Replicate serves its output from a CDN URL that expires. Pinning that URL as
 * an asset key — which is what the webhook did before this function existed —
 * means every customer design depends on a third party keeping an object alive,
 * and an order becomes unfulfillable the moment it does not.
 *
 * The fetch lives here rather than in the webhook for two reasons: a webhook
 * handler should return quickly, and a network fetch against an expiring
 * resource wants durable retries, which a route handler has no way to give it.
 * The work itself is in lib/replicate/ingest-output.ts; this file is only the
 * orchestration — two steps, so a failed database write retries without
 * re-downloading the image.
 *
 * Ordering matters: 'ai.generation.completed' is what run-generation suspends
 * on, and it is sent only once the asset row exists, so any consumer that sees
 * it can rely on outputAssetId resolving.
 *
 * Retry budget: Replicate's output URLs do not live forever, so retrying past
 * their lifetime would strand a generation. Three attempts stays well inside
 * that window, and onFailure marks the row failed with a message that names the
 * cause rather than leaving it stuck in 'running'.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { aiGenerations } from "@/drizzle/schema";
import { inngest } from "@/inngest/client";
import {
  fetchAndStoreOutput,
  recordGenerationOutput,
} from "@/lib/replicate/ingest-output";

export const ingestGenerationOutput = inngest.createFunction(
  {
    id: "ai-ingest-generation-output",
    name: "Ingest an AI generation output into R2",
    concurrency: { limit: 4 },
    retries: 3,
    onFailure: async ({ event }) => {
      const { generationId } = event.data.event.data;
      await db
        .update(aiGenerations)
        .set({
          status: "failed",
          errorMessage: "output expired before ingest",
          completedAt: new Date(),
        })
        .where(eq(aiGenerations.id, generationId));
      await inngest.send({
        name: "ai.generation.failed",
        data: { generationId, error: "output expired before ingest" },
      });
    },
  },
  { event: "ai.generation.output_ready" },
  async ({ event, step }) => {
    const { generationId, outputUrl } = event.data;

    const generation = await step.run("load-generation", async () => {
      const rows = await db
        .select()
        .from(aiGenerations)
        .where(eq(aiGenerations.id, generationId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new Error(`Generation ${generationId} not found`);
      return row;
    });

    const stored = await step.run("fetch-verify-store", () =>
      fetchAndStoreOutput(outputUrl),
    );

    await step.run("record-asset", () =>
      recordGenerationOutput(generationId, generation.customerId, stored),
    );

    await step.sendEvent("notify-completed", {
      name: "ai.generation.completed",
      data: { generationId },
    });

    return { ok: true, assetId: stored.assetId };
  },
);
