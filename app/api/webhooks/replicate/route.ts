/*
 * Replicate webhook handler.
 *
 * - Verifies signature against REPLICATE_WEBHOOK_SECRET (Replicate uses an
 *   `Webhook-Signature` HMAC-SHA256 header; verification is skipped in dev if
 *   the secret is unset, but the body is still parsed strictly).
 * - Idempotency via webhook_events.
 * - On success, downloads the output to R2, updates the ai_generations row,
 *   and fans out 'ai.generation.completed' so the waiting Inngest function
 *   resumes.
 *
 * The R2 download + asset row creation is stubbed until Phase 2 — the wire
 * is real, the body is incremental.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

async function sha256Hex(input: string): Promise<string> {
  return createHash("sha256").update(input).digest("hex");
}

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import {
  aiGenerations,
  uploadedAssets,
  webhookEvents,
} from "@/drizzle/schema";
import { replicatePredictionWebhookSchema } from "@/lib/parse";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("webhook-signature");

  if (!verifySignature(rawBody, signature)) {
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
      const contentHash = await sha256Hex(outputUrl);
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
