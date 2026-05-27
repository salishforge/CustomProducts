"use server";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { stripeClient } from "@/lib/stripe/client";
import { getCurrentCartLines } from "@/lib/queries/cart";

/*
 * Create a Stripe Checkout Session from the current cart and redirect there.
 * Stripe-hosted Checkout keeps PCI scope small and ships Apple/Google Pay
 * for free. We pass cartId in metadata so the webhook can correlate.
 *
 * Fails clearly when STRIPE_SECRET_KEY isn't set — surfaces as a coarse
 * error caught by app/error.tsx.
 */

export async function createCheckoutSessionAction(): Promise<void> {
  const session = await getSession().catch(() => null);
  const customerId = session?.user?.id ?? null;

  const { cartId, lines } = await getCurrentCartLines(customerId);
  if (!cartId || lines.length === 0) {
    redirect("/cart");
  }

  const stripe = stripeClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lines.map((line) => ({
      quantity: line.item.quantity,
      price_data: {
        currency: "usd",
        unit_amount: line.item.unitPriceCents,
        product_data: {
          name: line.product.name,
          description: line.variant.name + (line.draft ? " · custom design" : " · as shown"),
          metadata: {
            productId: line.product.id,
            variantId: line.variant.id,
            cartItemId: line.item.id,
            ...(line.draft ? { designDraftId: line.draft.id } : {}),
          },
        },
      },
    })),
    payment_method_types: ["card"],
    automatic_tax: { enabled: false }, // Stripe Tax wires up with a verified domain
    shipping_address_collection: {
      allowed_countries: ["US", "CA"],
    },
    metadata: {
      cartId,
      ...(customerId ? { customerId } : {}),
    },
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/cart`,
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  redirect(checkoutSession.url);
}
