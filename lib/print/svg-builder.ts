/*
 * SVG builder for laser families.
 *
 * Convention used by most laser controllers (LightBurn, Aurora8, RDWorks):
 *   - stroke="#FF0000" → cut path
 *   - fill ="#000000" → engrave area (raster + vector both supported)
 *
 * Text is emitted as <text> elements with `font-family` set to the customer's
 * chosen face. Laser controllers that don't embed fonts will need a future
 * text→paths pass (opentype.js); until then, the operator's controller is
 * expected to have the catalog faces installed.
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
  // Escapes both text-node and attribute-context metacharacters, since esc is
  // used for font-family="…" as well as element bodies.
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
       Text relies on controller-side fonts; a future opentype.js pass will convert text to paths. -->
${body}
</svg>
`;
}
