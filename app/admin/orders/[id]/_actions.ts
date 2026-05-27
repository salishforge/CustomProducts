"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/id";
import {
  orderItems,
  orders,
  productionStages,
} from "@/drizzle/schema";
import { requireAdmin } from "@/lib/auth";

const STAGE_ORDER = [
  "pending",
  "files_ready",
  "in_queue",
  "in_production",
  "qc",
  "packed",
  "shipped",
] as const;

type Stage = (typeof STAGE_ORDER)[number];

export async function advanceOrderItemStageAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const orderItemId = formData.get("orderItemId");
  const targetStage = formData.get("targetStage");
  if (typeof orderItemId !== "string" || typeof targetStage !== "string") {
    throw new Error("Missing fields");
  }
  if (!STAGE_ORDER.includes(targetStage as Stage)) {
    throw new Error("Invalid stage");
  }

  const stage = targetStage as Stage;

  await db
    .update(orderItems)
    .set({ productionStatus: stage })
    .where(eq(orderItems.id, orderItemId));

  await db.insert(productionStages).values({
    id: newId(),
    orderItemId,
    stage,
    actor: session.user.email ?? "admin",
  });

  // Compute aggregate order status: shipped if every line is shipped, etc.
  // MVP: keep order.status manually controllable; production board mutates
  // per-item state only.

  revalidatePath("/admin/orders");
  const orderId = formData.get("orderId");
  if (typeof orderId === "string") revalidatePath(`/admin/orders/${orderId}`);
}

export async function setOrderStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get("id");
  const status = formData.get("status");
  const allowed = [
    "pending_payment",
    "paid",
    "in_production",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ] as const;
  if (typeof id !== "string" || typeof status !== "string") {
    throw new Error("Missing fields");
  }
  if (!allowed.includes(status as (typeof allowed)[number])) {
    throw new Error("Invalid status");
  }
  const updates: Partial<typeof orders.$inferInsert> = {
    status: status as (typeof allowed)[number],
    updatedAt: new Date(),
  };
  if (status === "shipped") updates.shippedAt = new Date();
  if (status === "delivered") updates.deliveredAt = new Date();

  await db.update(orders).set(updates).where(eq(orders.id, id));

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
}
