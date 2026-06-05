/*
 * Conditional CMYK conversion for UV-print / dye-sub PDFs.
 *
 * Why this module exists: UV printers and dye-sub presses expect CMYK
 * artwork. pdf-lib (the assembler in pdf-builder.ts) only emits sRGB — it has
 * no color-management engine. True device-CMYK conversion needs a rendering
 * pipeline with ICC support; the project plan nominates Ghostscript on a
 * Node-capable deploy target (the "Fly Machine" escalation) for that job.
 *
 * The design choice — a capability gate rather than a hard dependency — is
 * deliberate: the MVP host (Vercel) has no Ghostscript, and shipping sRGB the
 * printer driver can color-manage is strictly better than shipping a
 * half-converted file with CMYK rasters but sRGB text. So:
 *
 *   - Ghostscript present  → convert the whole PDF to DeviceCMYK in one pass.
 *   - Ghostscript absent   → return the sRGB bytes unchanged (honest passthrough).
 *
 * The active path in the current environment is the passthrough — `gs` is not
 * installed here, so `detectGhostscript()` returns false and no conversion
 * runs. The moment a deploy target has `gs` on PATH, conversion turns on with
 * no code change. Install/verification guidance is in OPS.md.
 *
 * spawnSync is acceptable: conversion only ever runs inside the background
 * Inngest print-file step, never on a request path, so blocking the event loop
 * for the duration of one `gs` invocation is fine.
 */

import { spawnSync } from "node:child_process";

export type ColorSpace = "cmyk" | "srgb";

let cachedGhostscript: boolean | null = null;

/** True when a runnable `gs` binary is on PATH. Memoized after first probe. */
export function detectGhostscript(): boolean {
  if (cachedGhostscript !== null) return cachedGhostscript;
  const probe = spawnSync("gs", ["--version"], { stdio: "ignore" });
  cachedGhostscript = probe.status === 0;
  return cachedGhostscript;
}

/**
 * Ghostscript arguments that re-render a PDF read from stdin into DeviceCMYK
 * and write it to stdout. Pure so the flag set is unit-testable without `gs`.
 */
export function ghostscriptCmykArgs(): string[] {
  return [
    "-dSAFER",
    "-dBATCH",
    "-dNOPAUSE",
    "-sDEVICE=pdfwrite",
    "-dProcessColorModel=/DeviceCMYK",
    "-sColorConversionStrategy=CMYK",
    "-sOutputFile=-",
    "-",
  ];
}

/** The color space a build will actually carry given Ghostscript availability. */
export function pickColorSpace(hasGhostscript: boolean): ColorSpace {
  return hasGhostscript ? "cmyk" : "srgb";
}

/**
 * Convert assembled sRGB PDF bytes to DeviceCMYK when Ghostscript is available,
 * otherwise return them unchanged. The capability is injectable so the
 * passthrough branch is testable independent of the host's tooling.
 */
export async function convertPdfToCmyk(
  pdfBytes: Uint8Array,
  opts: { hasGhostscript?: boolean } = {},
): Promise<Uint8Array> {
  const hasGhostscript = opts.hasGhostscript ?? detectGhostscript();
  if (!hasGhostscript) return pdfBytes;

  const result = spawnSync("gs", ghostscriptCmykArgs(), {
    input: Buffer.from(pdfBytes),
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Ghostscript CMYK conversion failed (status ${result.status}): ` +
        (result.stderr?.toString() ?? "no stderr"),
    );
  }
  return new Uint8Array(result.stdout);
}
