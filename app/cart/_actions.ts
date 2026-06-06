"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import {
  cartItems,
  designDrafts,
  productVariants,
  products,
} from "@/drizzle/schema";
import { getSession } from "@/lib/auth";
import { findCurrentCart, getOrCreateCart } from "@/lib/cart/session";

export async function addDraftToCartAction(formData: FormData): Promise<void> {
  const draftId = formData.get("draftId");
  const quantityRaw = formData.get("quantity");
  if (typeof draftId !== "string" || !draftId) {
    throw new Error("Missing draftId");
  }
  const quantity = Math.max(1, Math.min(99, Number(quantityRaw ?? 1)));

  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;

  const [draft] = await db
    .select()
    .from(designDrafts)
    .where(eq(designDrafts.id, draftId))
    .limit(1);
  if (!draft) throw new Error("Draft not found");
  // Owned drafts may only be added by their owner; guest drafts (null owner)
  // are bearer-claimable by whoever holds the draft id. Report a mismatch as
  // not-found rather than forbidden so we don't confirm the draft exists.
  if (draft.customerId && draft.customerId !== customerId) {
    throw new Error("Draft not found");
  }

  const [variant] = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, draft.productVariantId))
    .limit(1);
  if (!variant) throw new Error("Variant not found");

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, variant.productId))
    .limit(1);
  if (!product) throw new Error("Product not found");

  const cart = await getOrCreateCart(customerId);

  const unitPriceCents = product.basePriceCents + (variant.priceDeltaCents ?? 0);

  await db.insert(cartItems).values({
    id: newId(),
    cartId: cart.id,
    productVariantId: variant.id,
    designDraftId: draft.id,
    quantity,
    unitPriceCents,
  });

  await db
    .update(designDrafts)
    .set({ status: "added_to_cart", updatedAt: new Date() })
    .where(eq(designDrafts.id, draft.id));

  revalidatePath("/cart");
  redirect("/cart");
}

export async function updateCartItemQuantityAction(formData: FormData): Promise<void> {
  const id = formData.get("cartItemId");
  const quantityRaw = formData.get("quantity");
  if (typeof id !== "string") throw new Error("Missing cartItemId");
  const quantity = Math.max(1, Math.min(99, Number(quantityRaw ?? 1)));

  const session = await getSession().catch(() => null);
  const cart = await findCurrentCart(session?.user?.id ?? null);
  if (!cart) return;

  await db
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.id, id), eq(cartItems.cartId, cart.id)));

  revalidatePath("/cart");
}

export async function removeCartItemAction(formData: FormData): Promise<void> {
  const id = formData.get("cartItemId");
  if (typeof id !== "string") throw new Error("Missing cartItemId");

  const session = await getSession().catch(() => null);
  const cart = await findCurrentCart(session?.user?.id ?? null);
  if (!cart) return;

  await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, id), eq(cartItems.cartId, cart.id)));
  revalidatePath("/cart");
}

/** Add the product's first variant as an "as-shown" line — no design draft. */
export async function addProductBuyAsShownAction(formData: FormData): Promise<void> {
  const productId = formData.get("productId");
  if (typeof productId !== "string") throw new Error("Missing productId");

  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) throw new Error("Product not found");

  const [variant] = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId)))
    .limit(1);
  if (!variant) throw new Error("No variants configured");

  const cart = await getOrCreateCart(customerId);
  const unitPriceCents = product.basePriceCents + (variant.priceDeltaCents ?? 0);

  await db.insert(cartItems).values({
    id: newId(),
    cartId: cart.id,
    productVariantId: variant.id,
    designDraftId: null,
    quantity: 1,
    unitPriceCents,
  });

  revalidatePath("/cart");
  redirect("/cart");
}
