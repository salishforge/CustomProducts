import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  validateRevision,
  type ThemeRevisionTokens,
} from "../lib/design/brand-rules";

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
