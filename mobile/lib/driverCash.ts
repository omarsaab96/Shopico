export type CashCurrency = { _id: string; symbol: { en: string; ar?: string } };
type CashOrder = { status: string; paymentMethod?: string; paymentStatus?: string; total?: number; currency?: CashCurrency | string | null };

export function outstandingDriverCash(orders: CashOrder[], primary?: CashCurrency | null) {
  const totals = new Map<string, { amount: number; currency?: CashCurrency }>();
  for (const order of orders) {
    if (order.status !== "DELIVERED" || order.paymentMethod !== "CASH_ON_DELIVERY" || order.paymentStatus !== "PENDING") continue;
    const currency = typeof order.currency === "object" && order.currency ? order.currency : order.currency ? undefined : primary || undefined;
    const id = typeof order.currency === "string" ? order.currency : currency?._id || "unknown";
    const entry = totals.get(id) || { amount: 0, currency };
    entry.amount = Math.round((entry.amount + Number(order.total || 0)) * 1e6) / 1e6;
    totals.set(id, entry);
  }
  return [...totals.values()];
}
