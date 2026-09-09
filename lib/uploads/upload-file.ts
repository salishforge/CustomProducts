/*
 * Browser side of the two-leg upload.
 *
 * Runs in the client so the file bytes go from the user's disk to R2 without
 * passing through Next, which is the only way the 25MB limit is reachable at
 * all — a Vercel request body caps near 4.5MB. The server approves a size and
 * type first (/api/uploads/presign) and verifies the stored bytes afterwards
 * (/api/uploads/complete); this module is only the courier between them.
 *
 * The hash is computed here so the server can detect a transfer that corrupted
 * the file. It is not a security boundary — the server recomputes it.
 */

export type UploadResult =
  | { ok: true; assetId: string; url: string; width: number | null; height: number | null }
  | { ok: false; reason: string };

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function uploadImageFile(file: File): Promise<UploadResult> {
  const buffer = await file.arrayBuffer();
  const contentHash = await sha256Hex(buffer);

  const presigned = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type,
      byteSize: file.size,
      contentHash,
    }),
  });
  const presignBody = await presigned.json();
  if (!presigned.ok || !presignBody.ok) {
    return { ok: false, reason: presignBody.error ?? "Could not start the upload" };
  }

  // Content-type must match what was signed, or R2 rejects the write.
  const stored = await fetch(presignBody.url, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: buffer,
  });
  if (!stored.ok) {
    return { ok: false, reason: "Upload failed. Check your connection and retry." };
  }

  const completed = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assetId: presignBody.assetId, filename: file.name, contentHash }),
  });
  const completeBody = await completed.json();
  if (!completed.ok || !completeBody.ok) {
    return { ok: false, reason: completeBody.error ?? "Could not finish the upload" };
  }

  return {
    ok: true,
    assetId: completeBody.assetId,
    url: completeBody.url,
    width: completeBody.width,
    height: completeBody.height,
  };
}
