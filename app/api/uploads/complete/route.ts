/*
 * Second leg of a customizer upload: verify the quarantined bytes and promote
 * them.
 *
 * This is where the upload path keeps the guarantee the old server action gave
 * for free. The browser wrote those bytes to R2 without passing through our
 * code, so before anything downstream can rely on them we decode them here
 * with sharp — a real decode, which rejects a file that merely claims to be an
 * image — and recompute the hash the client declared. Only then does the object
 * move from `incoming/` to `uploads/` and become a row.
 *
 * The bytes do come back through the server once. That is the cost of keeping
 * the decode, and R2 charges nothing for egress, so it buys correctness with
 * latency rather than money.
 */

import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { db } from "@/lib/db/client";
import { uploadedAssets } from "@/drizzle/schema";
import { getSession } from "@/lib/auth";
import { completeUploadRequestSchema } from "@/lib/parse";
import { copyObject, deleteObject, getObject } from "@/lib/r2/client";
import { extForMime, incomingKey, uploadKey } from "@/lib/r2/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const parsed = completeUploadRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid request" }, { status: 400 });
  }
  const { assetId, filename, contentHash } = parsed.data;

  const quarantined = incomingKey(assetId);

  let bytes: Uint8Array;
  let contentType: string;
  try {
    const object = await getObject(quarantined);
    bytes = object.bytes;
    // R2's copy of the type, which the PUT signature covered — not the
    // client's word for it on this request.
    contentType = object.contentType;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Upload not found. Start the upload again." },
      { status: 404 },
    );
  }

  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== contentHash.toLowerCase()) {
    await deleteObject(quarantined);
    return NextResponse.json(
      { ok: false, error: "The file changed in transit. Try uploading again." },
      { status: 400 },
    );
  }

  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(bytes).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    await deleteObject(quarantined);
    return NextResponse.json(
      { ok: false, error: "Could not read that image" },
      { status: 400 },
    );
  }

  const session = await getSession().catch(() => null);
  const promoted = uploadKey(assetId, extForMime(contentType));

  await copyObject(quarantined, promoted);
  await deleteObject(quarantined);

  await db.insert(uploadedAssets).values({
    id: assetId,
    customerId: session?.user?.id ?? null,
    kind: "upload",
    r2Key: promoted,
    mimeType: contentType,
    widthPx: width,
    heightPx: height,
    byteSize: bytes.byteLength,
    originalFilename: filename.slice(0, 255),
    contentHash: actualHash,
    // No upload-moderation pipeline in MVP; uploads are usable immediately.
    moderationStatus: "approved",
  });

  return NextResponse.json({
    ok: true,
    assetId,
    url: `/api/assets/${assetId}`,
    width,
    height,
  });
}
