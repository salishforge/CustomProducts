/*
 * Presigning is local SigV4 — no network — so these run against dummy
 * credentials and still exercise the real signer. What they protect is the
 * part that is easy to get silently wrong: the signed-header set. If
 * content-length stops being signed, an approved 2MB upload can quietly
 * become a 2GB one, and nothing else in the system would notice.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

import { aiKey, extForMime, incomingKey, printKey, uploadKey } from "../lib/r2/keys";
import {
  completeUploadRequestSchema,
  presignUploadRequestSchema,
} from "../lib/parse";
import { presignGet, presignPut } from "../lib/r2/client";

describe("r2 keys", () => {
  it("quarantines an unverified upload under incoming/", () => {
    assert.equal(incomingKey("abc123"), "incoming/abc123");
  });

  it("addresses a promoted upload by asset id and extension", () => {
    assert.equal(uploadKey("abc123", "png"), "uploads/abc123.png");
  });

  it("addresses a generation output as webp", () => {
    assert.equal(aiKey("gen777"), "ai/gen777.webp");
  });

  it("nests a print file under its order and item", () => {
    assert.equal(
      printKey("ord1", "item2", "SF-MUG-11-uv.pdf"),
      "print/ord1/item2/SF-MUG-11-uv.pdf",
    );
  });
});

describe("presignPut", () => {
  before(() => {
    process.env.R2_ACCOUNT_ID = "testaccount";
    process.env.R2_ACCESS_KEY_ID = "testkey";
    process.env.R2_SECRET_ACCESS_KEY = "testsecret";
    process.env.R2_BUCKET = "salishforge-test";
  });

  // The SDK addresses R2 virtual-hosted style (bucket as a host label), which
  // is what Cloudflare serves; no forcePathStyle is set.
  it("signs against the account's R2 endpoint and bucket", async () => {
    const url = new URL(
      await presignPut("incoming/a1", {
        contentType: "image/png",
        byteSize: 1024,
        expiresIn: 300,
      }),
    );

    assert.equal(
      url.host,
      "salishforge-test.testaccount.r2.cloudflarestorage.com",
    );
    assert.equal(url.pathname, "/incoming/a1");
    assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  });

  it("covers content-type and content-length with the signature", async () => {
    const url = new URL(
      await presignPut("incoming/a1", {
        contentType: "image/png",
        byteSize: 1024,
        expiresIn: 300,
      }),
    );

    const signed = (url.searchParams.get("X-Amz-SignedHeaders") ?? "").split(";");

    assert.ok(signed.includes("content-type"), "content-type must be signed");
    assert.ok(signed.includes("content-length"), "content-length must be signed");
  });

  it("reports which variable is missing rather than failing at the API", async () => {
    const saved = process.env.R2_BUCKET;
    delete process.env.R2_BUCKET;

    await assert.rejects(
      () =>
        presignPut("incoming/a1", {
          contentType: "image/png",
          byteSize: 1,
          expiresIn: 60,
        }),
      /R2_BUCKET not set/,
    );

    process.env.R2_BUCKET = saved;
  });
});

describe("presignGet", () => {
  before(() => {
    process.env.R2_ACCOUNT_ID = "testaccount";
    process.env.R2_ACCESS_KEY_ID = "testkey";
    process.env.R2_SECRET_ACCESS_KEY = "testsecret";
    process.env.R2_BUCKET = "salishforge-test";
  });

  it("asks R2 to serve a named download when a filename is given", async () => {
    const url = new URL(
      await presignGet("print/ord1/item2/plate.pdf", {
        expiresIn: 300,
        downloadFilename: "plate.pdf",
      }),
    );

    assert.equal(
      url.searchParams.get("response-content-disposition"),
      'attachment; filename="plate.pdf"',
    );
  });

  it("serves inline when no filename is given", async () => {
    const url = new URL(
      await presignGet("uploads/a1.png", { expiresIn: 3600 }),
    );

    assert.equal(url.searchParams.get("response-content-disposition"), null);
  });
});

describe("extForMime", () => {
  it("maps every type the upload schema admits", () => {
    assert.equal(extForMime("image/png"), "png");
    assert.equal(extForMime("image/jpeg"), "jpg");
    assert.equal(extForMime("image/webp"), "webp");
    assert.equal(extForMime("image/avif"), "avif");
  });

  it("is case-insensitive, since the type comes back off an R2 object", () => {
    assert.equal(extForMime("IMAGE/PNG"), "png");
  });
});

describe("presignUploadRequestSchema", () => {
  const valid = {
    filename: "photo.png",
    mimeType: "image/png",
    byteSize: 2048,
    contentHash: "a".repeat(64),
  };

  it("accepts a raster upload inside the size cap", () => {
    assert.equal(presignUploadRequestSchema.safeParse(valid).success, true);
  });

  it("rejects SVG, which has no tested path through the print pipeline", () => {
    const result = presignUploadRequestSchema.safeParse({
      ...valid,
      mimeType: "image/svg+xml",
    });

    assert.equal(result.success, false);
  });

  it("rejects a file over 25MB", () => {
    const result = presignUploadRequestSchema.safeParse({
      ...valid,
      byteSize: 26 * 1024 * 1024,
    });

    assert.equal(result.success, false);
  });

  it("rejects a hash that is not 64 hex characters", () => {
    const result = presignUploadRequestSchema.safeParse({
      ...valid,
      contentHash: "not-a-hash",
    });

    assert.equal(result.success, false);
  });
});

describe("completeUploadRequestSchema", () => {
  it("takes the asset id, filename and hash", () => {
    const result = completeUploadRequestSchema.safeParse({
      assetId: "abc123",
      filename: "photo.png",
      contentHash: "b".repeat(64),
    });

    assert.equal(result.success, true);
  });

  it("does not require a mime type — the server reads it back from R2", () => {
    const result = completeUploadRequestSchema.safeParse({
      assetId: "abc123",
      filename: "photo.png",
      contentHash: "b".repeat(64),
      mimeType: "image/png",
    });

    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal("mimeType" in result.data, false);
  });
});
