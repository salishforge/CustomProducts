/*
 * Print-ready file pipeline.
 *
 * Triggered by 'order.print_files_needed' fanned out from the Stripe webhook
 * on order.paid. For each line item, resolves the variant's decoration zones
 * + print specs, composes the vendor-shaped file(s) per decoration method,
 * persists them to fixture storage (R2 in production), and updates
 * order_items.print_ready_files + production_status='files_ready'.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  orderItems,
  productVariants,
  type OrderItem,
  type ProductVariant,
} from "@/drizzle/schema";
import { inngest } from "@/inngest/client";
import { buildPrintFilesForOrderItem } from "@/lib/print/dispatch";
import { storePrintFiles } from "@/lib/print/storage";

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
      const [row] = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, orderItemId))
        .limit(1);
      if (!row) throw new Error(`order_item ${orderItemId} not found`);
      return row;
    });

    const variant = await step.run("load-variant", async () => {
      const [row] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.productVariantId))
        .limit(1);
      return row ?? null;
    });

    if (!item.customizationSnapshot) {
      logger.info(
        { orderId, orderItemId },
        "no customization snapshot — buy-as-shown line, skipping print files",
      );
      await db
        .update(orderItems)
        .set({ productionStatus: "files_ready" })
        .where(eq(orderItems.id, orderItemId));
      await step.sendEvent("notify-ready", {
        name: "order.print_files_ready",
        data: { orderId, orderItemId },
      });
      return { ok: true, files: [] };
    }

    // Build + store in one step so the raw bytes never cross an Inngest
    // step boundary (step.run JSON-serializes return values).
    const stored = await step.run("build-and-store", async () => {
      const files = await buildPrintFilesForOrderItem(
        item as unknown as OrderItem,
        (variant as unknown as ProductVariant) ?? null,
      );
      return storePrintFiles(orderId, orderItemId, files);
    });

    await step.run("persist-paths", async () => {
      await db
        .update(orderItems)
        .set({
          printReadyFiles: stored,
          productionStatus: "files_ready",
        })
        .where(eq(orderItems.id, orderItemId));
    });

    await step.sendEvent("notify-ready", {
      name: "order.print_files_ready",
      data: { orderId, orderItemId },
    });

    return { ok: true, files: stored.map((s) => s.filename) };
  },
);
