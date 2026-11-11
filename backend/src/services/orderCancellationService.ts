import { Types } from "mongoose";
import { Order } from "../models/Order";
import { settleOrderRefund } from "./refundSettlementService";

const REQUEST_ID = "customer-cancellation";

export async function cancelCustomerOrder(orderId: string, userId: Types.ObjectId) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw { status: 404, message: "Order not found" };
  if (!order.cancelledByCustomer) {
    const now = new Date();
    if (!order.cancellationUntil || order.cancellationUntil <= now || order.status !== "PENDING") {
      throw { status: 409, message: "The two-minute cancellation window has ended" };
    }
    const wallet = order.paymentMethod === "WALLET";
    if (wallet && (order.paymentStatus !== "CONFIRMED" || order.walletDebitAmount === undefined || !order.walletDebitCurrency || !order.walletPrimaryCurrency)) {
      throw { status: 409, message: "Wallet payment information is unavailable" };
    }
    // The deadline check, cancellation and recoverable refund are one atomic write.
    // A request arriving at the deadline cannot race staff access or credit twice.
    const updated = await Order.findOneAndUpdate({
      _id: order._id, user: userId, status: "PENDING", cancelledByCustomer: { $ne: true },
      cancellationUntil: { $gt: new Date() }, __v: order.__v,
    }, {
      $set: { status: "CANCELLED", cancelledByCustomer: true, refundTotal: order.total },
      $inc: { __v: 1 },
      $push: {
        statusHistory: { status: "CANCELLED", at: now },
        refunds: {
          kind: "CUSTOMER_CANCELLATION", requestId: REQUEST_ID, itemIndex: -1, quantity: 0,
          amount: order.total, walletAmount: wallet ? order.walletDebitAmount : 0,
          currency: wallet ? order.walletDebitCurrency : order.currency,
          primaryCurrency: order.walletPrimaryCurrency,
          disposition: wallet ? "WALLET" : "TOTAL_REDUCTION",
          actor: userId, at: now, settlementStatus: "PENDING", cancelledOrder: true, notificationSent: !wallet,
        },
        notificationOutbox: {
          key: new Types.ObjectId().toString(), type: "ORDER_STATUS", status: "CANCELLED",
          id: String(order._id), user: String(userId), branchId: String(order.branchId),
          notifyStaff: false, at: now,
        },
      },
    }, { new: true });
    if (!updated && !await Order.exists({ _id: order._id, user: userId, cancelledByCustomer: true })) {
      throw { status: 409, message: "Order changed or the cancellation window has ended" };
    }
  }
  try { await settleOrderRefund(orderId, String(order.branchId), REQUEST_ID); }
  catch { console.warn("Cancellation refund pending", { orderId }); }
}
