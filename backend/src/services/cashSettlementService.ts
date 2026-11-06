import { Types } from "mongoose";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Currency } from "../models/Currency";

const outstandingFilter = (branchId: string) => ({
  branchId, status: "DELIVERED", paymentMethod: "CASH_ON_DELIVERY", paymentStatus: "PENDING",
  driverId: { $ne: null }, cashSettlement: null,
});

export async function listCashSettlements(branchId: string) {
  const [orders, recent, primary] = await Promise.all([
    Order.find(outstandingFilter(branchId)).select("driverId currency user statusHistory updatedAt total").sort({ updatedAt: 1 }).populate("currency").populate("user", "name").lean(),
    Order.find({ branchId, cashSettlement: { $ne: null } }).select("driverId cashSettlement").sort({ "cashSettlement.at": -1 }).limit(50)
      .populate("cashSettlement.currency").populate("cashSettlement.actor", "name").lean(),
    Currency.findOne({ branchId, isPrimary: true }).lean(),
  ]);
  const driverIds = [...orders, ...recent].flatMap(order => order.driverId ? [order.driverId] : []);
  const drivers = await User.find({ $or: [{ role: "driver", branchIds: branchId }, { _id: { $in: driverIds } }] })
    .select("name phone email").sort({ name: 1 }).lean();
  return {
    branchId,
    drivers,
    orders: orders.map(order => ({
      _id: String(order._id), driverId: String(order.driverId), total: order.total,
      currency: order.currency || primary,
      customerName: (order.user as any)?.name || "",
      deliveredAt: [...order.statusHistory].reverse().find(entry => entry.status === "DELIVERED")?.at || order.updatedAt,
    })),
    recent: recent.map(order => ({ _id: String(order._id), driverId: String(order.driverId), ...order.cashSettlement })),
  };
}

export type CashSettlementInput = {
  driverId: string;
  requestId: string;
  orders: { orderId: string; expectedTotal: number; currencyId: string }[];
  note?: string;
};

// Each receipt and payment change is one optimistic, atomic document save.
// This also works on standalone MongoDB; concurrent saves cannot collect an order twice.
export async function settleDriverCash(branchId: string, actorId: Types.ObjectId, input: CashSettlementInput) {
  const settledIds: string[] = [];
  const skippedIds: string[] = [];
  const primary = await Currency.findOne({ branchId, isPrimary: true });
  for (const item of input.orders) {
    const order = await Order.findOne({ ...outstandingFilter(branchId), _id: item.orderId, driverId: input.driverId });
    if (!order || order.total !== item.expectedTotal || String(order.currency || primary?._id || "") !== item.currencyId) {
      skippedIds.push(item.orderId);
      continue;
    }
    order.cashSettlement = {
      requestId: input.requestId, driver: input.driverId, actor: actorId, amount: order.total,
      currency: item.currencyId, at: new Date(), note: input.note?.trim() || undefined,
    };
    order.paymentStatus = "CONFIRMED";
    order.$locals.notifyStaff = false;
    try {
      await order.save();
      settledIds.push(item.orderId);
    } catch (error: any) {
      if (error.name !== "VersionError") throw error;
      skippedIds.push(item.orderId);
    }
  }
  return { settledIds, skippedIds };
}
