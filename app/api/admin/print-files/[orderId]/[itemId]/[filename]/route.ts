/*
 * Operator download for a print-ready file.
 *
 * The bucket is private, so this route is the only way in: it checks the admin
 * session, then redirects to a five-minute signed URL with a download filename
 * attached. R2 has no notion of our admin allowlist, which is why authorization
 * cannot move to the bucket.
 *
 * The object key is read out of order_items.print_ready_files rather than built
 * from the URL. The predecessor route joined these same segments into a
 * filesystem path and needed traversal guards; here the request can only ask for
 * a file the pipeline recorded, so there is no attacker-influenced key to guard.
 */

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { orderItems } from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth";
import { presignGet } from "@/lib/r2/client";
import type { StoredPrintFile } from "@/lib/print/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string; itemId: string; filename: string }> },
): Promise<Response> {
  await requireAdmin();
  const { orderId, itemId, filename } = await ctx.params;

  const [item] = await db
    .select({ printReadyFiles: orderItems.printReadyFiles })
    .from(orderItems)
    // Both ids must match, so an item id cannot be fetched under another order.
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .limit(1);

  const bundle = (item?.printReadyFiles ?? []) as StoredPrintFile[];
  const file = bundle.find((f) => f.filename === decodeURIComponent(filename));
  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = await presignGet(file.location, {
    expiresIn: SIGNED_URL_TTL_SECONDS,
    downloadFilename: file.filename,
  });

  return NextResponse.redirect(url, {
    status: 302,
    headers: { "cache-control": "no-store" },
  });
}
