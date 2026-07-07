import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { validateWebhook } from "replicate";

import {
  buildModelInput,
  modelCostCents,
  modelSlug,
  type GenerationModel,
} from "../lib/replicate/client";

const MODELS: GenerationModel[] = [
  "flux-schnell",
  "flux-dev",
  "flux-1.1-pro",
  "flux-redux-dev",
];

describe("modelSlug", () => {
  it("maps every allow-listed selector to a black-forest-labs slug", () => {
    for (const model of MODELS) {
      assert.match(modelSlug(model), /^black-forest-labs\/.+/);
    }
  });
});

describe("modelCostCents", () => {
  it("prices every model as a positive integer for the cost ceiling", () => {
    for (const model of MODELS) {
      const cents = modelCostCents(model);
      assert.ok(Number.isInteger(cents) && cents > 0, `${model} → ${cents}`);
    }
  });
});

describe("buildModelInput", () => {
  const t2iBase = {
    model: "flux-schnell" as GenerationModel,
    prompt: "a red dragon",
    aspectRatio: "1:1",
    seed: null,
    referenceImageUrls: [],
  };

  it("sends prompt and aspect_ratio for text-to-image models", () => {
    const input = buildModelInput(t2iBase);

    assert.equal(input.prompt, "a red dragon");
    assert.equal(input.aspect_ratio, "1:1");
  });

  it("omits seed when none was requested", () => {
    const input = buildModelInput(t2iBase);

    assert.ok(!("seed" in input));
  });

  it("includes seed when one was requested", () => {
    const input = buildModelInput({ ...t2iBase, seed: 42 });

    assert.equal(input.seed, 42);
  });

  it("passes the first reference as redux_image and drops the prompt for redux", () => {
    const input = buildModelInput({
      ...t2iBase,
      model: "flux-redux-dev",
      referenceImageUrls: ["https://cdn.example/a.webp", "https://cdn.example/b.webp"],
    });

    assert.equal(input.redux_image, "https://cdn.example/a.webp");
    assert.ok(!("prompt" in input));
  });

  it("throws when redux is selected without a reference image", () => {
    assert.throws(
      () => buildModelInput({ ...t2iBase, model: "flux-redux-dev" }),
      /requires a reference image/,
    );
  });
});

// Signs a body the way Replicate's svix scheme does, so we can assert the SDK
// verifier our route delegates to accepts a correct signature and rejects a
// tampered payload. No mocks — real HMAC, real SDK function.
function signWebhook(
  secretB64: string,
  id: string,
  timestamp: string,
  body: string,
): string {
  const key = Buffer.from(secretB64, "base64");
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return `v1,${signature}`;
}

describe("Replicate webhook signature scheme", () => {
  const secretB64 = Buffer.from("salishforge-webhook-secret-vector").toString(
    "base64",
  );
  const secret = `whsec_${secretB64}`;
  const id = "msg_2abc";
  const timestamp = "1720000000";
  const body = JSON.stringify({ id: "pred_1", status: "succeeded" });

  it("accepts a correctly signed payload", async () => {
    const signature = signWebhook(secretB64, id, timestamp, body);

    const ok = await validateWebhook({ id, timestamp, signature, body, secret });

    assert.equal(ok, true);
  });

  it("rejects a payload whose body was tampered with after signing", async () => {
    const signature = signWebhook(secretB64, id, timestamp, body);

    const ok = await validateWebhook({
      id,
      timestamp,
      signature,
      body: `${body} `,
      secret,
    });

    assert.equal(ok, false);
  });
});
