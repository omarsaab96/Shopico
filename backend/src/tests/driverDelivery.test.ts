import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { updateOrderStatusAsDriver, updateOrderStatus, assignDriverToOrder, updateOrderDetails, updateOrderDriverLocation } from "../services/orderService";
import { DriverDeliveryConflictError } from "../utils/driverDelivery";
import { errorHandler } from "../middleware/errorHandler";

let mongo: MongoMemoryServer;
let driverId: Types.ObjectId;
let branchId: Types.ObjectId;
let userId: Types.ObjectId;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: "8.0.17" } });
  await mongoose.connect(mongo.getUri(), { dbName: "single_driver_delivery_tests" });
  await Promise.all([Order.init(), User.init()]);
}, 120000);
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await Order.deleteMany({});
  await User.deleteMany({});
  branchId = new Types.ObjectId();
  const driver = await User.create({ name: "Driver", email: "driver@example.com", role: "driver", branchIds: [branchId] });
  driverId = driver._id;
  userId = (await User.create({ name: "Customer", email: "customer@example.com", role: "customer", branchIds: [branchId] }))._id;
});
const makeOrder = (overrides: Record<string, unknown> = {}) => Order.create({
  user: userId, driverId, branchId, status: "PROCESSING", paymentMethod: "CASH_ON_DELIVERY", paymentStatus: "PENDING",
  subtotal: 100, deliveryFee: 0, deliveryDistanceKm: 1, total: 100, address: "Test address", items: [{ product: new Types.ObjectId(), quantity: 1, price: 100 }], ...overrides,
});
const start = (id: unknown) => updateOrderStatusAsDriver(String(id), driverId, "SHIPPING");

describe("one active delivery per driver", () => {
  it("requires the driver to start a staff-readied shipping order before completion or tracking", async () => {
    const order = await makeOrder();
    await updateOrderStatus(String(order._id), "SHIPPING");
    const ready = await Order.findById(order._id).orFail();
    expect(ready.driverStartedAt).toBeNull();
    await expect(updateOrderStatusAsDriver(String(order._id), driverId, "DELIVERED")).rejects.toMatchObject({ status: 400 });
    await expect(updateOrderDriverLocation(String(order._id), driverId, 33, 36)).rejects.toMatchObject({ status: 400 });
    await start(order._id);
    const started = await Order.findById(order._id).orFail();
    expect(started.status).toBe("SHIPPING");
    expect(started.driverStartedAt).toBeInstanceOf(Date);
    expect(String(started.driverStartedBy)).toBe(String(driverId));
    await updateOrderDriverLocation(String(order._id), driverId, 33, 36);
    await updateOrderStatusAsDriver(String(order._id), driverId, "DELIVERED");
  });
  it("preserves the original start time when a start request is retried", async () => {
    const order = await makeOrder();
    await start(order._id);
    const original = (await Order.findById(order._id).orFail()).driverStartedAt;
    await start(order._id);
    expect((await Order.findById(order._id).orFail()).driverStartedAt).toEqual(original);
  });
  it("requires a new driver to start again after reassignment", async () => {
    const order = await makeOrder();
    await start(order._id);
    const next = await User.create({ name: "Other driver", email: "other@example.com", role: "driver", branchIds: [branchId] });
    await assignDriverToOrder(String(order._id), String(next._id));
    const ready = await Order.findById(order._id).orFail();
    expect(ready.driverStartedAt).toBeNull();
    expect(ready.driverStartedBy).toBeNull();
    await expect(updateOrderStatusAsDriver(String(order._id), next._id, "DELIVERED")).rejects.toMatchObject({ status: 400 });
    await updateOrderStatusAsDriver(String(order._id), next._id, "SHIPPING");
    expect(String((await Order.findById(order._id).orFail()).driverStartedBy)).toBe(String(next._id));
  });

  it("allows queued assignments but blocks starting a second delivery", async () => {
    const first = await makeOrder();
    const second = await makeOrder();
    await start(first._id);
    await expect(start(second._id)).rejects.toMatchObject({ status: 409, code: "DRIVER_ALREADY_DELIVERING" });
    expect((await Order.findById(second._id))?.status).toBe("PROCESSING");
    expect(await Order.countDocuments({ driverId, status: "SHIPPING" })).toBe(1);
  });
  it("enforces the constraint when two status updates race at the database", async () => {
    const first = await makeOrder();
    const second = await makeOrder();
    const results = await Promise.allSettled([
      Order.updateOne({ _id: first._id }, { $set: { status: "SHIPPING" } }),
      Order.updateOne({ _id: second._id }, { $set: { status: "SHIPPING" } }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await Order.countDocuments({ driverId, status: "SHIPPING" })).toBe(1);
    const failed = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason.code).toBe(11000);
  });
  it("allows only one of two simultaneous driver start requests", async () => {
    const first = await makeOrder();
    const second = await makeOrder();
    const results = await Promise.allSettled([start(first._id), start(second._id)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await Order.countDocuments({ driverId, status: "SHIPPING" })).toBe(1);
    expect(await Order.countDocuments({ driverId, status: "PROCESSING" })).toBe(1);
  });
  it("allows another delivery after completion or cancellation", async () => {
    const first = await makeOrder();
    const second = await makeOrder();
    const third = await makeOrder();
    await start(first._id);
    await updateOrderStatusAsDriver(String(first._id), driverId, "DELIVERED");
    await start(second._id);
    await updateOrderStatus(String(second._id), "CANCELLED");
    await start(third._id);
    expect(await Order.countDocuments({ driverId, status: "SHIPPING" })).toBe(1);
  });
  it("blocks staff from shipping or assigning a shipping order to an occupied driver", async () => {
    const first = await makeOrder();
    const second = await makeOrder();
    await start(first._id);
    await expect(updateOrderStatus(String(second._id), "SHIPPING")).rejects.toMatchObject({ status: 409 });
    const otherDriver = await User.create({ name: "Other", email: "other@example.com", role: "driver", branchIds: [branchId] });
    const otherOrder = await makeOrder({ driverId: otherDriver._id, status: "SHIPPING" });
    await expect(assignDriverToOrder(String(otherOrder._id), String(driverId))).rejects.toMatchObject({ status: 409 });
    await expect(updateOrderDetails(String(otherOrder._id), { driverId: String(driverId) })).rejects.toMatchObject({ status: 409 });
    expect((await Order.findById(otherOrder._id))?.driverId?.toString()).toBe(String(otherDriver._id));
  });
  it("allows retries on the current delivery and location saves", async () => {
    const order = await makeOrder();
    await start(order._id);
    await start(order._id);
    const saved = await Order.findById(order._id).orFail();
    saved.driverLocation = { lat: 33.5, lng: 36.3, updatedAt: new Date() };
    await saved.save();
    expect((await Order.findById(order._id))?.driverLocation?.lat).toBe(33.5);
  });
  it("enforces a single delivery across branches", async () => {
    await makeOrder({ status: "SHIPPING" });
    const second = await makeOrder({ branchId: new Types.ObjectId() });
    await expect(second.updateOne({ $set: { status: "SHIPPING" } })).rejects.toMatchObject({ code: 11000 });
  });
});

it.each([
  new DriverDeliveryConflictError(),
  { code: 11000, keyPattern: { driverId: 1 } },
])("returns a localized-client-compatible conflict for normal and racing starts", error => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  errorHandler(error, {} as any, res as any, vi.fn());
  expect(res.status).toHaveBeenCalledWith(409);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "DRIVER_ALREADY_DELIVERING" }));
});
