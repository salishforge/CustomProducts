import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateRevision,
  type ThemeRevisionTokens,
} from "../lib/design/brand-rules";
import { PALETTES } from "../lib/design/palettes";
import { FONT_PAIRINGS } from "../lib/design/font-pairings";
import { SPACING_SCALES } from "../lib/design/spacing";

const validTokens: ThemeRevisionTokens = {
  palette_id: "forge-default",
  font_pairing_id: "fraunces-inter-jb",
  spacing_scale_id: "current",
};

describe("validateRevision", () => {
  it("passes a revision built entirely from shipped vocabulary", () => {
    const result = validateRevision(validTokens);
    assert.equal(result.ok, true);
  });

  it("flags an unknown palette id", () => {
    const result = validateRevision({ ...validTokens, palette_id: "neon-rave" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.violations.some((v) => v.rule === "palette_known"));
  });

  it("flags an unknown font pairing id", () => {
    const result = validateRevision({
      ...validTokens,
      font_pairing_id: "comic-sans-only",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.violations.some((v) => v.rule === "font_pairing_known"));
  });

  it("flags an unknown spacing scale id", () => {
    const result = validateRevision({
      ...validTokens,
      spacing_scale_id: "cramped",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.violations.some((v) => v.rule === "spacing_scale_known"));
  });

  it("reports one violation per unknown id when all three are unknown", () => {
    const result = validateRevision({
      palette_id: "x",
      font_pairing_id: "y",
      spacing_scale_id: "z",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    const rules = result.violations.map((v) => v.rule).sort();
    assert.deepEqual(rules, [
      "font_pairing_known",
      "palette_known",
      "spacing_scale_known",
    ]);
  });
});

// Every shipped vocabulary entry must clear the brand gate on its own, so a
// future palette/pairing/spacing addition that breaks a rule (accent out of
// the warm band, non-serif display, body leading < 1.5) fails CI here rather
// than in front of the operator.
describe("shipped vocabulary obeys the brand rules", () => {
  for (const palette of PALETTES) {
    it(`palette "${palette.id}" passes`, () => {
      const result = validateRevision({ ...validTokens, palette_id: palette.id });
      assert.equal(result.ok, true);
    });
  }

  for (const pairing of FONT_PAIRINGS) {
    it(`font pairing "${pairing.id}" passes`, () => {
      const result = validateRevision({ ...validTokens, font_pairing_id: pairing.id });
      assert.equal(result.ok, true);
    });
  }

  for (const spacing of SPACING_SCALES) {
    it(`spacing scale "${spacing.id}" passes`, () => {
      const result = validateRevision({ ...validTokens, spacing_scale_id: spacing.id });
      assert.equal(result.ok, true);
    });
  }
});

describe("validateRevision — layout assignments", () => {
  it("passes a known assignment that obeys the rules", () => {
    const result = validateRevision({
      ...validTokens,
      layout_assignments: {
        "home.hero": "centered",
        "home.families": "broken-grid",
      },
    });
    assert.equal(result.ok, true);
  });

  it("flags an unknown section", () => {
    const result = validateRevision({
      ...validTokens,
      layout_assignments: { "footer.legal": "whatever" },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.violations.some((v) => v.rule === "layout_section_known"));
  });

  it("flags an unknown variant for a known section", () => {
    const result = validateRevision({
      ...validTokens,
      layout_assignments: { "home.hero": "spinning-3d" },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.violations.some((v) => v.rule === "layout_variant_known"));
  });

  it("blocks a uniform grid on the home families section", () => {
    const result = validateRevision({
      ...validTokens,
      layout_assignments: { "home.families": "uniform-grid" },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.violations.some((v) => v.rule === "families_broken_grid"));
  });

  it("allows a non-broken-grid variant on a section without that rule", () => {
    const result = validateRevision({
      ...validTokens,
      layout_assignments: { "home.hero": "centered" },
    });
    assert.equal(result.ok, true);
  });
});
