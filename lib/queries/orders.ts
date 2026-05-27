/*
 * Order read helpers for customer-facing pages.
 */

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  orderItems,
  orders,
  productionStages,
  type Order,
  type OrderItem,
  type ProductionStage,
} from "@/drizzle/schema";

export async function getCustomerOrders(customerId: string): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.placedAt));
}

export async function getOrderWithItems(
  orderId: string,
  customerId?: string,
): Promise<
  | {
      order: Order;
      items: OrderItem[];
      stages: ProductionStage[];
    }
  | null
> {
  const where = customerId
    ? and(eq(orders.id, orderId), eq(orders.customerId, customerId))
    : eq(orders.id, orderId);

  const [order] = await db.select().from(orders).where(where).limit(1);
  if (!order) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const itemIds = items.map((i) => i.id);
  const stages: ProductionStage[] = [];
  for (const itemId of itemIds) {
    const rows = await db
      .select()
      .from(productionStages)
      .where(eq(productionStages.orderItemId, itemId))
      .orderBy(desc(productionStages.enteredAt));
    stages.push(...rows);
  }

  return { order, items, stages };
}
