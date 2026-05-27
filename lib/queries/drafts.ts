/*
 * design_drafts reads.
 *
 * For MVP we identify a customer by their WorkOS session id; guest drafts
 * live in localStorage and are submitted on add-to-cart (not implemented in
 * the very first cut). Saving is always an UPSERT keyed by
 * (customerId, productVariantId, status='draft').
 */

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { designDrafts, type DesignDraft } from "@/drizzle/schema";

export async function findOpenDraft(
  customerId: string | null,
  productVariantId: string,
): Promise<DesignDraft | null> {
  if (!customerId) return null;
  const [row] = await db
    .select()
    .from(designDrafts)
    .where(
      and(
        eq(designDrafts.customerId, customerId),
        eq(designDrafts.productVariantId, productVariantId),
        eq(designDrafts.status, "draft"),
      ),
    )
    .orderBy(desc(designDrafts.updatedAt))
    .limit(1);
  return row ?? null;
}
