/*
 * First leg of a customizer upload: mint a presigned PUT into quarantine.
 *
 * The browser sends the bytes straight to R2 rather than through here, because
 * a Vercel request body caps near 4.5MB while the upload schema admits 25MB.
 * The signature covers content-type and content-length, so the object R2
 * accepts is the one this route approved — a client cannot substitute a larger
 * file or a different type after the fact (verified against R2: a mismatch
 * returns 403).
 *
 * No database row is written here. An upload only exists once
 * /api/uploads/complete has read the bytes back, decoded them and promoted
 * them out of `incoming/`, which an R2 lifecycle rule empties after 24h.
 */

import { NextResponse } from "next/server";

import { newId } from "@/lib/db/id";
import { presignUploadRequestSchema } from "@/lib/parse";
import { presignPut } from "@/lib/r2/client";
import { incomingKey } from "@/lib/r2/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Long enough for a large file on a slow connection, short enough that a
 *  leaked URL is not a standing write grant. */
const PUT_TTL_SECONDS = 300;

export async function POST(request: Request): Promise<Response> {
  const parsed = presignUploadRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid request" },
      { status: 400 },
    );
  }
  const { mimeType, byteSize } = parsed.data;

  const assetId = newId();
  const url = await presignPut(incomingKey(assetId), {
    contentType: mimeType,
    byteSize,
    expiresIn: PUT_TTL_SECONDS,
  });

  return NextResponse.json({ ok: true, assetId, url });
}
