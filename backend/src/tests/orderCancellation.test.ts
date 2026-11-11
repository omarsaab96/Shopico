import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { existsSync } from "fs";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { cancelCustomerOrder } from "../services/orderCancellationService";
import { getAllOrders, getOrderById, updateOrderStatus, assignDriverToOrder } from "../services/orderService";
import { drainNotificationOutboxes, activateNotifications } from "../notifications/worker";
import { Notification } from "../models/Notification";
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  await Promise.all([Order.deleteMany({}), Wallet.deleteMany({}), WalletTransaction.deleteMany({}), AuditLog.deleteMany({}), Currency.deleteMany({}), User.deleteMany({})]);
  vi.spyOn(mongoose.connection, "transaction").mockImplementation(() => { throw new Error("Transactions must not be used on standalone MongoDB"); });
  branchId = new Types.ObjectId().toString();
  const primary = await Currency.create({ branchId, symbol: { en: "SYP" }, exchangeRate: 1, isPrimary: true, isActive: true });
  primaryId = primary._id;
  const user = await User.create({ name: "Customer", email: "refund-test@example.com", role: "customer", branchIds: [branchId] });
  userId = user._id;
  await Wallet.create({ user: userId, balance: 50, balances: [{ currency: primaryId, amount: 50 }] });
  await activateNotifications();
  order = await Order.create({ cancellationUntil: new Date(Date.now() + 120000), walletDebitAmount: 110, walletDebitCurrency: primaryId, walletPrimaryCurrency: primaryId, user: userId, branchId, currency: primaryId, currencyExchangeRate: 1, deliveryDiscount: 0, status: "PENDING", paymentMethod: "WALLET", paymentStatus: "CONFIRMED", subtotal: 100, deliveryFee: 10, deliveryDistanceKm: 1, discount: 0, total: 110, address: "Test address", items: [{ product: new Types.ObjectId(), quantity: 2, price: 25 }, { product: new Types.ObjectId(), quantity: 1, price: 50 }] });
});


const cancel = (id = userId) => cancelCustomerOrder(String(order._id), id);
const freshOrder = () => Order.findById(order._id).orFail();
const freshWallet = () => Wallet.findOne({ user: userId }).orFail();

test("wallet cancellation preserves order history and refunds exactly once under concurrent retries", async () => {
  await Promise.all([cancel(), cancel(), cancel()]);
  await recoverPendingRefunds();
  await cancel();
  const saved = await freshOrder();
  expect(saved.status).toBe("CANCELLED");
  expect(saved.total).toBe(110);
  expect(saved.refunds).toHaveLength(1);
  expect(saved.refunds[0].settlementStatus).toBe("COMPLETED");
  expect((await freshWallet()).balance).toBe(160);
  expect(await WalletTransaction.countDocuments({ source: "ORDER_CANCELLATION" })).toBe(1);
});

test("cash cancellation creates no wallet credit", async () => {
  await Order.updateOne({ _id: order._id }, { $set: { paymentMethod: "CASH_ON_DELIVERY", paymentStatus: "PENDING" } });
  await cancel();
  expect((await freshOrder()).status).toBe("CANCELLED");
  expect((await freshWallet()).balance).toBe(50);
  expect(await WalletTransaction.countDocuments({})).toBe(0);
});

test("other customers cannot cancel", async () => {
  await expect(cancel(new Types.ObjectId())).rejects.toMatchObject({ status: 404 });
  expect((await freshOrder()).status).toBe("PENDING");
});

test("cancellation is rejected exactly at the deadline", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(order.cancellationUntil!);
  await expect(cancel()).rejects.toMatchObject({ status: 409 });
  vi.useRealTimers();
  expect((await freshOrder()).status).toBe("PENDING");
});

test("wallet refund uses original debit currency and amount after exchange rates change", async () => {
  const secondary = await Currency.create({ branchId, symbol: { en: "USD" }, exchangeRate: 10, isPrimary: false, isActive: true });
  await Order.updateOne({ _id: order._id }, { $set: { walletDebitCurrency: secondary._id, walletDebitAmount: 11 } });
  await Currency.updateOne({ _id: secondary._id }, { $set: { exchangeRate: 20 } });
  await cancel();
  const wallet = await freshWallet();
  expect(wallet.balance).toBe(50);
  expect(wallet.balances.find(b => String(b.currency) === String(secondary._id))?.amount).toBe(11);
});

test("failed wallet credits remain pending and recovery finishes without a duplicate credit", async () => {
  const failure = vi.spyOn(Wallet.prototype, "save").mockRejectedValueOnce(new Error("interrupted"));
  await cancel();
  failure.mockRestore();
  expect((await freshOrder()).refunds[0].settlementStatus).toBe("PENDING");
  await recoverPendingRefunds();
  await cancel();
  expect((await freshWallet()).balance).toBe(160);
  expect((await freshOrder()).refunds[0].settlementStatus).toBe("COMPLETED");
});

test("held orders are invisible and inaccessible to staff until the deadline", async () => {
  expect(await getAllOrders({ branchId })).toHaveLength(0);
  await expect(getOrderById(String(order._id), undefined, branchId)).rejects.toMatchObject({ status: 404 });
  await expect(updateOrderStatus(String(order._id), "PROCESSING", undefined, branchId)).rejects.toMatchObject({ status: 404 });
  await expect(assignDriverToOrder(String(order._id), String(new Types.ObjectId()), branchId)).rejects.toMatchObject({ status: 404 });
  await Order.updateOne({ _id: order._id }, { $set: { cancellationUntil: new Date(Date.now() - 1) } });
  expect(await getAllOrders({ branchId })).toHaveLength(1);
  expect(await getOrderById(String(order._id), undefined, branchId)).toBeTruthy();
});

test("cancelled orders cannot be released or reactivated", async () => {
  await cancel();
  await Order.updateOne({ _id: order._id }, { $set: { cancellationUntil: new Date(Date.now() - 1) } });
  expect(await getAllOrders({ branchId })).toHaveLength(0);
  await expect(updateOrderStatus(String(order._id), "PROCESSING", undefined, branchId)).rejects.toMatchObject({ status: 404 });
});

test("new-order staff notifications wait until the deadline and are suppressed after cancellation", async () => {
  const staff = await User.create({ name: "Staff", email: "staff-cancel@test.com", role: "staff", branchIds: [branchId], permissions: ["orders:view"] });
  await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: staff._id })).toBe(0);
  await cancel();
  await Order.updateOne({ _id: order._id }, { $set: { "notificationOutbox.0.notBefore": new Date(Date.now() - 1) } });
  await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: staff._id })).toBe(0);
});

test("uncancelled orders notify staff after the deadline", async () => {
  const staff = await User.create({ name: "Staff", email: "staff-release@test.com", role: "staff", branchIds: [branchId], permissions: ["orders:view"] });
  await Order.updateOne({ _id: order._id }, { $set: { cancellationUntil: new Date(Date.now() - 1), "notificationOutbox.0.notBefore": new Date(Date.now() - 1) } });
  await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: staff._id, type: "ORDER_CREATED" })).toBe(1);
});


test("cancellation endpoint enforces authentication, ownership and customer role", async () => {
  const { default: app } = await import("../app");
  const { signAccessToken } = await import("../services/tokenService");
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}/api/orders/${order._id}/cancel`;
  const post = (token?: string) => fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
  try {
    expect((await post()).status).toBe(401);
    const other = await User.create({ name: "Other", email: "other-cancel@test.com", role: "customer" });
    expect((await post(signAccessToken(other))).status).toBe(404);
    const staff = await User.create({ name: "Staff", email: "staff-api@test.com", role: "staff", branchIds: [branchId] });
    expect((await post(signAccessToken(staff))).status).toBe(403);
    const result = await post(signAccessToken(await User.findById(userId).orFail()));
    expect(result.status).toBe(200);
    const body = await result.json() as any;
    expect(body.data.cancelledByCustomer).toBe(true);
    expect(body.data.serverTime).toBeTruthy();
    expect(body.data.notificationOutbox).toBeUndefined();
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
