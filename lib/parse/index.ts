/*
 * Boundary parsers — every external payload passes through one of these.
 *
 * The doctrine: "parse, don't validate." Internal functions trust their inputs
 * because the type system already excluded the bad cases. The frontier where
 * untrusted data becomes trusted data is HERE, in this file.
 *
 * Add a new schema when you add a new external boundary. Do not silently
 * narrow types with `as` elsewhere.
 */

import { z } from "zod";

// -----------------------------------------------------------------------------
// AI generation
// -----------------------------------------------------------------------------

/** Server-Action input from the customizer. */
export const generationRequestSchema = z.object({
  prompt: z.string().min(1).max(500),
  productVariantId: z.string().min(1),
  zoneId: z.string().min(1),
  aspectRatio: z
    .enum(["1:1", "4:5", "3:4", "16:9", "9:16", "2:3", "3:2"])
    .default("1:1"),
  /** Replicate model selector — server validates against an allow-list. */
  model: z
    .enum(["flux-schnell", "flux-dev", "flux-1.1-pro", "flux-redux-dev"])
    .default("flux-schnell"),
  /** Reference image asset ids (max 3). The server resolves these to R2 keys
   *  and uploads to Replicate Files. */
  referenceAssetIds: z.array(z.string().min(1)).max(3).default([]),
  /** Reference weight 0–100. 60 is the UX default. */
  referenceWeight: z.number().int().min(0).max(100).default(60),
  /** Style preset chip (optional). */
  stylePreset: z
    .enum([
      "ink-line",
      "watercolor",
      "vintage-tattoo",
      "geometric",
      "photographic",
      "engraved-line-art",
    ])
    .optional(),
  /** Optional explicit seed — for "try variation" iteration. */
  seed: z.number().int().nonnegative().optional(),
});

export type GenerationRequest = z.infer<typeof generationRequestSchema>;

// -----------------------------------------------------------------------------
// Stripe webhook envelope
//
// Stripe's signature verification happens before parsing. This schema captures
// only the fields we actually consume from the event payload — Stripe's full
// TS types come from their SDK; we narrow to what we use.
// -----------------------------------------------------------------------------

export const stripeEventEnvelopeSchema = z.object({
  id: z.string(),
  type: z.string(),
  created: z.number(),
  livemode: z.boolean(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

export type StripeEventEnvelope = z.infer<typeof stripeEventEnvelopeSchema>;

// -----------------------------------------------------------------------------
// Replicate webhook payload (prediction completion)
// -----------------------------------------------------------------------------

export const replicatePredictionWebhookSchema = z.object({
  id: z.string(),
  version: z.string().optional(),
  status: z.enum(["starting", "processing", "succeeded", "failed", "canceled"]),
  /** Output may be a single URL or an array — model-dependent. We accept both. */
  output: z.union([z.string().url(), z.array(z.string().url()), z.null()]),
  error: z.string().nullable().optional(),
  /** Replicate provides this on completion (microseconds CPU/GPU). We map
   *  it to USD via the model's pricing. */
  metrics: z
    .object({
      predict_time: z.number().optional(),
    })
    .optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});

export type ReplicatePredictionWebhook = z.infer<
  typeof replicatePredictionWebhookSchema
>;

// -----------------------------------------------------------------------------
// R2 upload metadata (returned by the presigned-URL endpoint)
// -----------------------------------------------------------------------------

export const presignUploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  // Raster only. SVG was listed here before anything read this schema, but a
  // user-supplied vector has no tested route through the print pipeline (the
  // PDF builder embeds raster bytes) and rasterizing untrusted SVG is its own
  // decision. Add it back alongside a print path that handles it.
  mimeType: z
    .string()
    .regex(/^image\/(png|jpe?g|webp|avif)$/i, "Unsupported mime type"),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(25 * 1024 * 1024, "Max 25MB"),
  /** Hex sha256 of the bytes, computed in browser before request. The server
   *  recomputes it from the stored object and rejects a mismatch, so this is
   *  an integrity check on the transfer, not a trusted input. */
  contentHash: z.string().length(64).regex(/^[0-9a-f]+$/i),
  kind: z.enum(["upload", "reference"]).default("upload"),
});

export type PresignUploadRequest = z.infer<typeof presignUploadRequestSchema>;

/** Second leg of the upload: the browser has PUT the bytes to the quarantine
 *  prefix and asks the server to verify and promote them. mimeType is absent
 *  deliberately — the server reads it back from R2, where it is part of what
 *  the presigned PUT signature covered. */
export const completeUploadRequestSchema = z.object({
  assetId: z.string().min(1).max(64),
  filename: z.string().min(1).max(255),
  contentHash: z.string().length(64).regex(/^[0-9a-f]+$/i),
});

export type CompleteUploadRequest = z.infer<typeof completeUploadRequestSchema>;

// -----------------------------------------------------------------------------
// Cart mutations
// -----------------------------------------------------------------------------

export const addToCartSchema = z.object({
  designDraftId: z.string().min(1),
  quantity: z.number().int().positive().max(99).default(1),
});

export type AddToCart = z.infer<typeof addToCartSchema>;

export const updateCartItemSchema = z.object({
  cartItemId: z.string().min(1),
  quantity: z.number().int().positive().max(99),
});

// -----------------------------------------------------------------------------
// Design draft
// -----------------------------------------------------------------------------

/** Per-layer geometry — pixel coordinates in the canonical canvas frame
 *  (decoration zone coordinates, not screen coordinates). */
const transformSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
});

const textLayerSchema = z.object({
  kind: z.literal("text"),
  id: z.string(),
  content: z.string().max(500),
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(900),
  fontSize: z.number().positive(),
  color: z.string(),
  transform: transformSchema,
});

const imageLayerSchema = z.object({
  kind: z.literal("image"),
  id: z.string(),
  assetId: z.string(),
  transform: transformSchema,
});

const aiLayerSchema = z.object({
  kind: z.literal("ai"),
  id: z.string(),
  generationId: z.string(),
  promptPreview: z.string().max(500),
  transform: transformSchema,
});

export const layerSchema = z.discriminatedUnion("kind", [
  textLayerSchema,
  imageLayerSchema,
  aiLayerSchema,
]);

export type Layer = z.infer<typeof layerSchema>;

export const designStateSchema = z.object({
  zones: z.record(
    z.string(),
    z.object({
      layers: z.array(layerSchema),
    }),
  ),
});

export type DesignState = z.infer<typeof designStateSchema>;

export const saveDesignDraftSchema = z.object({
  productVariantId: z.string().min(1),
  name: z.string().max(120).optional(),
  designState: designStateSchema,
});

// -----------------------------------------------------------------------------
// Inngest event payloads (the contract between server actions and functions)
// -----------------------------------------------------------------------------

export const aiGenerationRequestedEventSchema = z.object({
  generationId: z.string(),
});

export const orderPaidEventSchema = z.object({
  orderId: z.string(),
});

export const printFilesNeededEventSchema = z.object({
  orderId: z.string(),
  orderItemId: z.string(),
});
