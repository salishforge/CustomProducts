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
 * - On success, records the output as an asset, prices the generation for the
 *   daily cost ceiling, updates the ai_generations row, and fans out
 *   'ai.generation.completed' so the waiting Inngest function resumes.
 *
 * The R2 re-download of the output (permanence + content addressing) is
 * Phase 2b; today we pin Replicate's CDN URL as the asset key.
 */

import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { validateWebhook } from "replicate";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import {
  aiGenerations,
  uploadedAssets,
  webhookEvents,
} from "@/drizzle/schema";
import { replicatePredictionWebhookSchema } from "@/lib/parse";
import { inngest } from "@/inngest/client";
import { modelCostCents, type GenerationModel } from "@/lib/replicate/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

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
    // The Replicate CDN URL is stable enough for MVP; pin it as the asset's
    // r2_key so consumers have a single field to dereference. Phase 2b proper
    // downloads + re-uploads to R2 for cost control + permanence.
    const outputUrl = Array.isArray(payload.output)
      ? payload.output[0]
      : payload.output;
    let outputAssetId: string | null = null;
    if (typeof outputUrl === "string" && outputUrl.length > 0) {
      const assetId = newId();
      // content_hash is computed from the URL itself in this interim mode;
      // real content addressing arrives with the R2 download pipeline.
      const contentHash = sha256Hex(outputUrl);
      await db.insert(uploadedAssets).values({
        id: assetId,
        customerId: generation.customerId,
        kind: "ai_generation",
        r2Key: outputUrl,
        mimeType: "image/webp",
        byteSize: 0,
        contentHash,
        generationId: generation.id,
        moderationStatus: "approved",
      });
      outputAssetId = assetId;
    }
    await db
      .update(aiGenerations)
      .set({
        status: "succeeded",
        completedAt: new Date(),
        outputAssetId,
        // Prices the daily cost ceiling (kill switch). Conservative integer
        // cents; precise sub-cent billing is Phase 2b. See modelCostCents.
        costUsdCents: modelCostCents(generation.model as GenerationModel),
      })
      .where(eq(aiGenerations.id, generation.id));

    await inngest.send({
      name: "ai.generation.completed",
      data: { generationId: generation.id },
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
