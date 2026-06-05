/*
 * Admin download for fixture-mode print files.
 *
 * Gated by requireAdmin. Reads the file from ./print-fixtures/{orderId}/
 * {itemId}/{filename}. When PRINT_STORAGE_BACKEND=r2 lands, this route
 * dispatches on backend (presigned R2 URL redirect, or stream-through).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";

const MIME_BY_EXT: Record<string, string> = {
  svg: "image/svg+xml",
  pdf: "application/pdf",
  png: "image/png",
  dxf: "application/dxf",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ orderId: string; itemId: string; filename: string }> },
): Promise<Response> {
  await requireAdmin();
  const { orderId, itemId, filename } = await ctx.params;

  // Defensive: reject any path traversal.
  if (filename.includes("/") || filename.includes("..")) {
    return new NextResponse("Bad filename", { status: 400 });
  }

  const abs = path.join(process.cwd(), "print-fixtures", orderId, itemId, filename);
  let bytes: Buffer;
  try {
    bytes = await readFile(abs);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": mime,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
