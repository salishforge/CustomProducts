/*
 * Print-ready file pipeline.
 *
 * Triggered by 'order.print_files_needed' (which is fanned out from the
 * Stripe webhook on order.paid). For each line item, resolves the variant's
 * decoration zones + their print specs, composes the vendor-shaped file(s)
 * per family (PDF for UV, SVG + DXF for laser, depth map for crystal),
 * uploads to R2, updates order_items.print_ready_files.
 *
 * Skeleton — the per-family composer wiring is filled in as each family ships
 * (Phase 3). The signature and step structure are final.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { orderItems } from "@/drizzle/schema";
import { inngest } from "@/inngest/client";

export const generatePrintFiles = inngest.createFunction(
  {
    id: "order-generate-print-files",
    name: "Generate print-ready files for an order item",
    concurrency: { limit: 4 },
    retries: 3,
  },
  { event: "order.print_files_needed" },
  async ({ event, step, logger }) => {
    const { orderId, orderItemId } = event.data;

    const item = await step.run("load-order-item", async () => {
      const rows = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, orderItemId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new Error(`order_item ${orderItemId} not found`);
      }
      return row;
    });

    logger.info(
      { orderId, orderItemId, snapshotKeys: Object.keys(item.productSnapshot ?? {}) },
      "would generate print files",
    );

    // TODO: Phase 3 — per-family composer; emit PDF/SVG/DXF/PNG-depth files
    // into R2 under r2://print/{orderId}/{itemId}.{ext}, update
    // order_items.print_ready_files + production_status='files_ready'.

    await step.sendEvent("notify-ready", {
      name: "order.print_files_ready",
      data: { orderId, orderItemId },
    });

    return { ok: true };
  },
);
