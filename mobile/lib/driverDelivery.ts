import api from "./api";

type DriverSnapshot = {
  _id?: string; status?: string; updatedAt?: string; driverStartedAt?: string | null;
  driverId?: string | { _id?: string } | null;
};
const confirmed = new Map<string, DriverSnapshot>();
const driverId = (order: DriverSnapshot) => typeof order.driverId === "string" ? order.driverId : order.driverId?._id;
const key = (order: DriverSnapshot) => order._id && driverId(order) ? `${driverId(order)}:${order._id}` : null;
const validStart = (order?: DriverSnapshot | null) => order?.status === "SHIPPING" && typeof order.driverStartedAt === "string"
  && Number.isFinite(Date.parse(order.driverStartedAt));
const time = (order: DriverSnapshot) => Date.parse(order.updatedAt || "") || 0;

// A refresh begun before Start delivery must not undo its newer, saved response.
export function reconcileDriverDelivery<T extends DriverSnapshot>(incoming: T): T {
  const id = key(incoming);
  const saved = id ? confirmed.get(id) : undefined;
  if (saved && (time(incoming) < time(saved) ||
      (validStart(saved) && incoming.status === "SHIPPING" && incoming.driverStartedAt === undefined && time(incoming) === time(saved)))) {
    return { ...incoming, ...saved } as T;
  }
  // Keep newer terminal/reset states too, so late responses cannot resurrect a delivery.
  if (id && (saved || validStart(incoming))) {
    confirmed.set(id, { _id: incoming._id, driverId: incoming.driverId, status: incoming.status,
      driverStartedAt: incoming.driverStartedAt, updatedAt: incoming.updatedAt });
    if (confirmed.size > 100) confirmed.delete(confirmed.keys().next().value!);
  }
  return incoming;
}

export class DeliveryStartNotConfirmedError extends Error {
  readonly code = "DELIVERY_START_NOT_CONFIRMED";
  constructor() { super("The server did not confirm a saved delivery start"); }
}

export async function startDriverDelivery<T extends DriverSnapshot>(orderId: string): Promise<T> {
  const response = await api.put(`/orders/${orderId}/driver-status`, { status: "SHIPPING" });
  let order = response.data?.data as T | undefined;
  if (!validStart(order)) order = (await api.get(`/orders/${orderId}`)).data?.data;
  if (!order || order._id !== orderId || !validStart(order)) throw new DeliveryStartNotConfirmedError();
  const saved = reconcileDriverDelivery(order);
  if (!validStart(saved)) throw new DeliveryStartNotConfirmedError();
  return saved;
}
