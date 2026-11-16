export type DriverOrderGroup = "upcoming" | "ready" | "previous";

export function groupDriverOrders<T extends { status: string; driverStartedAt?: string | null }>(orders: readonly T[]): Record<DriverOrderGroup, T[]> {
  const groups: Record<DriverOrderGroup, T[]> = { upcoming: [], ready: [], previous: [] };
  for (const order of orders) {
    if (order.status === "PENDING" || order.status === "PROCESSING") groups.upcoming.push(order);
    else if (order.status === "SHIPPING" && !order.driverStartedAt) groups.ready.push(order);
    else if (order.status === "DELIVERED") groups.previous.push(order);
  }
  return groups;
}

export function driverDeliveryAction(order?: { status?: string; driverStartedAt?: string | null } | null): "start" | "deliver" | null {
  if (order?.status !== "SHIPPING") return null;
  return order.driverStartedAt ? "deliver" : "start";
}
