/*
 * Brand rule validator.
 *
 * The LLM-proposed theme revisions pass through this gate before reaching
 * the operator. Rules track design_brief.md; when the brief changes, update
 * here too.
 */

import { FONT_PAIRING_BY_ID } from "./font-pairings";
import { PALETTE_BY_ID } from "./palettes";
import { SPACING_BY_ID } from "./spacing";

export type ThemeRevisionTokens = {
  palette_id: string;
  font_pairing_id: string;
  spacing_scale_id: string;
  layout_assignments?: Record<string, string>;
};

export type ValidationViolation = {
  rule: string;
  message: string;
};

export type ValidationResult =
  | { ok: true }
  | { ok: false; violations: ValidationViolation[] };

const WARM_ACCENT_BAND: [number, number] = [25, 55];

export function validateRevision(tokens: ThemeRevisionTokens): ValidationResult {
  const violations: ValidationViolation[] = [];

  const palette = PALETTE_BY_ID[tokens.palette_id];
  const fontPairing = FONT_PAIRING_BY_ID[tokens.font_pairing_id];
  const spacing = SPACING_BY_ID[tokens.spacing_scale_id];

  if (!palette) {
    violations.push({
      rule: "palette_known",
      message: `Unknown palette id: ${tokens.palette_id}`,
    });
  }
  if (!fontPairing) {
    violations.push({
      rule: "font_pairing_known",
      message: `Unknown font pairing id: ${tokens.font_pairing_id}`,
    });
  }
  if (!spacing) {
    violations.push({
      rule: "spacing_scale_known",
      message: `Unknown spacing scale id: ${tokens.spacing_scale_id}`,
    });
  }

  if (palette) {
    const [lo, hi] = palette.accentHueBand;
    if (lo < WARM_ACCENT_BAND[0] || hi > WARM_ACCENT_BAND[1]) {
      violations.push({
        rule: "accent_warmth_band",
        message: `Palette accent hue (${lo}–${hi}) outside the brand warm band (${WARM_ACCENT_BAND[0]}–${WARM_ACCENT_BAND[1]}). Pick a different palette or extend the brand rules.`,
      });
    }
  }

  if (fontPairing && !fontPairing.displayIsSerif) {
    violations.push({
      rule: "display_must_be_serif",
      message: `Font pairing "${fontPairing.name}" uses a non-serif display face. The brand requires an editorial display serif.`,
    });
  }

  if (spacing && spacing.leading.body < 1.5) {
    violations.push({
      rule: "body_line_height_min",
      message: `Spacing scale "${spacing.name}" has body line-height ${spacing.leading.body}; the brand requires ≥ 1.5 so paragraphs breathe.`,
    });
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}
