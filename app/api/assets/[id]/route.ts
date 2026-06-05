/*
 * Public serving route for customizer uploads (fixture mode).
 *
 * Uploads store their public locator in uploaded_assets.r2_key as
 * `${APP_URL}/api/assets/{id}` and the bytes under ./upload-fixtures. This
 * route resolves the asset id to its on-disk path (never trusting the request
 * for a filesystem path) and streams the bytes. AI-generation assets are
 * served directly from their external r2_key, so this route only handles
 * kind='upload'.
 */

import { readFile } from "node:fs/promises";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { uploadedAssets } from "@/drizzle/schema";
import { uploadFixturePath } from "@/lib/uploads/storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  const [asset] = await db
    .select()
    .from(uploadedAssets)
    .where(eq(uploadedAssets.id, id))
    .limit(1);
  if (!asset || asset.kind !== "upload") {
    return new NextResponse("Not found", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(uploadFixturePath(asset.id, asset.mimeType));
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
