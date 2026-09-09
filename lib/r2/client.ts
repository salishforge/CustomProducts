/*
 * Cloudflare R2 storage.
 *
 * R2 speaks the S3 API, so this wraps @aws-sdk/client-s3 rather than a
 * bespoke HTTP client. The interface is deliberately narrow — seven functions
 * over object keys — because callers should never need to know about buckets,
 * regions, credentials, command objects, or streams. Everything above this
 * module (uploads, the print pipeline, AI ingestion, the asset route) speaks
 * only in keys from ./keys.
 *
 * Credentials are read at call time, never at module load. Next builds this
 * file into route bundles, and a module-load throw would break `next build`
 * on a machine where R2 is not yet configured. Same reasoning as
 * lib/stripe/client.ts and lib/cloudflare-images/client.ts.
 *
 * The two presign functions exist so bytes can move between the browser and
 * R2 without crossing Vercel: a Vercel request body is capped near 4.5MB
 * while the upload schema admits 25MB, so a presigned PUT is the only way the
 * documented limit is reachable at all. presignPut pins content-type and
 * content-length into the signature, so a browser cannot upload a different
 * type or size than the one the server rate-limited and approved.
 */

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

declare global {
  var __sf_r2__: S3Client | undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not set. Configure R2 in .env.local — see OPS.md.`);
  }
  return value;
}

function bucket(): string {
  return requireEnv("R2_BUCKET");
}

function client(): S3Client {
  if (!globalThis.__sf_r2__) {
    const accountId = requireEnv("R2_ACCOUNT_ID");
    globalThis.__sf_r2__ = new S3Client({
      // R2 has no regions; the SDK requires the field, and 'auto' is what
      // Cloudflare's own S3-compatibility documentation specifies.
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return globalThis.__sf_r2__;
}

export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  );
}

export async function getObject(
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await client().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  if (!res.Body) {
    throw new Error(`R2 returned no body for ${key}`);
  }
  return {
    bytes: await res.Body.transformToByteArray(),
    contentType: res.ContentType ?? "application/octet-stream",
  };
}

/** Null when the object does not exist — the one expected not-found outcome
 *  in this module, so it is a return value rather than an exception. */
export async function headObject(
  key: string,
): Promise<{ byteSize: number; contentType: string } | null> {
  try {
    const res = await client().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return {
      byteSize: res.ContentLength ?? 0,
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch (err) {
    if (err instanceof NotFound) return null;
    throw err;
  }
}

/** Server-side copy — the bytes stay inside R2. Used to promote a verified
 *  upload out of the incoming/ quarantine. */
export async function copyObject(from: string, to: string): Promise<void> {
  const b = bucket();
  await client().send(
    new CopyObjectCommand({
      Bucket: b,
      Key: to,
      CopySource: `${b}/${from}`,
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
}

export async function presignPut(
  key: string,
  opts: { contentType: string; byteSize: number; expiresIn: number },
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: opts.contentType,
      ContentLength: opts.byteSize,
    }),
    {
      expiresIn: opts.expiresIn,
      // Without these the headers are advisory and a client may send anything.
      // Signed, they are part of the request the signature covers, so a
      // mismatched upload is rejected by R2 rather than by us afterwards.
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );
}

export async function presignGet(
  key: string,
  opts: { expiresIn: number; downloadFilename?: string },
): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: opts.downloadFilename
        ? `attachment; filename="${opts.downloadFilename}"`
        : undefined,
    }),
    { expiresIn: opts.expiresIn },
  );
}
