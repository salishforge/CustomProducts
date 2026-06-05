import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LAYOUT_VARIANTS,
  LAYOUT_VARIANTS,
  SECTION_IDS,
  findLayoutVariant,
  isSectionId,
  resolveLayoutVariant,
} from "../lib/design/layouts";

describe("layout registry", () => {
  it("every section default names a registered variant of that section", () => {
    for (const section of SECTION_IDS) {
      const id = DEFAULT_LAYOUT_VARIANTS[section];
      assert.ok(
        findLayoutVariant(section, id),
        `${section} default "${id}" is not registered`,
      );
    }
  });

  it("the home families default is a broken-grid variant", () => {
    const id = DEFAULT_LAYOUT_VARIANTS["home.families"];
    assert.equal(findLayoutVariant("home.families", id)?.brokenGrid, true);
  });

  it("every variant id is unique within its section", () => {
    for (const section of SECTION_IDS) {
      const ids = LAYOUT_VARIANTS[section].map((v) => v.id);
      assert.equal(new Set(ids).size, ids.length, `${section} has duplicate ids`);
    }
  });

  it("isSectionId narrows known ids and rejects others", () => {
    assert.equal(isSectionId("home.hero"), true);
    assert.equal(isSectionId("footer.legal"), false);
  });
});

describe("resolveLayoutVariant", () => {
  it("returns the assigned variant when it is registered", () => {
    assert.equal(
      resolveLayoutVariant("home.hero", { "home.hero": "centered" }),
      "centered",
    );
  });

  it("falls back to the section default when the assignment is unknown", () => {
    assert.equal(
      resolveLayoutVariant("home.hero", { "home.hero": "bogus" }),
      DEFAULT_LAYOUT_VARIANTS["home.hero"],
    );
  });

  it("falls back to the section default when there is no assignment", () => {
    assert.equal(
      resolveLayoutVariant("home.families", undefined),
      DEFAULT_LAYOUT_VARIANTS["home.families"],
    );
    assert.equal(
      resolveLayoutVariant("home.families", {}),
      DEFAULT_LAYOUT_VARIANTS["home.families"],
    );
  });

  it("ignores an assignment that targets a different section", () => {
    assert.equal(
      resolveLayoutVariant("home.hero", { "home.families": "uniform-grid" }),
      DEFAULT_LAYOUT_VARIANTS["home.hero"],
    );
  });
});
