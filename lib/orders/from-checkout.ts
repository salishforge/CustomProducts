/*
 * Converts a Stripe checkout.session.completed event into a paid order row +
 * order_items with full snapshots. Called from the Stripe webhook handler.
 *
 * Idempotency: order rows are uniqued on stripe_payment_intent_id, so a
 * duplicated webhook delivery becomes a no-op via ON CONFLICT.
 *
 * Snapshotting: copies product, variant, and design_draft state into the
 * order_item rows so the rest of the system can't drift them.
 */

import type Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import {
  cartItems,
  carts,
  customers,
  designDrafts,
  orderItems,
  orders,
  productVariants,
  products,
} from "@/drizzle/schema";
import { inngest } from "@/inngest/client";

async function nextOrderNumber(): Promise<string> {
  const yr = new Date().getFullYear();
  const rows = await db.execute<{ count: number }>(
    sql`SELECT count(*)::int as count FROM orders WHERE order_number LIKE ${"SF-" + yr + "-%"}`,
  );
  const seq = (rows[0]?.count ?? 0) + 1;
  return `SF-${yr}-${String(seq).padStart(4, "0")}`;
}

async function ensureCustomer(email: string, displayName: string | null): Promise<string> {
  const [existing] = await db
    .select()
    .from(customers)
    .where(eq(customers.email, email))
    .limit(1);
  if (existing) return existing.id;
  const id = newId();
  await db.insert(customers).values({
    id,
    email,
    displayName,
  });
  return id;
}

export async function createOrderFromCheckoutSession(
  cs: Stripe.Checkout.Session,
): Promise<string | null> {
  const cartId = cs.metadata?.cartId;
  if (!cartId) return null;

  // Hydrate cart contents.
  const lines = await db
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
    .where(eq(cartItems.cartId, cartId));

  if (lines.length === 0) return null;

  const email = cs.customer_details?.email ?? cs.customer_email ?? null;
  const displayName = cs.customer_details?.name ?? null;
  if (!email) {
    console.warn("[orders] checkout session has no customer email", cs.id);
    return null;
  }

  const customerId = await ensureCustomer(email, displayName);

  const orderNumber = await nextOrderNumber();
  const orderId = newId();
  const subtotalCents = cs.amount_subtotal ?? 0;
  const taxCents = cs.total_details?.amount_tax ?? 0;
  const shippingCents = cs.total_details?.amount_shipping ?? 0;
  const totalCents = cs.amount_total ?? subtotalCents + taxCents + shippingCents;

  const shippingAddress = cs.shipping_details?.address
    ? {
        name: cs.shipping_details.name,
        line1: cs.shipping_details.address.line1,
        line2: cs.shipping_details.address.line2,
        city: cs.shipping_details.address.city,
        region: cs.shipping_details.address.state,
        postalCode: cs.shipping_details.address.postal_code,
        country: cs.shipping_details.address.country,
      }
    : null;

  // Use ON CONFLICT DO NOTHING on the unique stripe_payment_intent_id index
  // for idempotency against duplicate webhook deliveries.
  const inserted = await db
    .insert(orders)
    .values({
      id: orderId,
      customerId,
      orderNumber,
      status: "paid",
      subtotalCents,
      taxCents,
      shippingCents,
      totalCents,
      stripePaymentIntentId:
        typeof cs.payment_intent === "string" ? cs.payment_intent : cs.payment_intent?.id ?? null,
      stripeCheckoutSessionId: cs.id,
      shippingAddress,
      billingAddress: null,
      placedAt: new Date(),
      paidAt: new Date(),
    })
    .onConflictDoNothing({ target: orders.stripePaymentIntentId })
    .returning({ id: orders.id });

  const resolvedOrderId = inserted[0]?.id;
  if (!resolvedOrderId) {
    // Duplicate webhook — order already exists.
    return null;
  }

  for (const line of lines) {
    const unitPriceCents = line.item.unitPriceCents;
    const lineTotalCents = unitPriceCents * line.item.quantity;
    await db.insert(orderItems).values({
      id: newId(),
      orderId: resolvedOrderId,
      productVariantId: line.variant.id,
      quantity: line.item.quantity,
      unitPriceCents,
      lineTotalCents,
      productSnapshot: {
        name: line.product.name,
        slug: line.product.slug,
        category: line.product.category,
        decorationMethod: line.product.decorationMethod,
        sku: line.variant.sku,
        variantName: line.variant.name,
        attributes: line.variant.attributes,
        dimensionsMm: line.variant.dimensionsMm,
        weightGrams: line.variant.weightGrams,
      },
      customizationSnapshot: line.draft?.designState ?? null,
      productionStatus: "pending",
    });

    if (line.draft) {
      await db
        .update(designDrafts)
        .set({ status: "converted_to_order" })
        .where(eq(designDrafts.id, line.draft.id));
    }
  }

  await db
    .update(carts)
    .set({ status: "converted", updatedAt: new Date() })
    .where(and(eq(carts.id, cartId), eq(carts.status, "open")));

  await inngest.send({
    name: "order.paid",
    data: { orderId: resolvedOrderId },
  });

  return resolvedOrderId;
}
