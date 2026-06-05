/*
 * Per-decoration-method dispatcher. Returns a bundle of files to emit per
 * order item; the Inngest function persists each bundle to fixture storage
 * (later: R2) and updates order_items.print_ready_files.
 */

import type { OrderItem, ProductVariant } from "@/drizzle/schema";
import type { DesignState } from "@/lib/parse";

import { resolveDesignState } from "./resolve";
import { buildSvg } from "./svg-builder";
import { buildPdf } from "./pdf-builder";
import { convertPdfToCmyk } from "./cmyk";

export type PrintFile = {
  kind: "svg" | "pdf" | "png" | "dxf" | "depth_map";
  filename: string;
  bytes: Uint8Array;
};

function dimensionsFromSnapshot(item: OrderItem, variant: ProductVariant | null): {
  widthMm: number;
  heightMm: number;
} {
  const snap = (item.productSnapshot as { dimensionsMm?: unknown })
    ?.dimensionsMm as { w?: number; h?: number; label?: string } | undefined;
  const fromSnap = snap?.w && snap?.h ? { widthMm: snap.w, heightMm: snap.h } : null;
  if (fromSnap) return fromSnap;
  const dim = variant?.dimensionsMm as { w?: number; h?: number } | null | undefined;
  if (dim?.w && dim?.h) return { widthMm: dim.w, heightMm: dim.h };
  // Fallback sensible default — a 100×100 mm canvas.
  return { widthMm: 100, heightMm: 100 };
}

export async function buildPrintFilesForOrderItem(
  item: OrderItem,
  variant: ProductVariant | null,
): Promise<PrintFile[]> {
  const decoration = (item.productSnapshot as { decorationMethod?: string })?.decorationMethod ?? "laser";
  const snapshot = item.customizationSnapshot as DesignState | null;
  if (!snapshot) return [];

  const layers = await resolveDesignState(snapshot, "main");
  const dims = dimensionsFromSnapshot(item, variant);

  const baseName = `${item.id.slice(0, 8)}`;
  const files: PrintFile[] = [];

  switch (decoration) {
    case "laser":
    case "crystal_engrave": {
      const svg = buildSvg(layers, { ...dims });
      files.push({
        kind: "svg",
        filename: `${baseName}.svg`,
        bytes: new TextEncoder().encode(svg),
      });
      break;
    }
    case "uv_print":
    case "dye_sub": {
      const pdfBytes = await buildPdf(layers, { ...dims, bleedMm: decoration === "dye_sub" ? 5 : 3 });
      // CMYK on a Ghostscript-equipped target; honest sRGB passthrough otherwise.
      const printBytes = await convertPdfToCmyk(pdfBytes);
      files.push({
        kind: "pdf",
        filename: `${baseName}.pdf`,
        bytes: printBytes,
      });
      break;
    }
    default: {
      // Unknown decoration method: emit SVG as a permissive default so the
      // operator has *something* to inspect. Real coverage of the long-tail
      // happens as new families ship.
      const svg = buildSvg(layers, { ...dims });
      files.push({
        kind: "svg",
        filename: `${baseName}.svg`,
        bytes: new TextEncoder().encode(svg),
      });
    }
  }

  return files;
}
