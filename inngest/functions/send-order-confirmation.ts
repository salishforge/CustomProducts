/*
 * Order confirmation email — Inngest function listening for order.paid.
 *
 * Fails clearly when RESEND_API_KEY isn't set (logs and exits without
 * retrying — operator can configure and replay the event in Inngest).
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  customers,
  orderItems,
  orders,
  type Order,
  type OrderItem,
} from "@/drizzle/schema";
import { inngest } from "@/inngest/client";
import { renderOrderConfirmationHtml } from "@/lib/email/order-confirmation";

export const sendOrderConfirmation = inngest.createFunction(
  {
    id: "send-order-confirmation",
    name: "Send order confirmation email",
    concurrency: { limit: 10 },
    retries: 2,
  },
  { event: "order.paid" },
  async ({ event, step, logger }) => {
    const { orderId } = event.data;

    const order = await step.run("load-order", async () => {
      const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!row) throw new Error(`order ${orderId} not found`);
      return row;
    });

    const items = await step.run("load-items", async () => {
      return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    });

    const customer = await step.run("load-customer", async () => {
      const [row] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, order.customerId))
        .limit(1);
      return row ?? null;
    });

    if (!customer) {
      logger.warn({ orderId }, "customer not found; skipping email");
      return { ok: false, reason: "no_customer" };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      logger.warn({ orderId }, "RESEND_API_KEY not set; skipping email send");
      return { ok: false, reason: "resend_not_configured" };
    }

    // Inngest serializes step.run return values through JSON, so Date fields
    // round-trip as strings. The email renderer only reads numeric + string
    // fields, so a cast back to the row types is safe.
    const html = renderOrderConfirmationHtml({
      order: order as unknown as Order,
      items: items as unknown as OrderItem[],
      customerName: customer.displayName,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://salishforge.com",
    });

    const from = process.env.RESEND_FROM_EMAIL ?? "orders@salishforge.com";
    await step.run("send-email", async () => {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: customer.email,
          subject: `Order ${order.orderNumber} · Salishforge`,
          html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Resend send failed (${res.status}): ${text}`);
      }
    });

    return { ok: true };
  },
);
