import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { existsSync } from "fs";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { Branch } from "../models/Branch";
import { Currency } from "../models/Currency";
import { Coupon } from "../models/Coupon";
import { updateCart, syncCart } from "../services/cartService";
import { createOrder } from "../services/orderService";
import { cancelCustomerOrder } from "../services/orderCancellationService";
import { previewOrderItemRefund, refundOrderItem } from "../services/orderRefundService";
import { randomUUID } from "crypto";

vi.mock("../utils/routeDistance", () => ({ getRouteDistanceKm: async () => 0 }));
let mongo: MongoMemoryServer;
let branchId: string, userId: Types.ObjectId, currencyId: Types.ObjectId;
let piece: any, grams: any, liquid: any;
beforeAll(async () => {
  const installed = `${process.env.ProgramFiles || "C:/Program Files"}/MongoDB/Server/8.0/bin/mongod.exe`;
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY || (process.platform === "win32" && existsSync(installed) ? installed : undefined);
  mongo = await MongoMemoryServer.create({ binary: { systemBinary, version: "8.0.17" } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([Product.init(), Wallet.init(), User.init()]);
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.models).map(Model => Model.deleteMany({})));
  const branch = await Branch.create({ name: "Test", address: "Test", lat: 0, lng: 0 });
  branchId = String(branch._id);
  const user = await User.create({ name: "Buyer", email: "units@test.com", role: "customer", branchIds: [branchId] });
  userId = user._id;
  const currency = await Currency.create({ branchId, symbol: { en: "SYP" }, exchangeRate: 1, isPrimary: true, isActive: true });
  currencyId = currency._id;
  await Wallet.create({ user: userId, balance: 1000, balances: [{ currency: currencyId, amount: 1000 }] });
  [piece, grams, liquid] = await Product.create([
    { branchId, name: "Box", barcode: "piece", price: 12.5, unitLabel: "علبة" },
    { branchId, name: "Walnuts", barcode: "g", price: 0.6, unit: "g" },
    { branchId, name: "Liquid", barcode: "ml", price: 0.08, unit: "ml" },
  ]);
});
const inputs = () => [
  { productId: String(piece._id), unit: "piece" as const, quantity: 2 },
  { productId: String(grams._id), unit: "g" as const, quantity: 250 },
  { productId: String(liquid._id), unit: "ml" as const, quantity: 375 },
];
const submit = (items = inputs(), paymentMethod: "WALLET" | "CASH_ON_DELIVERY" = "CASH_ON_DELIVERY", couponCodes?: string[]) => createOrder(userId, branchId, { address: "Test address", lat: 0, lng: 0, paymentMethod, items, couponCodes });

test("mixed units produce matching cart, checkout and wallet totals; cancellation returns the full debit", async () => {
  const cart = await syncCart(userId, branchId, inputs());
  expect(cart.subtotal).toBe(205);
  expect(cart.items.map(item => item.unit)).toEqual(["piece", "g", "ml"]);
  await submit(inputs(), "WALLET");
  const order = await Order.findOne({ user: userId }).orFail();
  expect(order.total).toBe(205);
  expect(order.items.map(item => item.unit)).toEqual(["piece", "g", "ml"]);
  expect(order.items[0].unitLabel).toBe("علبة");
  expect((await Wallet.findOne({ user: userId }).orFail()).balance).toBe(795);
  await cancelCustomerOrder(String(order._id), userId);
  expect((await Wallet.findOne({ user: userId }).orFail()).balance).toBe(1000);
});

test("saved-cart checkout uses base units and current server prices", async () => {
  await updateCart(userId, branchId, inputs());
  await Product.updateOne({ _id: grams._id }, { $set: { price: 0.7 } });
  await createOrder(userId, branchId, { address: "Test address", lat: 0, lng: 0, paymentMethod: "CASH_ON_DELIVERY" });
  const order = await Order.findOne({ user: userId }).orFail();
  expect(order.total).toBe(230);
  expect(order.items[1]).toMatchObject({ unit: "g", quantity: 250, price: 0.7 });
});

test("stale units are rejected at cart save and checkout and removed during sync", async () => {
  const stale = [{ productId: String(grams._id), unit: "piece" as const, quantity: 2 }];
  await expect(updateCart(userId, branchId, stale)).rejects.toMatchObject({ status: 409 });
  await expect(submit(stale)).rejects.toMatchObject({ status: 409 });
  const synced = await syncCart(userId, branchId, stale);
  expect(synced.items).toHaveLength(0);
  expect(synced.removedItems).toHaveLength(1);
  expect(await Order.countDocuments()).toBe(0);
});

test("promotional variant prices use the parent's selling unit", async () => {
  grams.variants.push({ price: 0.8, isPromoted: true, promoPrice: 0.5, attributes: { grade: "Premium" } });
  await grams.save();
  await createOrder(userId, branchId, { address: "Test address", lat: 0, lng: 0, paymentMethod: "CASH_ON_DELIVERY", items: [{ productId: String(grams._id), variantId: String(grams.variants[0]._id), quantity: 250, unit: "g" }] });
  expect((await Order.findOne({ user: userId }).orFail()).subtotal).toBe(125);
});

test("product-specific percentage coupons use the measured quantity", async () => {
  await Coupon.create({ branchId, code: "GRAMS10", discountType: "PERCENT", discountValue: 10, assignedProducts: [grams._id], isActive: true });
  await submit(inputs(), "CASH_ON_DELIVERY", ["GRAMS10"]);
  const order = await Order.findOne({ user: userId }).orFail();
  expect(order.discount).toBe(15);
  expect(order.total).toBe(190);
});

test("refunds retain the order's gram unit and rate after the product changes", async () => {
  await submit([{ productId: String(grams._id), unit: "g", quantity: 250 }], "WALLET");
  const order = await Order.findOne({ user: userId }).orFail();
  await Order.updateOne({ _id: order._id }, { $set: { cancellationUntil: new Date(Date.now() - 1) } });
  await Product.updateOne({ _id: grams._id }, { $set: { unit: "piece", price: 500 } });
  const preview = await previewOrderItemRefund(String(order._id), branchId, 0, 50);
  expect(preview.amount).toBe(30);
  await refundOrderItem(String(order._id), branchId, userId, { itemIndex: 0, quantity: 50, requestId: randomUUID(), expectedTotal: preview.expectedTotal, expectedRefundedQuantity: preview.expectedRefundedQuantity, expectedPaymentStatus: preview.expectedPaymentStatus, expectedAmount: preview.amount, expectedWalletAmount: preview.walletAmount, expectedCancelOrder: preview.cancelOrder });
  const updated = await Order.findById(order._id).orFail();
  expect(updated.items[0]).toMatchObject({ unit: "g", quantity: 250, refundedQuantity: 50, price: 0.6 });
  expect(updated.total).toBe(120);
  expect((await Wallet.findOne({ user: userId }).orFail()).balance).toBe(880);
});
