/*
 * PDF builder for UV-print families (tumblers, cases, deck boxes, playmats).
 *
 * Uses pdf-lib to assemble a single-page PDF at the variant's print size +
 * bleed. Text renders in pdf-lib's bundled Helvetica for the MVP — a
 * follow-up embeds the customer's chosen face via fontkit when we ship
 * licensed font binaries.
 *
 * This assembler always emits sRGB — pdf-lib has no color-management engine.
 * Device-CMYK conversion is a separate, capability-gated post-step in cmyk.ts
 * (`convertPdfToCmyk`) that runs when Ghostscript is on the deploy target and
 * otherwise leaves these sRGB bytes for the printer driver to color-manage.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import type { ResolvedLayer } from "./resolve";

export type PdfBuildOptions = {
  /** Page size in mm. */
  widthMm: number;
  heightMm: number;
  /** Bleed in mm added on every side. */
  bleedMm?: number;
  /** Canvas-space px per mm; matches the SVG builder's default. */
  pxPerMm?: number;
};

const MM_TO_PT = 2.83465; // 1 mm = 2.83465 PDF points

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = Number.parseInt(m[1]!, 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

export async function buildPdf(
  layers: ResolvedLayer[],
  opts: PdfBuildOptions,
): Promise<Uint8Array> {
  const { widthMm, heightMm, bleedMm = 3, pxPerMm = 4 } = opts;
  const pageWidthPt = (widthMm + 2 * bleedMm) * MM_TO_PT;
  const pageHeightPt = (heightMm + 2 * bleedMm) * MM_TO_PT;
  const offsetPt = bleedMm * MM_TO_PT;

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageWidthPt, pageHeightPt]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const scale = MM_TO_PT / pxPerMm;

  for (const l of layers) {
    const t = l.transform;
    // PDF coordinate origin is bottom-left; canvas origin is top-left. Flip y.
    const canvasHeightPx = heightMm * pxPerMm;
    const xPt = offsetPt + t.x * scale;
    const yPt = offsetPt + (canvasHeightPx - t.y - t.height) * scale;
    const wPt = t.width * scale;
    const hPt = t.height * scale;

    if (l.kind === "text") {
      const { r, g, b } = hexToRgb(l.color);
      page.drawText(l.content, {
        x: xPt,
        y: yPt + hPt - l.fontSize * scale, // anchor at baseline
        size: l.fontSize * scale,
        font,
        color: rgb(r, g, b),
      });
    } else {
      let img;
      if (l.mimeType === "image/png") {
        img = await pdf.embedPng(l.bytes);
      } else {
        // JPEG / WebP / AVIF — pdf-lib only does PNG + JPG natively.
        // WebP/AVIF in the AI generation pipeline need to be transcoded by
        // the resolver before reaching here; for MVP we attempt JPG and let
        // pdf-lib throw if the bytes don't parse.
        img = await pdf.embedJpg(l.bytes);
      }
      page.drawImage(img, { x: xPt, y: yPt, width: wPt, height: hPt });
    }
  }

  return pdf.save();
}
