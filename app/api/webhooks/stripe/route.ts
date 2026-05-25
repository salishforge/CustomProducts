/*
 * Stripe webhook handler.
 *
 * - Reads the raw request body (Next.js Route Handlers preserve this when we
 *   call `.text()` on the request and don't go through any JSON middleware).
 * - Verifies the signature against STRIPE_WEBHOOK_SECRET.
 * - Idempotency: writes (provider, event_id) to webhook_events with a UNIQUE
 *   constraint before doing work. Duplicate deliveries become no-ops.
 * - Translates Stripe events into Inngest events that downstream functions
 *   consume.
 */

import type Stripe from "stripe";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { webhookEvents } from "@/drizzle/schema";
import { stripeClient } from "@/lib/stripe/client";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `invalid signature: ${message}` }, { status: 400 });
  }

  // Idempotency gate. If the unique-index insert fails, this is a duplicate
  // delivery — return 200 so Stripe stops retrying.
  try {
    await db.insert(webhookEvents).values({
      id: newId(),
      provider: "stripe",
      eventId: event.id,
      payloadSummary: { type: event.type, livemode: event.livemode },
    });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "payment_intent.succeeded": {
      const object = event.data.object as { metadata?: { orderId?: string } };
      const orderId = object.metadata?.orderId;
      if (orderId) {
        await inngest.send({
          name: "order.paid",
          data: { orderId },
        });
      }
      break;
    }
    default:
      // Unhandled events are intentionally a no-op — we acknowledge so Stripe
      // doesn't retry, but we don't pretend to process them.
      break;
  }

  return NextResponse.json({ ok: true });
}
