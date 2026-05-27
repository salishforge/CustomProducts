"use server";

import { and, asc, eq, max } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { productImages, products } from "@/drizzle/schema";
import { AdminValidationError } from "@/lib/admin/errors";
import {
  deleteImage as deleteCfImage,
  requestDirectUpload,
} from "@/lib/cloudflare-images/client";

const VALID_KINDS = [
  "hero",
  "gallery",
  "mockup_base",
  "swatch",
  "process",
  "macro",
] as const;

export type RequestImageUploadResult = {
  uploadURL: string;
  cfImageId: string;
};

export async function requestImageUploadAction(
  productId: string,
  kind: (typeof VALID_KINDS)[number],
): Promise<RequestImageUploadResult> {
  await requireAdmin();
  if (typeof productId !== "string" || !productId) {
    throw new AdminValidationError({ productId: ["Missing product id"] });
  }
  if (!VALID_KINDS.includes(kind)) {
    throw new AdminValidationError({ kind: ["Invalid image kind"] });
  }

  const { uploadURL, id } = await requestDirectUpload({
    metadata: { productId, kind },
  });
  return { uploadURL, cfImageId: id };
}

export async function attachImageAction(input: {
  productId: string;
  cfImageId: string;
  kind: (typeof VALID_KINDS)[number];
  altText?: string;
  setAsHero?: boolean;
}): Promise<void> {
  await requireAdmin();
  if (!input.productId || !input.cfImageId) {
    throw new AdminValidationError({
      productId: input.productId ? [] : ["Missing"],
      cfImageId: input.cfImageId ? [] : ["Missing"],
    });
  }

  const id = newId();

  // Compute next ordering as max(existing)+1 so newly attached images sort to
  // the end of the gallery by default.
  const maxRows = await db
    .select({ value: max(productImages.ordering) })
    .from(productImages)
    .where(eq(productImages.productId, input.productId));
  const nextOrdering = (maxRows[0]?.value ?? -1) + 1;

  await db.insert(productImages).values({
    id,
    productId: input.productId,
    cloudflareImageId: input.cfImageId,
    altText: input.altText ?? null,
    kind: input.kind,
    ordering: nextOrdering,
  });

  if (input.setAsHero) {
    await db
      .update(products)
      .set({ heroImageId: id, updatedAt: new Date() })
      .where(eq(products.id, input.productId));
  }

  revalidateTag("products");
  revalidatePath(`/admin/products/${input.productId}/images`);
  revalidatePath(`/admin/products/${input.productId}`);
}

export async function setHeroImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const productId = formData.get("productId");
  const imageId = formData.get("imageId");
  if (typeof productId !== "string" || typeof imageId !== "string") {
    throw new AdminValidationError({ form: ["Missing fields"] });
  }
  await db
    .update(products)
    .set({ heroImageId: imageId, updatedAt: new Date() })
    .where(eq(products.id, productId));
  revalidateTag("products");
  revalidatePath(`/admin/products/${productId}/images`);
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const productId = formData.get("productId");
  const imageId = formData.get("imageId");
  if (typeof productId !== "string" || typeof imageId !== "string") {
    throw new AdminValidationError({ form: ["Missing fields"] });
  }

  const [row] = await db
    .select()
    .from(productImages)
    .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
    .limit(1);
  if (!row) return;

  // Best-effort CF delete; tolerate failures (image may have already been
  // removed in the CF dashboard).
  try {
    await deleteCfImage(row.cloudflareImageId);
  } catch (err) {
    console.warn("[images] CF delete failed (non-fatal):", err);
  }

  await db.delete(productImages).where(eq(productImages.id, imageId));

  // If this was the hero image, clear the pointer.
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (product?.heroImageId === imageId) {
    await db
      .update(products)
      .set({ heroImageId: null, updatedAt: new Date() })
      .where(eq(products.id, productId));
  }

  revalidateTag("products");
  revalidatePath(`/admin/products/${productId}/images`);
}

export async function listProductImagesAction(productId: string) {
  await requireAdmin();
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.ordering));
}
