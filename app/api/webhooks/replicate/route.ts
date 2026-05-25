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

import { createHmac, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { aiGenerations, webhookEvents } from "@/drizzle/schema";
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
    // TODO Phase 2: download payload.output from Replicate → upload to R2 →
    // create uploaded_assets row → link via generation.outputAssetId.
    await db
      .update(aiGenerations)
      .set({ status: "succeeded", completedAt: new Date() })
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
