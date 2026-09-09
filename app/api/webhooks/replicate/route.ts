/*
 * Replicate webhook handler.
 *
 * - Verifies the signature with the SDK's `validateWebhook`, which implements
 *   Replicate's svix-style scheme: HMAC-SHA256 over `id.timestamp.body` keyed
 *   by the base64 tail of REPLICATE_WEBHOOK_SECRET, compared against the
 *   space-separated `v1,<sig>` entries in the `webhook-signature` header.
 *   Verification is skipped in dev when the secret is unset; the body is still
 *   parsed strictly.
 * - Idempotency via webhook_events.
 * - On success, prices the generation for the daily cost ceiling and fans out
 *   'ai.generation.output_ready' carrying Replicate's output URL.
 *
 * The handler deliberately does not create the asset — that means fetching an
 * image, which wants durable retries rather than a webhook's single attempt.
 * inngest/functions/ingest-generation-output.ts does the fetch, writes the
 * object to R2 and only then sends 'ai.generation.completed'. The output URL
 * travels in the event payload rather than a column: it expires, so it is not
 * something to persist.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { validateWebhook } from "replicate";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { aiGenerations, webhookEvents } from "@/drizzle/schema";
import { replicatePredictionWebhookSchema } from "@/lib/parse";
import { inngest } from "@/inngest/client";
import { modelCostCents, type GenerationModel } from "@/lib/replicate/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyWebhook(rawBody: string, request: Request): Promise<boolean> {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signature = request.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return false;

  try {
    return await validateWebhook({ id, timestamp, signature, body: rawBody, secret });
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  if (!(await verifyWebhook(rawBody, request))) {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const parsed = replicatePredictionWebhookSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const payload = parsed.data;

  try {
    await db.insert(webhookEvents).values({
      id: newId(),
      provider: "replicate",
      eventId: payload.id,
      payloadSummary: { status: payload.status },
    });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const rows = await db
    .select()
    .from(aiGenerations)
    .where(eq(aiGenerations.replicatePredictionId, payload.id))
    .limit(1);
  const generation = rows[0];
  if (!generation) {
    // The prediction may have been triggered out-of-band; ignore.
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (payload.status === "succeeded") {
    const outputUrl = Array.isArray(payload.output)
      ? payload.output[0]
      : payload.output;

    // Replicate charged us whether or not we manage to store the result, so
    // the cost is recorded here rather than in the ingest step. The row stays
    // 'running' until the asset exists.
    await db
      .update(aiGenerations)
      .set({
        // Prices the daily cost ceiling (kill switch). Conservative integer
        // cents; precise sub-cent billing is deferred. See modelCostCents.
        costUsdCents: modelCostCents(generation.model as GenerationModel),
      })
      .where(eq(aiGenerations.id, generation.id));

    if (typeof outputUrl !== "string" || outputUrl.length === 0) {
      await db
        .update(aiGenerations)
        .set({
          status: "failed",
          errorMessage: "Replicate reported success with no output",
          completedAt: new Date(),
        })
        .where(eq(aiGenerations.id, generation.id));
      await inngest.send({
        name: "ai.generation.failed",
        data: { generationId: generation.id, error: "no output" },
      });
      return NextResponse.json({ ok: true });
    }

    await inngest.send({
      name: "ai.generation.output_ready",
      data: { generationId: generation.id, outputUrl },
    });
  } else if (payload.status === "failed" || payload.status === "canceled") {
    await db
      .update(aiGenerations)
      .set({
        status: payload.status === "canceled" ? "cancelled" : "failed",
        errorMessage: payload.error ?? null,
        completedAt: new Date(),
      })
      .where(eq(aiGenerations.id, generation.id));

    await inngest.send({
      name: "ai.generation.failed",
      data: { generationId: generation.id, error: payload.error ?? "unknown" },
    });
  }

  return NextResponse.json({ ok: true });
}
