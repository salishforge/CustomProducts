/*
 * Print-file storage.
 *
 * Print files go to R2 under `print/{orderId}/{itemId}/{filename}` and nowhere
 * else. There is no local-disk mode: a serverless invocation does not keep what
 * it writes to disk, so a fixture backend would mean the path exercised in
 * development is not the path that runs in production — and the production one
 * would be the untested half. One backend, exercised every day.
 *
 * The bucket is private. Operators reach these files through
 * /api/admin/print-files/..., which checks the admin session and then redirects
 * to a short-lived signed URL; nothing here is publicly readable.
 *
 * The bundle returned per item lives in order_items.print_ready_files jsonb as
 * `[{kind, filename, location, byteSize, generatedAt}]`, where `location` is the
 * R2 object key. The admin route looks the key up from that row rather than
 * rebuilding it from URL segments, so a request cannot name an object the
 * pipeline did not write.
 */

import type { PrintFile } from "./dispatch";
import { putObject } from "@/lib/r2/client";
import { printKey } from "@/lib/r2/keys";

export type StoredPrintFile = {
  kind: PrintFile["kind"];
  filename: string;
  /** R2 object key. */
  location: string;
  byteSize: number;
  generatedAt: string;
};

/** Stored on the object so a signed URL serves the right type without the
 *  download route having to re-derive it. */
const CONTENT_TYPE_BY_KIND: Record<PrintFile["kind"], string> = {
  svg: "image/svg+xml",
  pdf: "application/pdf",
  png: "image/png",
  dxf: "application/dxf",
  depth_map: "image/png",
};

export async function storePrintFiles(
  orderId: string,
  itemId: string,
  files: PrintFile[],
): Promise<StoredPrintFile[]> {
  const stored: StoredPrintFile[] = [];

  for (const file of files) {
    const key = printKey(orderId, itemId, file.filename);
    await putObject(key, file.bytes, CONTENT_TYPE_BY_KIND[file.kind]);
    stored.push({
      kind: file.kind,
      filename: file.filename,
      location: key,
      byteSize: file.bytes.byteLength,
      generatedAt: new Date().toISOString(),
    });
  }

  return stored;
}
