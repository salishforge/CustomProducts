/*
 * Cart session resolver.
 *
 * Authed customers: cart is owned by customers.id (1:1 with the open cart).
 * Guests: a random session_token in an HttpOnly cookie identifies the cart.
 * The token is created lazily on the first cart mutation.
 */

import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import { carts, type Cart } from "@/drizzle/schema";

const CART_COOKIE = "sf_cart";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function getOrCreateCart(customerId: string | null): Promise<Cart> {
  if (customerId) {
    const [existing] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.customerId, customerId), eq(carts.status, "open")))
      .limit(1);
    if (existing) return existing;
    const id = newId();
    await db.insert(carts).values({
      id,
      customerId,
      sessionToken: null,
      status: "open",
    });
    const [fresh] = await db.select().from(carts).where(eq(carts.id, id)).limit(1);
    if (!fresh) throw new Error("cart not found after insert");
    return fresh;
  }

  const jar = await cookies();
  let token = jar.get(CART_COOKIE)?.value;

  if (token) {
    const [existing] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.sessionToken, token), eq(carts.status, "open")))
      .limit(1);
    if (existing) return existing;
    // Cookie pointed at a now-converted/abandoned cart — fall through to
    // create a fresh one and update the cookie.
    token = undefined;
  }

  const fresh = newId();
  if (!token) {
    token = `g_${newId()}`;
    jar.set(CART_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }
  await db.insert(carts).values({
    id: fresh,
    customerId: null,
    sessionToken: token,
    status: "open",
  });
  const [row] = await db.select().from(carts).where(eq(carts.id, fresh)).limit(1);
  if (!row) throw new Error("cart not found after insert");
  return row;
}

export async function findCurrentCart(customerId: string | null): Promise<Cart | null> {
  if (customerId) {
    const [existing] = await db
      .select()
      .from(carts)
      .where(and(eq(carts.customerId, customerId), eq(carts.status, "open")))
      .limit(1);
    return existing ?? null;
  }
  const jar = await cookies();
  const token = jar.get(CART_COOKIE)?.value;
  if (!token) return null;
  const [existing] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.sessionToken, token), eq(carts.status, "open")))
    .limit(1);
  return existing ?? null;
}

/** Mark the cart converted (post-checkout) so a fresh cart is created next. */
export async function markCartConverted(cartId: string): Promise<void> {
  await db
    .update(carts)
    .set({ status: "converted", updatedAt: new Date() })
    .where(eq(carts.id, cartId));
}
