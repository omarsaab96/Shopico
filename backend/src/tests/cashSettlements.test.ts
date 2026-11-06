import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import jwt from "jsonwebtoken";
import app from "../app";
import { env } from "../config/env";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Currency } from "../models/Currency";
import { listCashSettlements, settleDriverCash } from "../services/cashSettlementService";
import { updateOrderStatus } from "../services/orderService";

let mongo: MongoMemoryServer;
let server: ReturnType<typeof app.listen>;
let base: string;
let branch: string;
let currency: any;
let customer: any;
let driver: any;
let staff: any;
const createOrder = (extra: Record<string, unknown> = {}) => Order.create({
  user: customer._id, driverId: driver._id, branchId: branch, currency: currency._id,
  items: [{ product: new Types.ObjectId(), quantity: 1, price: 100 }],
  status: "DELIVERED", paymentMethod: "CASH_ON_DELIVERY", paymentStatus: "PENDING",
  address: "Test", subtotal: 100, total: 105, deliveryFee: 5, deliveryDistanceKm: 1,
  statusHistory: [{ status: "DELIVERED", at: new Date() }], ...extra,
});
const input = (orders: any[], extra = {}) => ({
  driverId: String(driver._id), requestId: randomUUID(),
  orders: orders.map(order => ({ orderId: String(order._id), expectedTotal: order.total, currencyId: String(order.currency || currency._id) })), ...extra,
});
const request = (user: any, method = "GET", body?: unknown, selectedBranch = branch) => fetch(`${base}/api/cash-settlements`, {
  method, headers: { Authorization: `Bearer ${jwt.sign({ sub: String(user._id) }, env.jwtSecret)}`, "x-branch-id": selectedBranch, "Content-Type": "application/json" },
  body: body ? JSON.stringify(body) : undefined,
});

beforeAll(async () => {
  const installed = `${process.env.ProgramFiles || "C:/Program Files"}/MongoDB/Server/8.0/bin/mongod.exe`;
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY || (process.platform === "win32" && existsSync(installed) ? installed : undefined);
  mongo = await MongoMemoryServer.create({ binary: { systemBinary, version: "8.0.17" } });
  await mongoose.connect(mongo.getUri(), { dbName: "cash_settlement_tests" });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  expect(hello.setName).toBeUndefined();
  server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
}, 120000);
afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
  await mongoose.disconnect(); await mongo?.stop();
});
beforeEach(async () => {
  await Promise.all([Order.deleteMany({}), User.deleteMany({}), Currency.deleteMany({})]);
  branch = String(new Types.ObjectId());
  [customer, driver, staff] = await User.create([
    { name: "Customer", email: "customer@test.com", branchIds: [branch] },
    { name: "Driver", email: "driver@test.com", role: "driver", branchIds: [branch] },
    { name: "Cashier", email: "cashier@test.com", role: "staff", branchIds: [branch], permissions: ["cash-settlements:view", "cash-settlements:manage"] },
  ]);
  currency = await Currency.create({ branchId: branch, symbol: { en: "SYP" }, exchangeRate: 1, isPrimary: true });
});

test("lists only delivered pending COD orders in the selected branch", async () => {
  const eligible = await createOrder();
  await createOrder({ status: "SHIPPING" });
  await createOrder({ paymentMethod: "WALLET" });
  await createOrder({ paymentStatus: "CONFIRMED" });
  await createOrder({ driverId: null });
  await createOrder({ branchId: new Types.ObjectId() });
  const data = await listCashSettlements(branch);
  expect(data.orders.map(order => order._id)).toEqual([String(eligible._id)]);
  expect(data.drivers.map(user => user.name)).toEqual(["Driver"]);
  expect(data.orders[0].currency).toMatchObject({ symbol: { en: "SYP" } });
  expect(data.drivers[0]).not.toHaveProperty("password");
});
test("settles selected orders with an atomic, attributed receipt and payment notification", async () => {
  const selected = await createOrder(); const untouched = await createOrder();
  const result = await settleDriverCash(branch, staff._id, input([selected], { note: "Cash received at counter" }));
  expect(result).toEqual({ settledIds: [String(selected._id)], skippedIds: [] });
  const saved = await Order.findById(selected._id).lean();
  expect(saved).toMatchObject({ status: "DELIVERED", paymentStatus: "CONFIRMED", total: 105,
    cashSettlement: { amount: 105, note: "Cash received at counter", actor: staff._id, driver: driver._id, currency: currency._id } });
  expect(saved!.cashSettlement!.at).toBeInstanceOf(Date);
  expect((saved as any).notificationOutbox.filter((event: any) => event.type === "PAYMENT_CONFIRMED")).toHaveLength(1);
  expect((await Order.findById(untouched._id))!.paymentStatus).toBe("PENDING");
  const refreshed = await listCashSettlements(branch);
  expect(refreshed.orders).toHaveLength(1);
  expect(refreshed.recent[0].actor).toMatchObject({ name: "Cashier" });
});
test("bulk settlement preserves each order's currency", async () => {
  const usd = await Currency.create({ branchId: branch, symbol: { en: "USD" }, exchangeRate: 10000 });
  const a = await createOrder(); const b = await createOrder({ total: 2.25, currency: usd._id });
  const result = await settleDriverCash(branch, staff._id, input([a, b]));
  expect(result.settledIds).toHaveLength(2);
  expect((await Order.findById(b._id))!.cashSettlement).toMatchObject({ amount: 2.25, currency: usd._id });
  expect((await listCashSettlements(branch)).orders).toHaveLength(0);
});
test("legacy orders use the branch primary currency", async () => {
  const order = await createOrder({ currency: undefined });
  expect((await listCashSettlements(branch)).orders[0].currency).toMatchObject({ _id: currency._id });
  expect((await settleDriverCash(branch, staff._id, input([order]))).settledIds).toEqual([String(order._id)]);
});
test("retries and simultaneous cashiers never settle an order twice", async () => {
  const order = await createOrder(); const payload = input([order]);
  const results = await Promise.all([settleDriverCash(branch, staff._id, payload), settleDriverCash(branch, staff._id, payload)]);
  expect(results.flatMap(result => result.settledIds)).toEqual([String(order._id)]);
  expect((await settleDriverCash(branch, staff._id, payload)).settledIds).toHaveLength(0);
  const saved = await Order.findById(order._id).lean();
  expect((saved as any).notificationOutbox.filter((event: any) => event.type === "PAYMENT_CONFIRMED")).toHaveLength(1);
});
test.each(["total", "currency", "driver", "branch", "status", "method", "payment"])("skips a changed or ineligible %s without confirming payment", async changed => {
  const order = await createOrder(); const payload = input([order]);
  const edits: Record<string, unknown> = { total: { total: 106 }, currency: { currency: new Types.ObjectId() }, driver: { driverId: new Types.ObjectId() },
    branch: { branchId: new Types.ObjectId() }, status: { status: "SHIPPING" }, method: { paymentMethod: "SHAM_CASH" }, payment: { paymentStatus: "CONFIRMED" } };
  await Order.updateOne({ _id: order._id }, edits[changed] as any);
  expect(await settleDriverCash(branch, staff._id, payload)).toEqual({ settledIds: [], skippedIds: [String(order._id)] });
  expect((await Order.findById(order._id))!.cashSettlement).toBeNull();
});
test("view-only users can inspect balances but cannot receive cash", async () => {
  staff.permissions = ["cash-settlements:view"]; await staff.save();
  expect((await request(staff)).status).toBe(200);
  const order = await createOrder();
  expect((await request(staff, "POST", { branchId: branch, ...input([order]) })).status).toBe(403);
  expect((await Order.findById(order._id))!.paymentStatus).toBe("PENDING");
});
test("drivers and users without the page permission cannot inspect store balances", async () => {
  expect((await request(driver)).status).toBe(403);
  staff.permissions = ["orders:view", "orders:update"]; await staff.save();
  expect((await request(staff)).status).toBe(403);
});
test("branch changes and duplicate order IDs are rejected before writing", async () => {
  const order = await createOrder(); const payload = input([order]);
  expect((await request(staff, "POST", { ...payload, branchId: String(new Types.ObjectId()) })).status).toBe(409);
  expect((await request(staff, "POST", { ...payload, branchId: branch, orders: [...payload.orders, ...payload.orders] })).status).toBe(400);
  expect((await Order.findById(order._id))!.paymentStatus).toBe("PENDING");
});
test("authorized cashier can settle via the API without general order-edit permissions", async () => {
  const order = await createOrder();
  const response = await request(staff, "POST", { branchId: branch, ...input([order]) });
  expect(response.status).toBe(200);
  expect((await response.json()).data.settledIds).toEqual([String(order._id)]);
});
test("ordinary order edits cannot bypass a receipt or reopen a settled payment", async () => {
  const order = await createOrder();
  await expect(updateOrderStatus(String(order._id), "DELIVERED", "CONFIRMED", branch)).rejects.toMatchObject({ status: 400 });
  await expect(updateOrderStatus(String(order._id), "PROCESSING", undefined, branch)).rejects.toMatchObject({ status: 400 });
  await settleDriverCash(branch, staff._id, input([order]));
  await expect(updateOrderStatus(String(order._id), "DELIVERED", "PENDING", branch)).rejects.toMatchObject({ status: 400 });
});
