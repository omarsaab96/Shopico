import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { existsSync } from "fs";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { RewardToken } from "../models/RewardToken";
import { redeemPointsCoupon, getPersonalCoupons } from "../services/pointsService";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { Branch } from "../models/Branch";
import { Currency } from "../models/Currency";
import { Coupon } from "../models/Coupon";
import { updateCart, syncCart } from "../services/cartService";
import { createOrder, estimateOrderDelivery } from "../services/orderService";
import { cancelCustomerOrder } from "../services/orderCancellationService";
import { previewOrderItemRefund, refundOrderItem } from "../services/orderRefundService";
import { Settings } from "../models/Settings";
import { getRouteDistanceKm } from "../utils/routeDistance";
import { randomUUID } from "crypto";

vi.mock("../utils/routeDistance", () => ({ getRouteDistanceKm: vi.fn(async () => 0) }));
let mongo: MongoMemoryServer;
let branchId: string, userId: Types.ObjectId, currencyId: Types.ObjectId;
let piece: any, grams: any, liquid: any;
beforeAll(async () => {
  const installed = `${process.env.ProgramFiles || "C:/Program Files"}/MongoDB/Server/8.0/bin/mongod.exe`;
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY || (process.platform === "win32" && existsSync(installed) ? installed : undefined);
  mongo = await MongoMemoryServer.create({ binary: { systemBinary, version: "8.0.17" } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([Product.init(), Wallet.init(), User.init(), Coupon.init()]);
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => {
  vi.mocked(getRouteDistanceKm).mockResolvedValue(0);
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

test("fractional delivery distance has identical estimated and charged fees", async () => {
  vi.mocked(getRouteDistanceKm).mockResolvedValue(93.69);
  await Settings.create({ branchId, deliveryFreeKm: 1, deliveryRatePerKm: 5 });
  const estimate = await estimateOrderDelivery(userId, branchId, { lat: 0, lng: 0 });
  await submit(inputs(), "WALLET");
  const order = await Order.findOne({ user: userId }).orFail();
  expect(estimate.deliveryFee).toBe(465);
  expect(order.deliveryFee).toBe(estimate.deliveryFee);
  expect(order.total).toBe(205 + estimate.deliveryFee);
  expect((await Wallet.findOne({ user: userId }).orFail()).balance).toBe(1000 - order.total);
});


const submitWithReward = (paymentMethod: "WALLET" | "CASH_ON_DELIVERY" = "CASH_ON_DELIVERY", couponCodes?: string[]) =>
  createOrder(userId, branchId, { address: "Test address", lat: 0, lng: 0, paymentMethod, items: inputs(), useReward: true, couponCodes });

test("selected points reward reduces the order and wallet charge and consumes one token", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create([{ user: userId }, { user: userId }]);
  const order = await submitWithReward("WALLET");
  expect(order).toMatchObject({ subtotal: 205, discount: 50, total: 155, rewardApplied: true });
  expect((await Wallet.findOne({ user: userId }).orFail()).balance).toBe(845);
  expect(await RewardToken.countDocuments({ user: userId, consumed: true })).toBe(1);
  expect(await RewardToken.countDocuments({ user: userId, consumed: false })).toBe(1);
});

test("a reward remains unused when checkout has not selected it", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const order = await submit();
  expect(order).toMatchObject({ total: 205, rewardApplied: false });
  expect(await RewardToken.countDocuments({ consumed: false })).toBe(1);
});

test("reward discount stacks with coupons and cannot make the total negative", async () => {
  await Settings.create({ branchId, rewardValue: 500 });
  await RewardToken.create({ user: userId });
  await Coupon.create({ branchId, code: "REWARD10", discountType: "PERCENT", discountValue: 10, isActive: true });
  const order = await submitWithReward("CASH_ON_DELIVERY", ["REWARD10"]);
  expect(order).toMatchObject({ couponDiscount: 20.5, discount: 520.5, total: 0, rewardApplied: true });
  expect(await RewardToken.countDocuments({ consumed: true })).toBe(1);
});

test("missing reward rejects checkout instead of charging the undiscounted price", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await expect(submitWithReward("WALLET")).rejects.toMatchObject({ status: 409 });
  expect(await Order.countDocuments()).toBe(0);
  expect((await Wallet.findOne({ user: userId }).orFail()).balance).toBe(1000);
});

test("failed wallet payment releases the selected reward for retry", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  await Wallet.updateOne({ user: userId }, { balance: 0, balances: [{ currency: currencyId, amount: 0 }] });
  await expect(submitWithReward("WALLET")).rejects.toBeDefined();
  expect(await Order.countDocuments()).toBe(0);
  expect(await RewardToken.countDocuments({ consumed: false })).toBe(1);
  const retry = await submitWithReward();
  expect(retry).toMatchObject({ total: 155, rewardApplied: true });
});

test("concurrent checkouts cannot spend the same reward twice", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const results = await Promise.allSettled([submitWithReward(), submitWithReward()]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  expect(await Order.countDocuments({ rewardApplied: true })).toBe(1);
  expect(await RewardToken.countDocuments({ consumed: true })).toBe(1);
});


test("redeeming points creates a personal one-time coupon even with an empty cart", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const coupon = await redeemPointsCoupon(userId, branchId, "personal-coupon-request", String(currencyId));
  expect(coupon).toMatchObject({ discountType: "FIXED", discountValue: 50, usageType: "SINGLE", maxUsesPerUser: 1, maxUsesGlobal: 1 });
  expect(coupon.assignedUsers?.map(String)).toEqual([String(userId)]);
  expect(await RewardToken.countDocuments({ consumed: true })).toBe(1);
  expect((await getPersonalCoupons(userId, branchId)).map(c => c.code)).toEqual([coupon.code]);
  expect(await getPersonalCoupons(new Types.ObjectId(), branchId)).toHaveLength(0);
});

test("retrying the same coupon conversion does not spend another reward", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create([{ user: userId }, { user: userId }]);
  const first = await redeemPointsCoupon(userId, branchId, "retry-coupon-request");
  const retry = await redeemPointsCoupon(userId, branchId, "retry-coupon-request");
  expect(String(retry._id)).toBe(String(first._id));
  expect(await Coupon.countDocuments()).toBe(1);
  expect(await RewardToken.countDocuments({ consumed: false })).toBe(1);
});

test("coupon conversion preserves the reward value in the selected currency", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const foreign = await Currency.create({ branchId, symbol: { en: "USD" }, exchangeRate: 10, isActive: true });
  const coupon = await redeemPointsCoupon(userId, branchId, "currency-coupon-request", String(foreign._id));
  expect(coupon.discountValue).toBe(5);
  const order = await createOrder(userId, branchId, { address: "Test", lat: 0, lng: 0, paymentMethod: "CASH_ON_DELIVERY", currencyId: String(foreign._id), items: inputs(), couponCodes: [coupon.code] });
  expect(order).toMatchObject({ subtotal: 205, couponDiscount: 50, total: 155 });
});

test("saved points coupons apply at checkout once and disappear from the drawer", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const coupon = await redeemPointsCoupon(userId, branchId, "use-personal-coupon");
  const order = await submit(inputs(), "WALLET", [coupon.code]);
  expect(order).toMatchObject({ total: 155, couponDiscount: 50 });
  expect(await getPersonalCoupons(userId, branchId)).toHaveLength(0);
  await expect(submit(inputs(), "CASH_ON_DELIVERY", [coupon.code])).rejects.toMatchObject({ status: 409 });
  expect((await Coupon.findById(coupon._id).orFail()).usedCount).toBe(1);
});

test("personal reward coupons reject another user's checkout", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const coupon = await redeemPointsCoupon(userId, branchId, "private-coupon-request");
  await expect(createOrder(new Types.ObjectId(), branchId, { address: "Test", lat: 0, lng: 0, paymentMethod: "CASH_ON_DELIVERY", items: inputs(), couponCodes: [coupon.code] })).rejects.toMatchObject({ status: 403 });
});

test("failed wallet payment leaves the issued coupon in the drawer for retry", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const coupon = await redeemPointsCoupon(userId, branchId, "failed-payment-coupon");
  await Wallet.updateOne({ user: userId }, { balance: 0, balances: [{ currency: currencyId, amount: 0 }] });
  await expect(submit(inputs(), "WALLET", [coupon.code])).rejects.toBeDefined();
  expect(await getPersonalCoupons(userId, branchId)).toHaveLength(1);
  const retry = await submit(inputs(), "CASH_ON_DELIVERY", [coupon.code]);
  expect(retry).toMatchObject({ total: 155 });
});

test("concurrent orders cannot redeem a personal points coupon twice", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const coupon = await redeemPointsCoupon(userId, branchId, "concurrent-coupon-request");
  const results = await Promise.allSettled([submit(inputs(), "CASH_ON_DELIVERY", [coupon.code]), submit(inputs(), "CASH_ON_DELIVERY", [coupon.code])]);
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  expect((await Coupon.findById(coupon._id).orFail()).usedCount).toBe(1);
});

test("failed coupon creation releases the points reward", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create({ user: userId });
  const create = vi.spyOn(Coupon, "create").mockRejectedValueOnce(new Error("write failed"));
  await expect(redeemPointsCoupon(userId, branchId, "failed-write-coupon-request")).rejects.toThrow("write failed");
  create.mockRestore();
  expect(await RewardToken.countDocuments({ consumed: false })).toBe(1);
});


test("concurrent retries create one coupon and preserve the other reward token", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await RewardToken.create([{ user: userId }, { user: userId }]);
  const results = await Promise.all([
    redeemPointsCoupon(userId, branchId, "same-concurrent-request"),
    redeemPointsCoupon(userId, branchId, "same-concurrent-request"),
  ]);
  expect(String(results[0]._id)).toBe(String(results[1]._id));
  expect(await Coupon.countDocuments()).toBe(1);
  expect(await RewardToken.countDocuments({ consumed: false })).toBe(1);
});

test("no available reward creates no personal coupon", async () => {
  await Settings.create({ branchId, rewardValue: 50 });
  await expect(redeemPointsCoupon(userId, branchId, "no-reward-coupon-request")).rejects.toMatchObject({ status: 409 });
  expect(await Coupon.countDocuments()).toBe(0);
});
