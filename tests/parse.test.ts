import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { designStateSchema, layerSchema } from "../lib/parse";
import {
  createDecorationZoneSchema,
  zoneGeometrySchema,
  zonePrintSpecSchema,
} from "../lib/parse/admin";

const textLayer = {
  kind: "text",
  id: "l1",
  content: "Forged",
  fontFamily: "var(--font-fraunces)",
  fontWeight: 600,
  fontSize: 48,
  color: "#101010",
  transform: { x: 10, y: 20, width: 300, height: 80 },
};

describe("layerSchema", () => {
  it("parses each variant of the discriminated union", () => {
    assert.equal(layerSchema.safeParse(textLayer).success, true);
    assert.equal(
      layerSchema.safeParse({
        kind: "image",
        id: "l2",
        assetId: "asset_1",
        transform: { x: 0, y: 0, width: 100, height: 100 },
      }).success,
      true,
    );
    assert.equal(
      layerSchema.safeParse({
        kind: "ai",
        id: "l3",
        generationId: "gen_1",
        promptPreview: "a dragon",
        transform: { x: 0, y: 0, width: 100, height: 100 },
      }).success,
      true,
    );
  });

  it("defaults transform rotation to 0", () => {
    const parsed = layerSchema.parse(textLayer);
    assert.equal(parsed.transform.rotation, 0);
  });

  it("rejects an unknown layer kind", () => {
    assert.equal(layerSchema.safeParse({ ...textLayer, kind: "sticker" }).success, false);
  });

  it("rejects a non-positive transform width", () => {
    const bad = { ...textLayer, transform: { ...textLayer.transform, width: 0 } };
    assert.equal(layerSchema.safeParse(bad).success, false);
  });
});

describe("designStateSchema", () => {
  it("parses a multi-zone state", () => {
    const result = designStateSchema.safeParse({
      zones: { main: { layers: [textLayer] } },
    });
    assert.equal(result.success, true);
  });

  it("accepts an empty zones map", () => {
    assert.equal(designStateSchema.safeParse({ zones: {} }).success, true);
  });

  it("rejects a zone whose layer is malformed", () => {
    const result = designStateSchema.safeParse({
      zones: { main: { layers: [{ kind: "text", id: "x" }] } },
    });
    assert.equal(result.success, false);
  });
});

describe("zoneGeometrySchema", () => {
  it("parses a rect and defaults rotation to 0", () => {
    const result = zoneGeometrySchema.parse({
      shape: "rect",
      x: 160,
      y: 250,
      width: 400,
      height: 400,
    });
    assert.equal(result.shape, "rect");
    if (result.shape === "rect") assert.equal(result.rotation, 0);
  });

  it("parses a box_mm crystal volume", () => {
    const result = zoneGeometrySchema.safeParse({
      shape: "box_mm",
      widthMm: 80,
      heightMm: 80,
      depthMm: 80,
    });
    assert.equal(result.success, true);
  });

  it("rejects an unknown shape", () => {
    assert.equal(zoneGeometrySchema.safeParse({ shape: "circle", r: 10 }).success, false);
  });

  it("rejects a negative rect coordinate", () => {
    const result = zoneGeometrySchema.safeParse({
      shape: "rect",
      x: -1,
      y: 0,
      width: 10,
      height: 10,
    });
    assert.equal(result.success, false);
  });
});

describe("zonePrintSpecSchema", () => {
  it("applies sRGB and non-vector defaults", () => {
    const spec = zonePrintSpecSchema.parse({ dpi: 300 });
    assert.equal(spec.colorProfile, "sRGB");
    assert.equal(spec.vectorRequired, false);
  });

  it("rejects a dpi above the ceiling", () => {
    assert.equal(zonePrintSpecSchema.safeParse({ dpi: 4800 }).success, false);
  });
});

describe("createDecorationZoneSchema", () => {
  it("parses a full zone payload with an ordering default", () => {
    const parsed = createDecorationZoneSchema.parse({
      productVariantId: "var_1",
      name: "Print area",
      kind: "mixed",
      geometry: { shape: "rect", x: 0, y: 0, width: 100, height: 100 },
      printSpec: { dpi: 300 },
    });
    assert.equal(parsed.ordering, 0);
  });

  it("rejects an empty name", () => {
    const result = createDecorationZoneSchema.safeParse({
      productVariantId: "var_1",
      name: "",
      kind: "mixed",
      geometry: { shape: "rect", x: 0, y: 0, width: 100, height: 100 },
      printSpec: { dpi: 300 },
    });
    assert.equal(result.success, false);
  });
});
