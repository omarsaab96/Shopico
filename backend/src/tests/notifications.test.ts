import { existsSync } from "fs";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server-core";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import jwt from "jsonwebtoken";
import app from "../app";
import { env } from "../config/env";
import { User } from "../models/User";
import { Order } from "../models/Order";
import { TopUpRequest } from "../models/TopUpRequest";
import { WalletTransaction } from "../models/WalletTransaction";
import { Announcement } from "../models/Announcement";
import { Notification, NotificationDevice, NotificationPreferences, NotificationPush } from "../models/Notification";
import { activateNotifications, drainNotificationOutboxes, deliverNotificationPushes } from "../notifications/worker";
import { dispatchEvent } from "../notifications/service";
import { sourceEvents } from "../notifications/outbox";
import { RewardToken } from "../models/RewardToken";
import { Settings } from "../models/Settings";
import { updateOrderStatus, updateOrderStatusAsDriver, updateOrderDetails } from "../services/orderService";
import { signAccessToken } from "../services/tokenService";

let mongo: MongoMemoryServer;
let server: ReturnType<typeof app.listen>;
let base: string;
let customer: any, driver: any, staff: any, outsider: any;
let branch: Types.ObjectId;
const realFetch = globalThis.fetch;
const token = (user: any) => jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: "1h" });
const request = (user: any, path = "", options: RequestInit = {}) => realFetch(`${base}/api/notifications${path}`, { ...options, headers: { Authorization: `Bearer ${token(user)}`, "Content-Type": "application/json", "x-branch-id": String(branch), ...options.headers } });
async function order() {
  return Order.create({ user: customer._id, branchId: branch, items: [{ product: new Types.ObjectId(), quantity: 1, price: 10 }], paymentMethod: "CASH", address: "Test", subtotal: 10, total: 10, deliveryFee: 0, deliveryDistanceKm: 1 });
}
beforeAll(async () => {
  const installed = `${process.env.ProgramFiles || "C:/Program Files"}/MongoDB/Server/8.0/bin/mongod.exe`;
  const systemBinary = process.env.MONGOMS_SYSTEM_BINARY || (process.platform === "win32" && existsSync(installed) ? installed : undefined);
  mongo = await MongoMemoryServer.create({ binary: { systemBinary, version: "8.0.17" } });
  await mongoose.connect(mongo.getUri());
  await Promise.all([Notification.init(), NotificationDevice.init(), NotificationPreferences.init(), NotificationPush.init(), User.init()]);
  server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(Object.values(mongoose.models).map(Model => Model.deleteMany({})));
  await activateNotifications();
  branch = new Types.ObjectId();
  [customer, driver, staff, outsider] = await User.create([
    { name: "Customer", email: "customer@test.com", role: "customer", branchIds: [branch] },
    { name: "Driver", email: "driver@test.com", role: "driver", branchIds: [branch] },
    { name: "Staff", email: "staff@test.com", role: "staff", branchIds: [branch], permissions: ["orders:view", "wallet:topups:view"] },
    { name: "Other branch", email: "other@test.com", role: "staff", branchIds: [new Types.ObjectId()], permissions: ["orders:view"] },
  ]);
});

test("new orders persist an atomic outbox, hide internal data, and deliver only to eligible recipients", async () => {
  const item = await order();
  expect((item.toJSON() as any).notificationOutbox).toBeUndefined();
  expect((item.toObject() as any).notificationOutbox).toBeUndefined();
  expect((await Order.findById(item._id).lean() as any).notificationOutbox[0].type).toBe("ORDER_CREATED");
  await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: customer._id })).toBe(1);
  expect(await Notification.countDocuments({ user: staff._id })).toBe(1);
  expect(await Notification.countDocuments({ user: outsider._id })).toBe(0);
  expect((await Order.findById(item._id).lean() as any).notificationOutbox).toHaveLength(0);
});

test("replaying an event is idempotent, and same-status saves do not send alerts", async () => {
  const item = await order();
  const event = (item as any).notificationOutbox[0];
  await dispatchEvent(event); await dispatchEvent(event); await drainNotificationOutboxes();
  expect(await Notification.countDocuments()).toBe(2);
  item.notes = "Internal note"; await item.save(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments()).toBe(2);
  item.status = "PROCESSING"; await item.save(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ type: "ORDER_STATUS" })).toBe(2);
});

test("assignment, reassignment, removal and payment notify the appropriate accounts", async () => {
  const item = await order(); await drainNotificationOutboxes();
  item.driverId = driver._id; await item.save(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: driver._id, type: "DRIVER_ASSIGNED" })).toBe(1);
  item.driverId = undefined; await item.save(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: driver._id, type: "DRIVER_ASSIGNED" })).toBe(2);
  item.paymentStatus = "CONFIRMED"; await item.save(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: customer._id, type: "PAYMENT_CONFIRMED" })).toBe(1);
});

test("top-up approval waits for completed credit; wallet credit and user changes create alerts", async () => {
  const topup = await TopUpRequest.create({ user: customer._id, branchId: branch, amount: 10, currency: new Types.ObjectId(), method: "CASH_STORE" });
  await drainNotificationOutboxes();
  topup.status = "APPROVED"; await topup.save(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ type: "TOPUP_STATUS" })).toBe(0);
  await WalletTransaction.create({ user: customer._id, currency: topup.currency, amount: 10, balanceAfter: 10, source: "TOPUP", type: "CREDIT", reference: String(topup._id) });
  await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: customer._id, type: "TOPUP_STATUS" })).toBe(1);
  await WalletTransaction.create({ user: customer._id, currency: topup.currency, amount: 15, balanceAfter: 25, source: "ADMIN_TOPUP", type: "CREDIT" });
  customer.points = 12; customer.membershipLevel = "Silver"; await customer.save(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: customer._id, type: { $in: ["WALLET_CREDIT", "POINTS_EARNED", "MEMBERSHIP_CHANGED"] } })).toBe(3);
});

test("announcements respect schedule and disabled state and are sent once", async () => {
  const window = { branchId: branch, startsAt: new Date(Date.now() - 1000), endsAt: new Date(Date.now() + 60000) };
  await Announcement.create([{ ...window, title: "Live" }, { ...window, title: "Disabled", isEnabled: false }, { ...window, title: "Future", startsAt: new Date(Date.now() + 30000) }]);
  await drainNotificationOutboxes(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ type: "ANNOUNCEMENT", user: customer._id })).toBe(1);
});

test("driver delivery awards points and a real reward once and creates their notifications", async () => {
  await Settings.create({ branchId: branch, pointsPerAmount: 1, rewardThresholdPoints: 10 });
  const item = await order(); item.driverId = driver._id; await item.save();
  await updateOrderStatusAsDriver(String(item._id), driver._id, "SHIPPING");
  await updateOrderStatusAsDriver(String(item._id), driver._id, "DELIVERED");
  await updateOrderStatusAsDriver(String(item._id), driver._id, "DELIVERED");
  await drainNotificationOutboxes();
  expect((await User.findById(customer._id).orFail()).points).toBe(10);
  expect(await RewardToken.countDocuments({ user: customer._id })).toBe(1);
  expect(await Notification.countDocuments({ user: customer._id, type: "POINTS_EARNED" })).toBe(1);
  expect(await Notification.countDocuments({ user: customer._id, type: "REWARD_UNLOCKED" })).toBe(1);
});

test("refund alerts wait for settlement and replay exactly once; old refunds are skipped", async () => {
  const item = await order();
  item.refunds.push({ requestId: "refund-1", itemIndex: 0, quantity: 1, amount: 5, walletAmount: 0, disposition: "TOTAL_REDUCTION", settlementStatus: "PENDING", actor: staff._id, at: new Date() });
  await item.save(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ type: "REFUND_COMPLETED" })).toBe(0);
  await Order.updateOne({ _id: item._id }, { $set: { "refunds.0.settlementStatus": "COMPLETED" } });
  await drainNotificationOutboxes(); await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: customer._id, type: "REFUND_COMPLETED" })).toBe(1);
  await Order.updateOne({ _id: item._id }, { $push: { refunds: { requestId: "old-refund", itemIndex: 0, quantity: 1, amount: 1, walletAmount: 0, disposition: "TOTAL_REDUCTION", settlementStatus: "COMPLETED", actor: staff._id, at: new Date(0) } } });
  await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: customer._id, type: "REFUND_COMPLETED" })).toBe(1);
});

test("disabling promotional pushes keeps the announcement in the inbox", async () => {
  await NotificationPreferences.create({ user: customer._id, promotionsEnabled: false });
  await NotificationDevice.create({ user: customer._id, token: "ExpoPushToken[test-device]" });
  await Announcement.create({ branchId: branch, title: "Offer", startsAt: new Date(), endsAt: new Date(Date.now() + 60000) });
  await drainNotificationOutboxes();
  expect(await Notification.countDocuments({ user: customer._id, type: "ANNOUNCEMENT" })).toBe(1);
  expect(await NotificationPush.countDocuments()).toBe(0);
});

test("API protects inbox ownership, staff permissions, preferences and device ownership", async () => {
  await order(); await drainNotificationOutboxes();
  const otherItem = await Notification.findOne({ user: staff._id }).orFail();
  expect((await request(customer, `/${otherItem._id}/read`, { method: "PUT" })).status).toBe(404);
  const own = await (await request(customer)).json() as any;
  expect(own.data.unreadCount).toBe(1);
  await request(customer, "/read-all", { method: "PUT" });
  expect((await (await request(customer)).json() as any).data.unreadCount).toBe(0);
  await User.updateOne({ _id: staff._id }, { $set: { permissions: [] } });
  expect((await (await request(staff)).json() as any).data.items).toHaveLength(0);
  const device = { token: "ExpoPushToken[test-device]", language: "ar" };
  expect((await request(customer, "/devices", { method: "POST", body: JSON.stringify(device) })).status).toBe(200);
  await request(driver, "/devices", { method: "DELETE", body: JSON.stringify(device) });
  expect(await NotificationDevice.countDocuments()).toBe(1);
  await request(driver, "/devices", { method: "POST", body: JSON.stringify(device) });
  expect(String((await NotificationDevice.findOne().orFail()).user)).toBe(String(driver._id));
  expect((await request(customer, "/preferences", { method: "PUT", body: JSON.stringify({ pushEnabled: "yes" }) })).status).toBe(400);
  await request(customer, "/preferences", { method: "PUT", body: JSON.stringify({ pushEnabled: false }) });
  expect((await (await request(customer, "/preferences")).json() as any).data.pushEnabled).toBe(false);
});

test("push delivery stores receipts, removes invalid devices and respects opt-out", async () => {
  await NotificationDevice.create({ user: customer._id, token: "ExpoPushToken[test-device]", language: "ar" });
  await order(); await drainNotificationOutboxes();
  const send = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ status: "ok", id: "receipt-1" }] }), { status: 200 }));
  await deliverNotificationPushes();
  expect(send).toHaveBeenCalledTimes(1);
  const job = await NotificationPush.findOne().orFail(); expect(job.status).toBe("RECEIPT");
  expect(JSON.parse(String(send.mock.calls[0][1]?.body))[0].title).toBe("طلب جديد");
  await NotificationPush.updateOne({ _id: job._id }, { $set: { nextAttempt: new Date(0) } });
  send.mockResolvedValue(new Response(JSON.stringify({ data: { "receipt-1": { status: "error", details: { error: "DeviceNotRegistered" } } } }), { status: 200 }));
  await deliverNotificationPushes();
  expect(await NotificationDevice.countDocuments()).toBe(0);
  expect((await NotificationPush.findById(job._id).orFail()).status).toBe("FAILED");
  await NotificationDevice.create({ user: customer._id, token: "ExpoPushToken[second-device]" });
  await NotificationPreferences.create({ user: customer._id, pushEnabled: false });
  await order(); await drainNotificationOutboxes();
  expect(await NotificationPush.countDocuments()).toBe(1);
});

test("temporary push failures persist retry work instead of losing notifications", async () => {
  await NotificationDevice.create({ user: customer._id, token: "ExpoPushToken[test-device]" });
  await order(); await drainNotificationOutboxes();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
  await deliverNotificationPushes();
  const job = await NotificationPush.findOne().orFail();
  expect(job.status).toBe("PENDING"); expect(job.attempts).toBe(1); expect(job.nextAttempt.getTime()).toBeGreaterThan(Date.now());
});

test("live stream authenticates and delivers a new order event", async () => {
  const controller = new AbortController();
  const response = await request(staff, "/stream", { signal: controller.signal });
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  const initial = decoder.decode((await reader.read()).value);
  expect(initial).toContain("event: ready");
  await order(); await drainNotificationOutboxes();
  let output = "";
  const timeout = setTimeout(() => controller.abort(), 8000);
  try { while (!output.includes("ORDER_CREATED")) { const chunk = await reader.read(); if (chunk.done) break; output += decoder.decode(chunk.value); } }
  finally { clearTimeout(timeout); controller.abort(); }
  expect(output).toContain("event: notification"); expect(output).toContain("ORDER_CREATED");
}, 15000);

test("location-only updates never create customer alerts", () => {
  expect(sourceEvents("order", { status: "SHIPPING", driverId: "driver", paymentStatus: "CONFIRMED" }, { status: "SHIPPING", driverId: "driver", paymentStatus: "CONFIRMED" }, false)).toEqual([]);
});

test("shipping without an assigned driver is rejected without changing status or history", async () => {
  const item = await order();
  await expect(updateOrderStatus(String(item._id), "SHIPPING", undefined, String(branch))).rejects.toMatchObject({ status: 400 });
  const fresh = await Order.findById(item._id).orFail();
  expect(fresh.status).toBe("PENDING");
  expect(fresh.statusHistory).toHaveLength(0);
});

test("shipping assigns the selected branch driver and changes status in one save", async () => {
  const item = await order();
  await updateOrderStatus(String(item._id), "SHIPPING", undefined, String(branch), String(driver._id));
  const fresh = await Order.findById(item._id).orFail();
  expect(fresh.status).toBe("SHIPPING");
  expect(String(fresh.driverId)).toBe(String(driver._id));
  expect(fresh.statusHistory.map(entry => entry.status)).toEqual(["SHIPPING"]);
  await expect(updateOrderDetails(String(item._id), { driverId: null }, String(branch))).rejects.toMatchObject({ status: 400 });
  expect(String((await Order.findById(item._id).orFail()).driverId)).toBe(String(driver._id));
});

test("non-drivers and drivers from another branch cannot be selected for shipping", async () => {
  const item = await order();
  await expect(updateOrderStatus(String(item._id), "SHIPPING", undefined, String(branch), String(customer._id))).rejects.toMatchObject({ status: 400 });
  driver.branchIds = [new Types.ObjectId()]; await driver.save();
  await expect(updateOrderStatus(String(item._id), "SHIPPING", undefined, String(branch), String(driver._id))).rejects.toMatchObject({ status: 400 });
  const fresh = await Order.findById(item._id).orFail();
  expect(fresh.status).toBe("PENDING"); expect(fresh.driverId).toBeNull();
});

test("order editors can fetch a minimal branch driver list without user-directory permission", async () => {
  await User.updateOne({ _id: staff._id }, { $addToSet: { permissions: "orders:update" } });
  const response = await realFetch(`${base}/api/orders/drivers`, { headers: { Authorization: `Bearer ${token(staff)}`, "x-branch-id": String(branch) } });
  expect(response.status).toBe(200);
  const result = await response.json() as any;
  expect(result.data).toHaveLength(1); expect(result.data[0].name).toBe("Driver");
  expect(result.data[0].email).toBeUndefined(); expect(result.data[0].notificationOutbox).toBeUndefined();
});

test("session expiry and warning policy are configurable and use the actual signed token expiry", async () => {
  const previousLifetime = env.jwtExpiresIn, previousWarning = env.sessionExpiryWarningMinutes;
  try {
    env.jwtExpiresIn = "24h";
    const full = jwt.decode(signAccessToken(customer)) as jwt.JwtPayload;
    expect(full.exp! - full.iat!).toBe(24 * 60 * 60);
    env.jwtExpiresIn = "2m"; env.sessionExpiryWarningMinutes = 1;
    const accessToken = signAccessToken(customer);
    const payload = jwt.decode(accessToken) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(120);
    const response = await realFetch(`${base}/api/auth/session`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json() as any;
    expect(result.data.warningMinutes).toBe(1); expect(result.data.expiresAt).toBe(payload.exp! * 1000);
    expect(result.data.serverNow).toBeLessThan(result.data.expiresAt);
    const expired = jwt.sign({ sub: String(customer._id) }, env.jwtSecret, { expiresIn: -1 });
    expect((await realFetch(`${base}/api/auth/session`, { headers: { Authorization: `Bearer ${expired}` } })).status).toBe(401);
  } finally { env.jwtExpiresIn = previousLifetime; env.sessionExpiryWarningMinutes = previousWarning; }
});

test("logout clears the refresh cookie and unbinds only the signed account's device even after expiry", async () => {
  await NotificationDevice.create([{ user: customer._id, token: "ExpoPushToken[customer-device]" }, { user: driver._id, token: "ExpoPushToken[driver-device]" }]);
  const expired = jwt.sign({ sub: String(customer._id) }, env.jwtSecret, { expiresIn: -1 });
  const sendLogout = (deviceToken: string) => realFetch(`${base}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${expired}`, "Content-Type": "application/json" }, body: JSON.stringify({ deviceToken }) });
  await sendLogout("ExpoPushToken[driver-device]"); expect(await NotificationDevice.countDocuments()).toBe(2);
  const response = await sendLogout("ExpoPushToken[customer-device]");
  expect(response.status).toBe(200); expect(response.headers.get("set-cookie")).toContain("refreshToken=;");
  expect(await NotificationDevice.countDocuments()).toBe(1);
});

test("driver assignment alerts deep-link to details and include removal/cancellation messages", async () => {
  const item = await order(); item.driverId = driver._id; await item.save(); await drainNotificationOutboxes();
  const assigned = await Notification.findOne({ user: driver._id, type: "DRIVER_ASSIGNED" }).orFail();
  expect(assigned.data).toMatchObject({ orderId: String(item._id), screen: "driver-order", assignmentState: "ASSIGNED" });
  expect(assigned.body?.en).toContain("assigned to you");
  await updateOrderStatus(String(item._id), "CANCELLED", undefined, String(branch)); await drainNotificationOutboxes();
  const cancelled = await Notification.findOne({ user: driver._id, type: "ORDER_STATUS" }).orFail();
  expect(cancelled.data.assignmentState).toBe("CANCELLED"); expect(cancelled.body?.en).toContain("cancelled");
  await updateOrderDetails(String(item._id), { driverId: null }, String(branch)); await drainNotificationOutboxes();
  const removed = await Notification.findOne({ user: driver._id, type: "DRIVER_ASSIGNED", "data.assignmentState": "REMOVED" }).orFail();
  expect(removed.body?.en).toContain("no longer assigned");
});

test("drivers can access only assigned details, start shipping, and complete a shipping order", async () => {
  const item = await order(); item.driverId = driver._id; await item.save();
  const headers = { Authorization: `Bearer ${token(driver)}` };
  expect((await realFetch(`${base}/api/orders/${item._id}`, { headers })).status).toBe(200);
  await expect(updateOrderStatusAsDriver(String(item._id), driver._id, "DELIVERED")).rejects.toMatchObject({ status: 400 });
  await updateOrderStatusAsDriver(String(item._id), driver._id, "SHIPPING");
  expect((await Order.findById(item._id).orFail()).status).toBe("SHIPPING");
  await updateOrderStatusAsDriver(String(item._id), driver._id, "DELIVERED");
  expect((await Order.findById(item._id).orFail()).status).toBe("DELIVERED");
  await expect(updateOrderStatusAsDriver(String(item._id), driver._id, "SHIPPING")).rejects.toMatchObject({ status: 400 });
  const second = await order();
  expect((await realFetch(`${base}/api/orders/${second._id}`, { headers })).status).toBe(404);
  await expect(updateOrderStatus(String(second._id), "SHIPPING", undefined, String(branch), undefined, String(driver._id))).rejects.toMatchObject({ status: 403 });
});

test("cancelled or unassigned orders cannot be delivered or tracked by a driver", async () => {
  const item = await order(); item.driverId = driver._id; item.status = "CANCELLED"; await item.save();
  await expect(updateOrderStatusAsDriver(String(item._id), driver._id, "SHIPPING")).rejects.toMatchObject({ status: 400 });
  const location = await realFetch(`${base}/api/orders/${item._id}/driver-location`, { method: "PUT", headers: { Authorization: `Bearer ${token(driver)}`, "Content-Type": "application/json" }, body: JSON.stringify({ lat: 33, lng: 36 }) });
  expect(location.status).toBe(400);
  await updateOrderDetails(String(item._id), { driverId: null }, String(branch));
  const detail = await realFetch(`${base}/api/orders/${item._id}`, { headers: { Authorization: `Bearer ${token(driver)}` } });
  expect(detail.status).toBe(404); expect((await detail.json() as any).code).toBe("ORDER_NOT_ASSIGNED");
});

test("mobile renewal restarts the seven-day window and extends only its own push device", async () => {
  const now = Math.floor(Date.now() / 1000);
  const oldRefresh = jwt.sign({ sub: String(customer._id), iat: now - 6 * 86400 }, env.jwtRefreshSecret, { expiresIn: "7d" });
  const expiredCookie = jwt.sign({ sub: String(customer._id), iat: now - 8 * 86400 }, env.jwtRefreshSecret, { expiresIn: "7d" });
  const oldDeadline = new Date((now + 86400) * 1000);
  await NotificationDevice.create([
    { user: customer._id, token: "ExpoPushToken[active-device]", sessionExpiresAt: oldDeadline },
    { user: customer._id, token: "ExpoPushToken[other-device]", sessionExpiresAt: oldDeadline },
  ]);
  const response = await realFetch(`${base}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: `refreshToken=${expiredCookie}` }, body: JSON.stringify({ refreshToken: oldRefresh, deviceToken: "ExpoPushToken[active-device]" }) });
  expect(response.status).toBe(200);
  const { data } = await response.json() as any;
  const refreshed = jwt.decode(data.refreshToken) as jwt.JwtPayload;
  expect(refreshed.exp! - now).toBeGreaterThanOrEqual(7 * 86400);
  const activeDevice = await NotificationDevice.findOne({ token: "ExpoPushToken[active-device]" }).orFail();
  const otherDevice = await NotificationDevice.findOne({ token: "ExpoPushToken[other-device]" }).orFail();
  expect(activeDevice.sessionExpiresAt?.getTime()).toBe(refreshed.exp! * 1000);
  expect(otherDevice.sessionExpiresAt?.getTime()).toBe(oldDeadline.getTime());
});

test("returning after the seven-day refresh window requires login", async () => {
  const now = Math.floor(Date.now() / 1000);
  const expired = jwt.sign({ sub: String(customer._id), iat: now - 8 * 86400 }, env.jwtRefreshSecret, { expiresIn: "7d" });
  const response = await realFetch(`${base}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: expired }) });
  expect(response.status).toBe(401);
});

test("mobile push registration follows its valid refresh token and rejects another user's session", async () => {
  const refresh = jwt.sign({ sub: String(customer._id) }, env.jwtRefreshSecret, { expiresIn: "7d" });
  const device = { token: "ExpoPushToken[rolling-device]", refreshToken: refresh };
  expect((await request(customer, "/devices", { method: "POST", body: JSON.stringify(device) })).status).toBe(200);
  const payload = jwt.decode(refresh) as jwt.JwtPayload;
  expect((await NotificationDevice.findOne({ token: device.token }).orFail()).sessionExpiresAt?.getTime()).toBe(payload.exp! * 1000);
  expect((await request(driver, "/devices", { method: "POST", body: JSON.stringify(device) })).status).toBe(403);
  expect(String((await NotificationDevice.findOne({ token: device.token }).orFail()).user)).toBe(String(customer._id));
});
