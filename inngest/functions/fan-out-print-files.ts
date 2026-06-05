/*
 * Fan-out function: on 'order.paid' load the order's items and send one
 * 'order.print_files_needed' event per item. Keeps generate-print-files
 * single-purpose (one item per invocation, easier retries).
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orderItems } from "@/drizzle/schema";
import { inngest } from "@/inngest/client";

export const fanOutPrintFiles = inngest.createFunction(
  {
    id: "order-fanout-print-files",
    name: "Fan-out: enqueue print-file generation per order item",
    retries: 1,
  },
  { event: "order.paid" },
  async ({ event, step }) => {
    const { orderId } = event.data;
    const items = await step.run("load-items", async () =>
      db.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId)),
    );
    if (items.length === 0) return { ok: true, enqueued: 0 };
    await step.sendEvent(
      "enqueue-each",
      items.map((it) => ({
        name: "order.print_files_needed" as const,
        data: { orderId, orderItemId: it.id },
      })),
    );
    return { ok: true, enqueued: items.length };
  },
);
