import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SNAP_VH, resolveSnap, cycleSnap } from "../components/customizer/sheet-snap";

describe("resolveSnap", () => {
  it("dismisses a drag released below the floor", () => {
    assert.equal(resolveSnap(0), "dismiss");
    assert.equal(resolveSnap(4), "dismiss");
  });

  it("snaps each height to its own level", () => {
    assert.equal(resolveSnap(SNAP_VH.peek), "peek");
    assert.equal(resolveSnap(SNAP_VH.half), "half");
    assert.equal(resolveSnap(SNAP_VH.full), "full");
  });

  it("snaps an in-between height to the nearest level", () => {
    assert.equal(resolveSnap(20), "peek");
    assert.equal(resolveSnap(45), "half");
    assert.equal(resolveSnap(80), "full");
  });
});

describe("cycleSnap", () => {
  it("advances peek → half → full → peek", () => {
    assert.equal(cycleSnap("peek"), "half");
    assert.equal(cycleSnap("half"), "full");
    assert.equal(cycleSnap("full"), "peek");
  });
});
