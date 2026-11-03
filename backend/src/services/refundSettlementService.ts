import { createHash } from "crypto";
import { Types } from "mongoose";
import { Order } from "../models/Order";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";
import { Currency } from "../models/Currency";
import { refundMoney } from "../utils/orderRefund";
import { updateMembershipOnBalanceChange } from "../utils/membership";

const recordId = (kind: string, key: string) => new Types.ObjectId(createHash("sha256").update(`${kind}:${key}`).digest("hex").slice(0, 24));

// Saving both the balance and receipt in one wallet document makes crediting
// idempotent even if the process stops before the separate ledger write.
async function creditOnce(userId: Types.ObjectId | string, key: string, currencyId: string, primaryId: string, amount: number) {
  for (let attempt = 0; attempt < 12; attempt++) {
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) wallet = new Wallet({ user: userId, balance: 0, balances: [], refundReceipts: [] });
    const applied = wallet.refundReceipts.find(receipt => receipt.key === key);
    if (applied) return applied;
    if (!wallet.balances.length && wallet.balance) wallet.balances.push({ currency: primaryId, amount: wallet.balance });
    let balance = wallet.balances.find(entry => entry.currency.toString() === currencyId);
    if (!balance) { wallet.balances.push({ currency: currencyId, amount: 0 }); balance = wallet.balances[wallet.balances.length - 1]; }
    balance.amount = refundMoney(balance.amount + amount);
    wallet.balance = wallet.balances.find(entry => entry.currency.toString() === primaryId)?.amount || 0;
    wallet.refundReceipts.push({ key, currency: currencyId, amount, balanceAfter: balance.amount });
    try {
      await wallet.save();
      return wallet.refundReceipts[wallet.refundReceipts.length - 1];
    } catch (error: any) {
      if (error?.name !== "VersionError" && error?.code !== 11000) throw error;
    }
  }
  throw new Error("Wallet is busy; refund settlement will retry");
}

export async function settleOrderRefund(orderId: string, branchId: string, requestId: string) {
  const order = await Order.findOne({ _id: orderId, branchId });
  const refund = order?.refunds.find(item => item.requestId === requestId);
  if (!order || !refund || refund.settlementStatus !== "PENDING") return;
  const key = `${orderId}:${requestId}`;
  if (refund.disposition === "WALLET" && refund.walletAmount > 0) {
    if (!refund.currency) throw new Error("Refund currency is missing");
    const currencyId = refund.currency.toString();
    const primaryId = refund.primaryCurrency?.toString() || (await Currency.findOne({ branchId, isPrimary: true }))?._id.toString();
    if (!primaryId) throw new Error("Primary refund currency is missing");
    const receipt = await creditOnce(order.user, key, currencyId, primaryId, refund.walletAmount);
    await WalletTransaction.updateOne({ _id: recordId("ledger", key) }, { $setOnInsert: {
      user: order.user, amount: receipt.amount, currency: refund.currency, type: "CREDIT", source: "ORDER_ITEM_REFUND",
      reference: orderId, balanceAfter: receipt.balanceAfter,
      metadata: { requestId, itemIndex: refund.itemIndex, quantity: refund.quantity, actorId: refund.actor, branchId },
    } }, { upsert: true });
    // Re-evaluate membership using the current wallet rather than an old receipt.
    const wallet = await Wallet.findOne({ user: order.user });
    const user = await User.findById(order.user);
    const balance = wallet?.balances.find(entry => entry.currency.toString() === currencyId)?.amount || 0;
    if (user) await updateMembershipOnBalanceChange(user, balance, branchId, currencyId);
  }
  if (order.status === "CANCELLED" && order.driverId) {
    const active = await Order.exists({ driverId: order.driverId, status: { $in: ["PENDING", "PROCESSING", "SHIPPING"] } });
    await User.updateOne({ _id: order.driverId, role: "driver" }, { $set: { driverStatus: active ? "BUSY" : "AVAILABLE" } });
  }
  await AuditLog.updateOne({ _id: recordId("audit", key) }, { $setOnInsert: {
    user: refund.actor, type: "orders", action: "ORDER_ITEM_REFUND", result: "SUCCESS",
    metadata: { orderId, branchId, requestId, itemIndex: refund.itemIndex, quantity: refund.quantity, amount: refund.amount, walletAmount: refund.walletAmount, creditWallet: refund.disposition === "WALLET", cancelledOrder: refund.cancelledOrder === true },
  } }, { upsert: true });
  await Order.updateOne({ _id: orderId, refunds: { $elemMatch: { requestId, settlementStatus: "PENDING" } } }, {
    $set: { "refunds.$.settlementStatus": "COMPLETED" }, $inc: { __v: 1 },
  });
}

export async function recoverPendingRefunds() {
  const pending = Order.find({ "refunds.settlementStatus": "PENDING" }).select("_id branchId refunds").cursor();
  for await (const order of pending) {
    for (const refund of order.refunds) {
      if (refund.settlementStatus !== "PENDING") continue;
      try { await settleOrderRefund(order._id.toString(), order.branchId.toString(), refund.requestId); }
      catch { console.warn("Refund recovery will retry", { orderId: order._id.toString(), requestId: refund.requestId }); }
    }
  }
}

export function startRefundRecovery() {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await recoverPendingRefunds(); }
    catch { console.warn("Refund recovery temporarily unavailable"); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(() => { void run(); }, 15_000);
  timer.unref();
  return () => clearInterval(timer);
}
