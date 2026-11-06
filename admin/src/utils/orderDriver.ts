export const isDriverAssignmentLocked = (order: { status: string; statusHistory?: { status: string }[] }) =>
  order.status === "DELIVERED" || Boolean(order.statusHistory?.some(entry => entry.status === "DELIVERED"));
