import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { previewOrderItemRefund, refundOrderItem } from "../services/orderRefundService";
import { recoverPendingRefunds } from "../services/refundSettlementService";
import { Order, IOrder } from "../models/Order";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { Currency } from "../models/Currency";
import { AuditLog } from "../models/AuditLog";
import { User } from "../models/User";

let mongo: MongoMemoryServer;
let order: IOrder;
let branchId: string;
let primaryId: Types.ObjectId;
let userId: Types.ObjectId;
const actorId = new Types.ObjectId();

beforeAll(async () => {
  const installed = `${process.env.ProgramFiles || "C:/Program Files"}/MongoDB/Server/8.0/bin/mongod.exe`;
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY || (process.platform === "win32" && existsSync(installed) ? installed : undefined);
  mongo = await MongoMemoryServer.create({ binary: { systemBinary, version: "8.0.17" } });
  await mongoose.connect(mongo.getUri(), { dbName: "refund_standalone_tests" });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  expect(hello.setName).toBeUndefined();
  await Promise.all([Wallet.init(), Order.init(), User.init()]);
}, 120000);

afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all([Order.deleteMany({}), Wallet.deleteMany({}), WalletTransaction.deleteMany({}), AuditLog.deleteMany({}), Currency.deleteMany({}), User.deleteMany({})]);
  vi.spyOn(mongoose.connection, "transaction").mockImplementation(() => { throw new Error("Transactions must not be used on standalone MongoDB"); });
  branchId = new Types.ObjectId().toString();
  const primary = await Currency.create({ branchId, symbol: { en: "SYP" }, exchangeRate: 1, isPrimary: true, isActive: true });
  primaryId = primary._id;
  const user = await User.create({ name: "Customer", email: "refund-test@example.com", role: "customer", branchIds: [branchId] });
  userId = user._id;
  await Wallet.create({ user: userId, balance: 50, balances: [{ currency: primaryId, amount: 50 }] });
  order = await Order.create({ user: userId, branchId, currency: primaryId, currencyExchangeRate: 1, deliveryDiscount: 0, status: "PENDING", paymentMethod: "WALLET", paymentStatus: "CONFIRMED", subtotal: 100, deliveryFee: 10, deliveryDistanceKm: 1, discount: 0, total: 110, address: "Test address", items: [{ product: new Types.ObjectId(), quantity: 2, price: 25 }, { product: new Types.ObjectId(), quantity: 1, price: 50 }] });
});

async function request(itemIndex = 0, quantity = 1) {
  const preview = await previewOrderItemRefund(order._id.toString(), branchId, itemIndex, quantity);
  return { itemIndex, quantity, requestId: randomUUID(), expectedRefundedQuantity: preview.expectedRefundedQuantity, expectedTotal: preview.expectedTotal, expectedPaymentStatus: preview.expectedPaymentStatus, expectedAmount: preview.amount, expectedWalletAmount: preview.walletAmount, expectedCancelOrder: preview.cancelOrder };
}
const apply = (payload: Awaited<ReturnType<typeof request>>) => refundOrderItem(order._id.toString(), branchId, actorId, payload);
const freshOrder = () => Order.findById(order._id).orFail();
const freshWallet = () => Wallet.findOne({ user: userId }).orFail();

test("paid refunds update the order, wallet, ledger and audit on standalone MongoDB", async () => {
  await apply(await request());
  const updated = await freshOrder();
  const wallet = await freshWallet();
  expect(updated.total).toBe(85);
  expect(updated.items[0].refundedQuantity).toBe(1);
  expect(updated.refunds[0].settlementStatus).toBe("COMPLETED");
  expect(wallet.balance).toBe(75);
  expect(wallet.refundReceipts).toHaveLength(1);
  expect(await WalletTransaction.countDocuments({ source: "ORDER_ITEM_REFUND" })).toBe(1);
  expect(await AuditLog.countDocuments({ action: "ORDER_ITEM_REFUND" })).toBe(1);
  expect(mongoose.connection.transaction).not.toHaveBeenCalled();
});

test("unpaid orders reduce the total without wallet credit", async () => {
  await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "PENDING", paymentMethod: "CASH_ON_DELIVERY" } });
  await apply(await request());
  expect((await freshOrder()).total).toBe(85);
  expect((await freshWallet()).balance).toBe(50);
  expect(await WalletTransaction.countDocuments({})).toBe(0);
});

test("concurrent retries of the same request credit only once", async () => {
  const payload = await request();
  await Promise.all([apply(payload), apply(payload), apply(payload)]);
  await recoverPendingRefunds();
  expect((await freshWallet()).balance).toBe(75);
  expect((await freshOrder()).refunds).toHaveLength(1);
  expect(await WalletTransaction.countDocuments({})).toBe(1);
  expect(await AuditLog.countDocuments({})).toBe(1);
});

test("different requests using the same stale preview cannot refund twice", async () => {
  const first = await request();
  const result = await Promise.allSettled([apply(first), apply({ ...first, requestId: randomUUID() })]);
  expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
  expect(result.filter(item => item.status === "rejected")).toHaveLength(1);
  await recoverPendingRefunds();
  expect((await freshWallet()).balance).toBe(75);
});

test("a failure before wallet credit is recovered from the durable pending record", async () => {
  const payload = await request();
  const failure = vi.spyOn(Wallet.prototype, "save").mockRejectedValueOnce(new Error("simulated interruption"));
  await apply(payload);
  failure.mockRestore();
  expect((await freshOrder()).refunds[0].settlementStatus).toBe("PENDING");
  expect((await freshWallet()).balance).toBe(50);
  await recoverPendingRefunds();
  expect((await freshWallet()).balance).toBe(75);
  expect((await freshOrder()).refunds[0].settlementStatus).toBe("COMPLETED");
});

test("a crash after credit but before the ledger write never credits again", async () => {
  const payload = await request();
  const failure = vi.spyOn(WalletTransaction, "updateOne").mockImplementationOnce(() => { throw new Error("ledger unavailable"); });
  await apply(payload);
  failure.mockRestore();
  expect((await freshWallet()).balance).toBe(75);
  expect(await WalletTransaction.countDocuments({})).toBe(0);
  expect((await freshOrder()).refunds[0].settlementStatus).toBe("PENDING");
  await recoverPendingRefunds();
  await apply(payload);
  expect((await freshWallet()).balance).toBe(75);
  expect(await WalletTransaction.countDocuments({})).toBe(1);
  expect((await freshOrder()).refunds[0].settlementStatus).toBe("COMPLETED");
});

test("audit failure is retried without duplicating credit or ledger entries", async () => {
  const failure = vi.spyOn(AuditLog, "updateOne").mockImplementationOnce(() => { throw new Error("audit unavailable"); });
  await apply(await request());
  failure.mockRestore();
  await recoverPendingRefunds();
  expect((await freshWallet()).balance).toBe(75);
  expect(await WalletTransaction.countDocuments({})).toBe(1);
  expect(await AuditLog.countDocuments({})).toBe(1);
});

test("failure to mark completion safely repeats all settlement steps", async () => {
  const failure = vi.spyOn(Order, "updateOne").mockImplementationOnce(() => { throw new Error("completion unavailable"); });
  await apply(await request());
  failure.mockRestore();
  expect((await freshOrder()).refunds[0].settlementStatus).toBe("PENDING");
  await recoverPendingRefunds();
  expect((await freshWallet()).balance).toBe(75);
  expect(await WalletTransaction.countDocuments({})).toBe(1);
  expect(await AuditLog.countDocuments({})).toBe(1);
  expect((await freshOrder()).refunds[0].settlementStatus).toBe("COMPLETED");
});

test("failed order save cannot credit the wallet or create a refund", async () => {
  const failure = vi.spyOn(Order.prototype, "save").mockRejectedValueOnce(new Error("order unavailable"));
  await expect(apply(await request())).rejects.toThrow("order unavailable");
  failure.mockRestore();
  expect((await freshWallet()).balance).toBe(50);
  expect((await freshOrder()).refunds).toHaveLength(0);
});

test("wallet conversion uses the checkout rate", async () => {
  const secondary = await Currency.create({ branchId, symbol: { en: "USD" }, isPrimary: false, exchangeRate: 200 });
  await Order.updateOne({ _id: order._id }, { $set: { currency: secondary._id, currencyExchangeRate: 100 } });
  await apply(await request());
  const wallet = await freshWallet();
  expect(wallet.balance).toBe(50);
  expect(wallet.balances.find(item => item.currency.toString() === secondary._id.toString())?.amount).toBe(0.25);
});

test("final paid item cancels the order and refunds delivery exactly once", async () => {
  await Order.updateOne({ _id: order._id }, { $set: { items: [{ product: new Types.ObjectId(), quantity: 1, price: 100 }] } });
  const payload = await request();
  expect(payload.expectedCancelOrder).toBe(true);
  expect(payload.expectedAmount).toBe(110);
  await apply(payload);
  await apply(payload);
  expect(await freshOrder()).toMatchObject({ status: "CANCELLED", total: 0, deliveryFee: 0, refundTotal: 110 });
  expect((await freshWallet()).balance).toBe(160);
  expect(await WalletTransaction.countDocuments({})).toBe(1);
});

test("final unpaid item cancels the delivery charge without credit", async () => {
  await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "PENDING", items: [{ product: new Types.ObjectId(), quantity: 1, price: 100 }] } });
  await apply(await request());
  expect(await freshOrder()).toMatchObject({ status: "CANCELLED", total: 0, deliveryFee: 0 });
  expect((await freshWallet()).balance).toBe(50);
  expect(await WalletTransaction.countDocuments({})).toBe(0);
});

test("a changed payment status rejects the preview before any writes", async () => {
  const payload = await request();
  await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "PENDING" } });
  await expect(apply(payload)).rejects.toMatchObject({ status: 409 });
  expect((await freshWallet()).balance).toBe(50);
  expect((await freshOrder()).refunds).toHaveLength(0);
});

test("orders from another branch cannot be refunded", async () => {
  const payload = await request();
  await expect(refundOrderItem(order._id.toString(), new Types.ObjectId().toString(), actorId, payload)).rejects.toMatchObject({ status: 404 });
  expect((await freshWallet()).balance).toBe(50);
});

test("concurrent refunds on different orders preserve both wallet credits", async () => {
  const second = new Order({ ...order.toObject(), _id: new Types.ObjectId(), refunds: [] });
  await second.save();
  const firstRequest = await request();
  await Promise.all([
    apply(firstRequest),
    refundOrderItem(second._id.toString(), branchId, actorId, { ...firstRequest, requestId: randomUUID() }),
  ]);
  await recoverPendingRefunds();
  const wallet = await freshWallet();
  expect(wallet.balance).toBe(100);
  expect(wallet.refundReceipts).toHaveLength(2);
  expect(await WalletTransaction.countDocuments({})).toBe(2);
});

test("wallets can be created safely when a customer has no wallet", async () => {
  await Wallet.deleteMany({ user: userId });
  const payload = await request();
  await Promise.all([apply(payload), apply(payload)]);
  await recoverPendingRefunds();
  expect(await Wallet.countDocuments({ user: userId })).toBe(1);
  expect((await freshWallet()).balance).toBe(25);
  expect((await freshWallet()).refundReceipts).toHaveLength(1);
});
