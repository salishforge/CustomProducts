import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  displayDecoration,
  formatDimensionsMm,
  formatPriceCents,
  leadParagraph,
  materialFromCategory,
  tailParagraphs,
} from "../lib/display/product";

describe("materialFromCategory", () => {
  it("maps a known category to its material token", () => {
    assert.equal(materialFromCategory("crystal_engraving"), "crystal");
    assert.equal(materialFromCategory("leather_patch"), "leather");
    assert.equal(materialFromCategory("dog_tag"), "metal");
  });

  it("falls back to laser for an unknown category", () => {
    assert.equal(materialFromCategory("unobtainium"), "laser");
  });
});

describe("displayDecoration", () => {
  it("renders a human label for a known method", () => {
    assert.equal(displayDecoration("uv_print"), "UV printed");
    assert.equal(displayDecoration("crystal_engrave"), "Sub-surface crystal laser");
  });

  it("passes an unknown method through unchanged", () => {
    assert.equal(displayDecoration("hand_carved"), "hand_carved");
  });
});

describe("formatPriceCents", () => {
  it("renders whole dollars with no fractional digits", () => {
    assert.equal(formatPriceCents(4200), "$42");
  });

  it("rounds to the nearest dollar", () => {
    assert.equal(formatPriceCents(4250), "$43");
  });

  it("defaults to USD", () => {
    assert.equal(formatPriceCents(0), "$0");
  });
});

describe("leadParagraph", () => {
  it("returns the first paragraph before the blank-line break", () => {
    assert.equal(leadParagraph("Lede here.\n\nThe rest."), "Lede here.");
  });

  it("returns the whole string when there is no paragraph break", () => {
    assert.equal(leadParagraph("Single line."), "Single line.");
  });

  it("returns empty string for null or undefined", () => {
    assert.equal(leadParagraph(null), "");
    assert.equal(leadParagraph(undefined), "");
  });
});

describe("tailParagraphs", () => {
  it("returns everything after the first paragraph break", () => {
    assert.equal(tailParagraphs("Lede.\n\nSpec one.\n\nSpec two."), "Spec one.\n\nSpec two.");
  });

  it("returns empty string when there is no break", () => {
    assert.equal(tailParagraphs("Only a lede."), "");
  });

  it("returns empty string for null", () => {
    assert.equal(tailParagraphs(null), "");
  });
});

describe("formatDimensionsMm", () => {
  it("formats w/h/d into a millimetre triple", () => {
    assert.equal(formatDimensionsMm({ w: 80, h: 80, d: 80 }), "80 × 80 × 80 mm");
  });

  it("prefers an explicit label when present", () => {
    assert.equal(formatDimensionsMm({ w: 80, h: 80, label: "Standard 80mm" }), "Standard 80mm");
  });

  it("formats whatever finite dimensions are present", () => {
    assert.equal(formatDimensionsMm({ w: 90, h: 40 }), "90 × 40 mm");
  });

  it("returns null when there is no usable data", () => {
    assert.equal(formatDimensionsMm(null), null);
    assert.equal(formatDimensionsMm({}), null);
    assert.equal(formatDimensionsMm("nope"), null);
  });
});
