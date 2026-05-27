/*
 * Customer-facing display helpers.
 *
 * Pure presentation. Maps category enum → material tint token, formats the
 * decoration method enum into a human label, splits MDX descriptions into
 * a lede + the rest, formats variant dimension jsonb into a printable string.
 *
 * Kept narrow on purpose: any presentational decision that doesn't fit into
 * a short pure helper belongs in the consuming component instead.
 */

export type MaterialToken = "laser" | "uv" | "crystal" | "leather" | "metal";

const CATEGORY_TO_MATERIAL: Record<string, MaterialToken> = {
  crystal_engraving: "crystal",
  drinkware: "uv",
  phone_case: "uv",
  tcg_accessory: "uv",
  leather_patch: "leather",
  dog_tag: "metal",
  coin: "metal",
  zippo: "metal",
  bookmark: "laser",
};

export function materialFromCategory(category: string): MaterialToken {
  return CATEGORY_TO_MATERIAL[category] ?? "laser";
}

const DECORATION_LABELS: Record<string, string> = {
  laser: "Laser engraved",
  uv_print: "UV printed",
  crystal_engrave: "Sub-surface crystal laser",
  dye_sub: "Dye sublimation",
};

export function displayDecoration(method: string): string {
  return DECORATION_LABELS[method] ?? method;
}

export function formatPriceCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** First paragraph of an MDX description (used as the PDP lede + catalog hover). */
export function leadParagraph(mdx: string | null | undefined): string {
  if (!mdx) return "";
  const idx = mdx.indexOf("\n\n");
  return (idx === -1 ? mdx : mdx.slice(0, idx)).trim();
}

/** Everything after the first paragraph — the fabrication spec. */
export function tailParagraphs(mdx: string | null | undefined): string {
  if (!mdx) return "";
  const idx = mdx.indexOf("\n\n");
  return idx === -1 ? "" : mdx.slice(idx + 2).trim();
}

/** dimensions jsonb on product_variants is `{w, h, d}` in mm. Format as e.g.
 *  "80 × 80 × 80 mm". Returns null when no data so callers can render nothing
 *  rather than a placeholder. */
export function formatDimensionsMm(
  dim: unknown,
): string | null {
  if (!dim || typeof dim !== "object") return null;
  const d = dim as { w?: number; h?: number; d?: number; label?: string };
  if (typeof d.label === "string" && d.label.length > 0) return d.label;
  const parts = [d.w, d.h, d.d].filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  if (parts.length === 0) return null;
  return `${parts.join(" × ")} mm`;
}
