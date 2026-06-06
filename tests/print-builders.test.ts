import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";

import { buildSvg } from "../lib/print/svg-builder";
import { buildPdf } from "../lib/print/pdf-builder";
import type { ResolvedImageLayer, ResolvedTextLayer } from "../lib/print/resolve";

function textLayer(over: Partial<ResolvedTextLayer> = {}): ResolvedTextLayer {
  return {
    kind: "text",
    id: "t1",
    content: "Forged",
    fontFamily: "Fraunces",
    fontWeight: 600,
    fontSize: 48,
    color: "#000000",
    transform: { x: 10, y: 20, width: 300, height: 80, rotation: 0 },
    ...over,
  };
}

function imageLayer(over: Partial<ResolvedImageLayer> = {}): ResolvedImageLayer {
  return {
    kind: "image",
    id: "i1",
    source: "https://example.test/a.png",
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "image/png",
    transform: { x: 0, y: 0, width: 100, height: 100, rotation: 0 },
    ...over,
  };
}

describe("buildSvg", () => {
  it("sizes the document in mm and the viewBox in canvas px", () => {
    const svg = buildSvg([], { widthMm: 90, heightMm: 80 });
    assert.match(svg, /width="90mm"/);
    assert.match(svg, /height="80mm"/);
    assert.match(svg, /viewBox="0 0 360 320"/); // default 4 px/mm
  });

  it("emits text as an engrave-fill <text> element", () => {
    const svg = buildSvg([textLayer()], { widthMm: 90, heightMm: 80 });
    assert.match(svg, /<text /);
    assert.match(svg, /fill="#000000"/);
    assert.match(svg, /font-family="Fraunces"/);
  });

  it("escapes XML metacharacters in text content", () => {
    const svg = buildSvg([textLayer({ content: "A & B < C > D" })], {
      widthMm: 90,
      heightMm: 80,
    });
    assert.match(svg, /A &amp; B &lt; C &gt; D/);
  });

  it("escapes a quote in font-family so it can't break out of the attribute", () => {
    const svg = buildSvg([textLayer({ fontFamily: 'Ev"il' })], {
      widthMm: 90,
      heightMm: 80,
    });
    assert.match(svg, /font-family="Ev&quot;il"/);
    assert.doesNotMatch(svg, /font-family="Ev"il"/);
  });

  it("embeds an image layer as a base64 data URI", () => {
    const svg = buildSvg([imageLayer()], { widthMm: 90, heightMm: 80 });
    assert.match(svg, /href="data:image\/png;base64,AQID"/);
  });

  it("uses a translate-only transform when rotation is 0", () => {
    const svg = buildSvg([textLayer({ transform: { x: 5, y: 6, width: 10, height: 10, rotation: 0 } })], {
      widthMm: 90,
      heightMm: 80,
    });
    assert.match(svg, /transform="translate\(5 6\)"/);
    assert.doesNotMatch(svg, /rotate\(/);
  });

  it("adds a rotate() when the layer is rotated", () => {
    const svg = buildSvg([textLayer({ transform: { x: 5, y: 6, width: 10, height: 10, rotation: 45 } })], {
      widthMm: 90,
      heightMm: 80,
    });
    assert.match(svg, /rotate\(45 /);
  });
});

// A real 1×1 transparent PNG — the smallest valid input the embed branch accepts.
const PNG_1X1 = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC",
    "base64",
  ),
);

describe("buildPdf", () => {
  it("produces bytes with a PDF header", async () => {
    const bytes = await buildPdf([textLayer()], { widthMm: 90, heightMm: 80 });
    const header = Buffer.from(bytes.slice(0, 5)).toString("latin1");
    assert.equal(header, "%PDF-");
  });

  it("creates a single page sized to print area plus bleed on every side", async () => {
    const bytes = await buildPdf([textLayer()], { widthMm: 90, heightMm: 80, bleedMm: 3 });

    const reloaded = await PDFDocument.load(bytes);
    assert.equal(reloaded.getPageCount(), 1);

    const page = reloaded.getPage(0);
    const MM_TO_PT = 2.83465;
    const expectedW = (90 + 2 * 3) * MM_TO_PT;
    const expectedH = (80 + 2 * 3) * MM_TO_PT;
    assert.ok(Math.abs(page.getWidth() - expectedW) < 0.5);
    assert.ok(Math.abs(page.getHeight() - expectedH) < 0.5);
  });

  it("embeds a PNG image layer into a loadable PDF", async () => {
    const bytes = await buildPdf([imageLayer({ bytes: PNG_1X1 })], {
      widthMm: 90,
      heightMm: 80,
    });
    const reloaded = await PDFDocument.load(bytes);
    assert.equal(reloaded.getPageCount(), 1);
  });
});
