import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { shouldInterceptClick } from "../components/brand/view-transition-intent";

const plainClick = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};

describe("shouldInterceptClick", () => {
  it("intercepts a plain primary-button click", () => {
    assert.equal(shouldInterceptClick(plainClick), true);
  });

  it("ignores non-primary buttons so middle/right-click keep their meaning", () => {
    assert.equal(shouldInterceptClick({ ...plainClick, button: 1 }), false);
    assert.equal(shouldInterceptClick({ ...plainClick, button: 2 }), false);
  });

  it("ignores modified clicks so open-in-new-tab still works", () => {
    assert.equal(shouldInterceptClick({ ...plainClick, metaKey: true }), false);
    assert.equal(shouldInterceptClick({ ...plainClick, ctrlKey: true }), false);
    assert.equal(shouldInterceptClick({ ...plainClick, shiftKey: true }), false);
    assert.equal(shouldInterceptClick({ ...plainClick, altKey: true }), false);
  });

  it("yields to a handler that already prevented default", () => {
    assert.equal(
      shouldInterceptClick({ ...plainClick, defaultPrevented: true }),
      false,
    );
  });
});
