/*
 * Read gate for customizer uploads.
 *
 * The URL shape is unchanged from the fixture era — uploaded_assets rows and
 * saved design drafts both reference `/api/assets/{id}` — but the bytes now
 * live in R2 and are private. This route resolves the id to its object key and
 * redirects to a short-lived signed URL rather than streaming the bytes, so
 * image traffic never crosses Vercel.
 *
 * Keeping the lookup here rather than making the bucket public is what leaves
 * room for authorization: kind and moderation_status are checked before a URL
 * is minted, and a future moderation pipeline needs no URL changes to take
 * effect.
 *
 * The browser sets crossOrigin="anonymous" on canvas images, so the bucket's
 * CORS policy must allow GET from the app origin — without it the redirect
 * succeeds and the image still fails to decode. See OPS.md.
 */

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db/client";
import { uploadedAssets } from "@/drizzle/schema";
import { presignGet } from "@/lib/r2/client";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 3600;
/** Deliberately below the signature's own lifetime: a cached redirect must
 *  never outlive the URL it points at. */
const REDIRECT_CACHE_SECONDS = 3000;

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

  if (!asset || asset.kind !== "upload" || asset.moderationStatus === "rejected") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = await presignGet(asset.r2Key, {
    expiresIn: SIGNED_URL_TTL_SECONDS,
  });

  return NextResponse.redirect(url, {
    status: 302,
    headers: { "cache-control": `private, max-age=${REDIRECT_CACHE_SECONDS}` },
  });
}
