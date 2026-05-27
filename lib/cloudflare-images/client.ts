/*
 * Cloudflare Images direct-upload helper.
 *
 * Flow: server requests a one-time upload URL from CF using the API token,
 * passes it to the browser, browser POSTs the file bytes directly to CF
 * (so the file never round-trips through Next), browser then calls a
 * confirmation server action that writes the resulting image id into
 * product_images.
 *
 * https://developers.cloudflare.com/images/upload-images/direct-creator-upload/
 *
 * Env required at call-time (never at module load):
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_IMAGES_API_TOKEN
 *   CLOUDFLARE_IMAGES_DELIVERY_DOMAIN  (e.g. imagedelivery.net/<account_hash>)
 */

export type DirectUploadResult = {
  uploadURL: string;
  id: string;
};

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} not set. Configure Cloudflare Images in .env.local before uploading.`,
    );
  }
  return v;
}

export async function requestDirectUpload(opts: {
  /** Custom metadata stored alongside the image — visible in the CF dashboard. */
  metadata?: Record<string, string>;
  /** Default `false`. When true the image isn't publicly accessible until
   *  it's referenced by a signed URL. */
  requireSignedURLs?: boolean;
}): Promise<DirectUploadResult> {
  const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
  const token = getEnv("CLOUDFLARE_IMAGES_API_TOKEN");

  const body = new FormData();
  if (opts.metadata) {
    body.append("metadata", JSON.stringify(opts.metadata));
  }
  if (opts.requireSignedURLs) {
    body.append("requireSignedURLs", "true");
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v2/direct_upload`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body,
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare Images direct_upload failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    success: boolean;
    result?: { uploadURL: string; id: string };
    errors?: Array<{ message: string }>;
  };
  if (!json.success || !json.result) {
    const msg = json.errors?.map((e) => e.message).join("; ") ?? "unknown error";
    throw new Error(`Cloudflare Images direct_upload error: ${msg}`);
  }
  return { uploadURL: json.result.uploadURL, id: json.result.id };
}

export async function deleteImage(imageId: string): Promise<void> {
  const accountId = getEnv("CLOUDFLARE_ACCOUNT_ID");
  const token = getEnv("CLOUDFLARE_IMAGES_API_TOKEN");
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${imageId}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    },
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Cloudflare Images delete failed (${res.status}): ${text}`);
  }
}

/** Build a delivery URL. `variant` should match a variant defined in the CF
 *  Images dashboard (default: 'public'). */
export function imageUrl(imageId: string, variant = "public"): string {
  const domain = process.env.CLOUDFLARE_IMAGES_DELIVERY_DOMAIN;
  if (!domain) {
    // Fall back to a known-broken URL rather than crashing the page during
    // dev when the env isn't set — keeps the placeholder rendering on
    // PDP/catalog while CF is being configured.
    return `https://imagedelivery.net/unset/${imageId}/${variant}`;
  }
  const clean = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${clean}/${imageId}/${variant}`;
}
