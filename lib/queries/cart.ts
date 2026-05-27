/*
 * Cart read helpers. Always per-request: cart contents are tightly bound to
 * the session, not cacheable across requests.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  cartItems,
  designDrafts,
  productVariants,
  products,
  type CartItem,
  type DesignDraft,
  type Product,
  type ProductVariant,
} from "@/drizzle/schema";
import { findCurrentCart } from "@/lib/cart/session";

export type CartLine = {
  item: CartItem;
  product: Product;
  variant: ProductVariant;
  draft: DesignDraft | null;
};

export async function getCurrentCartLines(
  customerId: string | null,
): Promise<{ cartId: string | null; lines: CartLine[]; subtotalCents: number }> {
  const cart = await findCurrentCart(customerId);
  if (!cart) return { cartId: null, lines: [], subtotalCents: 0 };

  const rows = await db
    .select({
      item: cartItems,
      product: products,
      variant: productVariants,
      draft: designDrafts,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.productVariantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(designDrafts, eq(designDrafts.id, cartItems.designDraftId))
    .where(eq(cartItems.cartId, cart.id));

  const lines: CartLine[] = rows.map((r) => ({
    item: r.item,
    product: r.product,
    variant: r.variant,
    draft: r.draft,
  }));

  const subtotalCents = lines.reduce(
    (sum, l) => sum + l.item.unitPriceCents * l.item.quantity,
    0,
  );

  return { cartId: cart.id, lines, subtotalCents };
}
