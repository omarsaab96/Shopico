import type { OrderPreview } from "./orderPreview";

export type ActiveOrder = OrderPreview & { cancelledByCustomer?: boolean };

export function selectActiveOrder<T extends ActiveOrder>(orders: readonly T[], driver: boolean): T | null {
  const candidates = orders.filter(order => !order.cancelledByCustomer && (driver
    ? order.status === "SHIPPING" : ["PENDING", "PROCESSING", "SHIPPING"].includes(order.status)));
  return candidates.sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0))[0] || null;
}
