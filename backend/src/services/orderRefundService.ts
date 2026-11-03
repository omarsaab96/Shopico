import mongoose, { ClientSession, Types } from "mongoose";
import { Order, IOrder } from "../models/Order";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { Currency } from "../models/Currency";
import { Coupon } from "../models/Coupon";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";
import { updateMembershipOnBalanceChange } from "../utils/membership";
import { calculateItemRefund, refundMoney } from "../utils/orderRefund";

async function refundContext(order: IOrder, itemIndex: number, quantity: number, session: ClientSession | null = null) {
  // Older orders did not store delivery discounts separately.
  if (order.deliveryDiscount === undefined) {
    const codes = order.couponCodes?.length ? order.couponCodes : order.couponCode ? [order.couponCode] : [];
    const freeDelivery = codes.length ? await Coupon.exists({ branchId: order.branchId, code: { $in: codes }, freeDelivery: true }).session(session) : false;
    order.deliveryDiscount = freeDelivery ? Math.min(order.deliveryFee, order.couponDiscount || 0) : 0;
  }
  const calculation = calculateItemRefund(order, itemIndex, quantity);
  const primary = await Currency.findOne({ branchId: order.branchId, isPrimary: true }).session(session);
  if (!primary) throw { status: 400, message: "Primary currency not configured" };
  const currency = order.currency ? await Currency.findOne({ _id: order.currency, branchId: order.branchId }).session(session) : primary;
  if (!currency) throw { status: 400, message: "Order currency not found" };
  const rate = order.currencyExchangeRate ?? (currency.isPrimary ? 1 : currency.exchangeRate);
  if (!Number.isFinite(rate) || rate <= 0) throw { status: 400, message: "Invalid order currency exchange rate" };
  const creditWallet = order.paymentStatus === "CONFIRMED";
  return { ...calculation, primary, currency, rate, creditWallet, walletAmount: creditWallet ? refundMoney(calculation.amount / rate) : 0 };
}

export async function previewOrderItemRefund(orderId: string, branchId: string, itemIndex: number, quantity: number) {
  const order = await Order.findOne({ _id: orderId, branchId });
  if (!order) throw { status: 404, message: "Order not found" };
  const result = await refundContext(order, itemIndex, quantity);
  return {
    amount: result.amount, newTotal: result.total, walletAmount: result.walletAmount,
    currency: result.currency, creditWallet: result.creditWallet,
    expectedTotal: order.total, expectedRefundedQuantity: result.refundedQuantity,
    expectedPaymentStatus: order.paymentStatus,
  };
}

type RefundRequest = { itemIndex: number; quantity: number; requestId: string; expectedRefundedQuantity: number; expectedTotal: number; expectedPaymentStatus: string; expectedAmount: number; expectedWalletAmount: number };

export async function refundOrderItem(orderId: string, branchId: string, actorId: Types.ObjectId, payload: RefundRequest) {
  await mongoose.connection.transaction(async session => {
    const order = await Order.findOne({ _id: orderId, branchId }).session(session);
    if (!order) throw { status: 404, message: "Order not found" };
    const previous = order.refunds.find(refund => refund.requestId === payload.requestId);
    if (previous) {
      if (previous.itemIndex !== payload.itemIndex || previous.quantity !== payload.quantity) throw { status: 409, message: "Refund request already used" };
      return;
    }
    const result = await refundContext(order, payload.itemIndex, payload.quantity, session);
    if (result.refundedQuantity !== payload.expectedRefundedQuantity || order.total !== payload.expectedTotal || order.paymentStatus !== payload.expectedPaymentStatus || result.amount !== payload.expectedAmount || result.walletAmount !== payload.expectedWalletAmount) {
      throw { status: 409, message: "Order or refund amount changed. Preview the refund again" };
    }
    if (result.creditWallet && result.walletAmount > 0) {
      let wallet = await Wallet.findOne({ user: order.user }).session(session);
      if (!wallet) wallet = new Wallet({ user: order.user, balance: 0, balances: [] });
      if (!wallet.balances.length && wallet.balance) wallet.balances.push({ currency: result.primary._id, amount: wallet.balance });
      const currencyId = result.currency._id.toString();
      let balance = wallet.balances.find(entry => entry.currency.toString() === currencyId);
      if (!balance) { wallet.balances.push({ currency: result.currency._id, amount: 0 }); balance = wallet.balances[wallet.balances.length - 1]; }
      balance.amount = refundMoney(balance.amount + result.walletAmount);
      wallet.balance = wallet.balances.find(entry => entry.currency.toString() === result.primary._id.toString())?.amount || 0;
      await wallet.save({ session });
      await WalletTransaction.create([{
        user: order.user, amount: result.walletAmount, currency: result.currency._id, type: "CREDIT", source: "ORDER_ITEM_REFUND",
        reference: order._id.toString(), balanceAfter: balance.amount,
        metadata: { requestId: payload.requestId, itemIndex: payload.itemIndex, quantity: payload.quantity, actorId, branchId },
      }], { session });
      const user = await User.findById(order.user).session(session);
      if (user) await updateMembershipOnBalanceChange(user, balance.amount, branchId, currencyId, session);
    }
    order.items[payload.itemIndex].refundedQuantity = result.refundedQuantity + payload.quantity;
    const couponShare = Math.max(0, (order.couponDiscount || 0) - (order.deliveryDiscount || 0));
    order.couponDiscount = refundMoney(Math.max(order.deliveryDiscount || 0, (order.couponDiscount || 0) - (order.subtotal > 0 ? couponShare * result.gross / order.subtotal : 0)));
    order.subtotal = result.subtotal;
    order.discount = result.discount;
    order.total = result.total;
    order.currencyExchangeRate = result.rate;
    order.refundTotal = refundMoney((order.refundTotal || 0) + result.amount);
    order.refunds.push({ requestId: payload.requestId, itemIndex: payload.itemIndex, quantity: payload.quantity, amount: result.amount, walletAmount: result.walletAmount, currency: result.currency._id, disposition: result.creditWallet ? "WALLET" : "TOTAL_REDUCTION", actor: actorId, at: new Date() });
    await order.save({ session });
    await AuditLog.create([{ user: actorId, type: "orders", action: "ORDER_ITEM_REFUND", result: "SUCCESS", metadata: { orderId, branchId, ...payload, amount: result.amount, walletAmount: result.walletAmount, creditWallet: result.creditWallet } }], { session });
  });
}
