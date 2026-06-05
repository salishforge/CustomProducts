/*
 * SVG builder for laser families.
 *
 * Convention used by most laser controllers (LightBurn, Aurora8, RDWorks):
 *   - stroke="#FF0000" → cut path
 *   - fill ="#000000" → engrave area (raster + vector both supported)
 *
 * Text is emitted as <text> elements with `font-family` set to the customer's
 * chosen face. For maximum compatibility with laser controllers that don't
 * embed fonts, a follow-up pass should convert text → paths via opentype.js
 * — flagged with a TODO so it's grep-able from the print pipeline.
 */

import type { ResolvedLayer } from "./resolve";

export type SvgBuildOptions = {
  /** Page size in mm. */
  widthMm: number;
  heightMm: number;
  /** Canvas-space pixels per mm. Konva stage is 720×900px; if the SKU is
   *  90×80mm the ratio is 8 px/mm. Defaults to 4 px/mm. */
  pxPerMm?: number;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return Buffer.from(binary, "binary").toString("base64");
}

export function buildSvg(
  layers: ResolvedLayer[],
  opts: SvgBuildOptions,
): string {
  const { widthMm, heightMm, pxPerMm = 4 } = opts;
  const widthPx = widthMm * pxPerMm;
  const heightPx = heightMm * pxPerMm;

  const body = layers
    .map((l) => {
      const t = l.transform;
      const transform = t.rotation
        ? `transform="translate(${t.x} ${t.y}) rotate(${t.rotation} ${t.width / 2} ${t.height / 2})"`
        : `transform="translate(${t.x} ${t.y})"`;

      if (l.kind === "text") {
        // Laser engraving treats fill as the engraved area. Use #000.
        return `  <text ${transform} font-family="${esc(l.fontFamily)}" font-weight="${l.fontWeight}" font-size="${l.fontSize}" fill="#000000" dominant-baseline="hanging">${esc(l.content)}</text>`;
      }

      // Image: embed as data URI so the file is self-contained.
      const b64 = bytesToBase64(l.bytes);
      return `  <image ${transform} width="${t.width}" height="${t.height}" preserveAspectRatio="xMidYMid meet" href="data:${l.mimeType};base64,${b64}" />`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${widthMm}mm" height="${heightMm}mm"
     viewBox="0 0 ${widthPx} ${heightPx}">
  <!-- Salishforge print-ready file. Laser convention: stroke=#FF0000 cut, fill=#000000 engrave.
       TODO: convert text→paths via opentype.js for controllers that don't embed fonts. -->
${body}
</svg>
`;
}
