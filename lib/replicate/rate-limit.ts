/*
 * Replicate rate-limiting + cost-ceiling kill switch.
 *
 * Postgres-backed counters — no extra infra. For multi-instance burst
 * protection we'd add an in-memory token bucket (Upstash Redis); not needed
 * at MVP traffic.
 */

import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { aiGenerations } from "@/drizzle/schema";

const CUSTOMER_DAILY_HARD_CAP = 40;
const GUEST_IP_DAILY_CAP = 5;

export type RateLimitDecision =
  | { ok: true }
  | { ok: false; reason: "customer_cap" | "guest_cap" | "cost_ceiling" };

function dayWindowStart(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

export async function checkCustomerDailyCap(
  customerId: string,
): Promise<RateLimitDecision> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiGenerations)
    .where(
      and(
        eq(aiGenerations.customerId, customerId),
        gte(aiGenerations.createdAt, dayWindowStart()),
      ),
    );
  const count = row?.count ?? 0;
  if (count >= CUSTOMER_DAILY_HARD_CAP) {
    return { ok: false, reason: "customer_cap" };
  }
  return { ok: true };
}

export async function checkGuestIpDailyCap(
  ipHash: string,
): Promise<RateLimitDecision> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiGenerations)
    .where(
      and(
        eq(aiGenerations.guestIpHash, ipHash),
        gte(aiGenerations.createdAt, dayWindowStart()),
      ),
    );
  const count = row?.count ?? 0;
  if (count >= GUEST_IP_DAILY_CAP) {
    return { ok: false, reason: "guest_cap" };
  }
  return { ok: true };
}

/**
 * Daily aggregate kill switch. If total spend in the last 24h exceeds the
 * env-configured ceiling, new generations are paused. Operator-email-on-trip
 * arrives with the live Replicate billing wire in Phase 2b.
 */
export async function checkDailyCostCeiling(): Promise<RateLimitDecision> {
  const ceilingCents = Number.parseInt(
    process.env.AI_DAILY_COST_CEILING_USD_CENTS ?? "2000",
    10,
  );
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${aiGenerations.costUsdCents}),0)::int` })
    .from(aiGenerations)
    .where(gte(aiGenerations.createdAt, dayWindowStart()));
  const totalCents = row?.total ?? 0;
  if (totalCents >= ceilingCents) {
    return { ok: false, reason: "cost_ceiling" };
  }
  return { ok: true };
}
