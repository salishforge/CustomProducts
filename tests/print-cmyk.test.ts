import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  convertPdfToCmyk,
  ghostscriptCmykArgs,
  pickColorSpace,
} from "../lib/print/cmyk";

// The Ghostscript-present spawn path is intentionally not exercised here: `gs`
// is not installed in this environment, so only the pure surfaces and the
// passthrough branch (capability injected) are covered.

describe("ghostscriptCmykArgs", () => {
  it("renders from stdin to stdout via the pdfwrite device", () => {
    const args = ghostscriptCmykArgs();
    assert.ok(args.includes("-sDEVICE=pdfwrite"));
    assert.ok(args.includes("-sOutputFile=-"));
    assert.equal(args.at(-1), "-"); // input comes from stdin
  });

  it("selects DeviceCMYK with a full CMYK conversion strategy", () => {
    const args = ghostscriptCmykArgs();
    assert.ok(args.includes("-dProcessColorModel=/DeviceCMYK"));
    assert.ok(args.includes("-sColorConversionStrategy=CMYK"));
  });

  it("runs non-interactively and sandboxed", () => {
    const args = ghostscriptCmykArgs();
    assert.ok(args.includes("-dBATCH"));
    assert.ok(args.includes("-dNOPAUSE"));
    assert.ok(args.includes("-dSAFER"));
  });
});

describe("pickColorSpace", () => {
  it("is cmyk when Ghostscript is available", () => {
    assert.equal(pickColorSpace(true), "cmyk");
  });

  it("is srgb when Ghostscript is absent", () => {
    assert.equal(pickColorSpace(false), "srgb");
  });
});

describe("convertPdfToCmyk", () => {
  it("returns the input bytes unchanged when Ghostscript is unavailable", async () => {
    const input = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    const out = await convertPdfToCmyk(input, { hasGhostscript: false });
    assert.equal(out, input); // same reference — no copy, no conversion
  });
});
