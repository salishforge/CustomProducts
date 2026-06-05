/*
 * Print-file storage.
 *
 * Two backends, env-selected:
 *   - 'fixture' (default in dev): writes to ./print-fixtures/{orderId}/.
 *     Files are downloadable via the admin route handler at
 *     /api/admin/print-fixtures/[orderId]/[filename] (signed by session).
 *   - 'r2' (set PRINT_STORAGE_BACKEND=r2): uploads to Cloudflare R2 under
 *     r2://print/{orderId}/{itemId}/{filename}. Reads pull a 1h-signed URL.
 *
 * The bundle returned per item lives in order_items.print_ready_files jsonb
 * as `[{kind, filename, location, generatedAt}]` so the admin UI can render
 * a download list without needing to re-derive paths.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PrintFile } from "./dispatch";

export type StoredPrintFile = {
  kind: PrintFile["kind"];
  filename: string;
  /** Backend-dependent locator. Fixture: relative path under print-fixtures.
   *  R2: object key. The admin UI dispatches on backend. */
  location: string;
  byteSize: number;
  generatedAt: string;
};

function backend(): "fixture" | "r2" {
  return (process.env.PRINT_STORAGE_BACKEND ?? "fixture") as "fixture" | "r2";
}

async function storeOneFixture(
  orderId: string,
  itemId: string,
  file: PrintFile,
): Promise<StoredPrintFile> {
  const dir = path.join(process.cwd(), "print-fixtures", orderId, itemId);
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, file.filename);
  await writeFile(abs, file.bytes);
  return {
    kind: file.kind,
    filename: file.filename,
    location: path.relative(process.cwd(), abs),
    byteSize: file.bytes.byteLength,
    generatedAt: new Date().toISOString(),
  };
}

export async function storePrintFiles(
  orderId: string,
  itemId: string,
  files: PrintFile[],
): Promise<StoredPrintFile[]> {
  const target = backend();
  if (target === "r2") {
    throw new Error(
      "R2 print storage requested but not yet implemented — leave PRINT_STORAGE_BACKEND unset for fixture mode",
    );
  }
  const out: StoredPrintFile[] = [];
  for (const f of files) {
    out.push(await storeOneFixture(orderId, itemId, f));
  }
  return out;
}
