import { assertStaffOrderAvailable } from "../utils/orderCancellation";
import { Types } from "mongoose";
import { settleOrderRefund } from "./refundSettlementService";
import { Order, IOrder } from "../models/Order";
import { Currency } from "../models/Currency";
import { Coupon } from "../models/Coupon";
import { calculateItemRefund, refundMoney } from "../utils/orderRefund";

async function refundContext(order: IOrder, itemIndex: number, quantity: number) {
  // Older orders did not store delivery discounts separately.
  if (order.deliveryDiscount === undefined) {
    const codes = order.couponCodes?.length ? order.couponCodes : order.couponCode ? [order.couponCode] : [];
    const freeDelivery = codes.length ? await Coupon.exists({ branchId: order.branchId, code: { $in: codes }, freeDelivery: true }) : false;
    order.deliveryDiscount = freeDelivery ? Math.min(order.deliveryFee, order.couponDiscount || 0) : 0;
  }
  const calculation = calculateItemRefund(order, itemIndex, quantity);
  const primary = await Currency.findOne({ branchId: order.branchId, isPrimary: true });
  if (!primary) throw { status: 400, message: "Primary currency not configured" };
  const currency = order.currency ? await Currency.findOne({ _id: order.currency, branchId: order.branchId }) : primary;
  if (!currency) throw { status: 400, message: "Order currency not found" };
  const rate = order.currencyExchangeRate ?? (currency.isPrimary ? 1 : currency.exchangeRate);
  if (!Number.isFinite(rate) || rate <= 0) throw { status: 400, message: "Invalid order currency exchange rate" };
  const creditWallet = order.paymentStatus === "CONFIRMED";
  return { ...calculation, primary, currency, rate, creditWallet, walletAmount: creditWallet ? refundMoney(calculation.amount / rate) : 0 };
}

export async function previewOrderItemRefund(orderId: string, branchId: string, itemIndex: number, quantity: number) {
  const order = await Order.findOne({ _id: orderId, branchId });
  if (!order) throw { status: 404, message: "Order not found" };
  assertStaffOrderAvailable(order);
  const result = await refundContext(order, itemIndex, quantity);
  return {
    amount: result.amount, newTotal: result.total, walletAmount: result.walletAmount,
    currency: result.currency, creditWallet: result.creditWallet,
    cancelOrder: result.cancelOrder,
    expectedTotal: order.total, expectedRefundedQuantity: result.refundedQuantity,
    expectedPaymentStatus: order.paymentStatus,
  };
}

type RefundRequest = { itemIndex: number; quantity: number; requestId: string; expectedRefundedQuantity: number; expectedTotal: number; expectedPaymentStatus: string; expectedAmount: number; expectedWalletAmount: number; expectedCancelOrder: boolean };

export async function refundOrderItem(orderId: string, branchId: string, actorId: Types.ObjectId, payload: RefundRequest) {
  // The order adjustment and durable pending work are one atomic document save.
  for (let attempt = 0; attempt < 5; attempt++) {
    const order = await Order.findOne({ _id: orderId, branchId });
    if (!order) throw { status: 404, message: "Order not found" };
    assertStaffOrderAvailable(order);
    const previous = order.refunds.find(refund => refund.requestId === payload.requestId);
    if (previous) {
      if (previous.itemIndex !== payload.itemIndex || previous.quantity !== payload.quantity) throw { status: 409, message: "Refund request already used" };
      break;
    }
    const result = await refundContext(order, payload.itemIndex, payload.quantity);
    if (result.refundedQuantity !== payload.expectedRefundedQuantity || order.total !== payload.expectedTotal || order.paymentStatus !== payload.expectedPaymentStatus || result.amount !== payload.expectedAmount || result.walletAmount !== payload.expectedWalletAmount || result.cancelOrder !== payload.expectedCancelOrder) {
      throw { status: 409, message: "Order or refund amount changed. Preview the refund again" };
    }
    order.items[payload.itemIndex].refundedQuantity = result.refundedQuantity + payload.quantity;
    const couponShare = Math.max(0, (order.couponDiscount || 0) - (order.deliveryDiscount || 0));
    order.couponDiscount = result.cancelOrder ? 0 : refundMoney(Math.max(order.deliveryDiscount || 0, (order.couponDiscount || 0) - (order.subtotal > 0 ? couponShare * result.gross / order.subtotal : 0)));
    order.subtotal = result.subtotal;
    order.discount = result.discount;
    order.total = result.total;
    order.deliveryFee = result.deliveryFee;
    order.deliveryDiscount = result.deliveryDiscount;
    if (result.cancelOrder) {
      order.status = "CANCELLED";
      order.statusHistory.push({ status: "CANCELLED", at: new Date() });
    }
    order.currencyExchangeRate = result.rate;
    order.refundTotal = refundMoney((order.refundTotal || 0) + result.amount);
    order.refunds.push({
      requestId: payload.requestId, itemIndex: payload.itemIndex, quantity: payload.quantity,
      amount: result.amount, walletAmount: result.walletAmount, currency: result.currency._id,
      primaryCurrency: result.primary._id, disposition: result.creditWallet ? "WALLET" : "TOTAL_REDUCTION",
      actor: actorId, at: new Date(), settlementStatus: "PENDING",
      cancelledOrder: result.cancelOrder,
    });
    try {
      order.$locals.notifyStaff = false;
      await order.save();
      break;
    } catch (error: any) {
      if (error?.name !== "VersionError") throw error;
      if (attempt === 4) throw { status: 409, message: "Order changed. Preview the refund again" };
    }
  }
  try {
    await settleOrderRefund(orderId, branchId, payload.requestId);
  } catch {
    // The refund is already recorded. The recovery worker resumes its remaining
    // idempotent steps; returning the updated order exposes its pending status.
    console.warn("Refund settlement pending", { orderId, requestId: payload.requestId });
  }
}
