import mongoose from "mongoose";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { TopUpRequest } from "../models/TopUpRequest";
import { WalletTransaction } from "../models/WalletTransaction";
import { Announcement } from "../models/Announcement";
import { Currency } from "../models/Currency";
import { RewardToken } from "../models/RewardToken";
import { Notification, NotificationDevice, NotificationPreferences, NotificationPush, NotificationRuntime } from "../models/Notification";
import { dispatchEvent, notificationAccess } from "./service";

export async function activateNotifications() {
  return NotificationRuntime.findOneAndUpdate({ _id: "activation" }, { $setOnInsert: { activatedAt: new Date() } }, { upsert: true, new: true }).orFail();
}

export async function drainNotificationOutboxes() {
  const { activatedAt } = await activateNotifications();
  for (const Model of [Order, User, TopUpRequest, WalletTransaction, RewardToken] as mongoose.Model<any>[]) {
    const sources = Model.find({ "notificationOutbox.0": { $exists: true } }).select("notificationOutbox").lean().cursor();
    for await (const source of sources) {
      for (const event of source.notificationOutbox || []) {
        // Approval is announced only after the wallet credit has actually completed.
        if (event.type === "TOPUP_STATUS" && event.status === "APPROVED" && !await WalletTransaction.exists({ source: "TOPUP", reference: event.id, type: "CREDIT" })) continue;
        await dispatchEvent(event);
        await Model.updateOne({ _id: source._id }, { $pull: { notificationOutbox: { key: event.key } } });
      }
    }
  }
  // Refunds have their own recovery mechanism; the stable key safely covers replay.
  const refunds = Order.find({ refunds: { $elemMatch: { at: { $gte: activatedAt }, settlementStatus: "COMPLETED", notificationSent: { $ne: true } } } }).cursor();
  for await (const order of refunds) {
    for (const refund of order.refunds as any[]) {
      if (refund.settlementStatus !== "COMPLETED" || refund.notificationSent || refund.at < activatedAt) continue;
      const currency = refund.currency ? await Currency.findById(refund.currency).lean() : null;
      await dispatchEvent({ key: `refund:${order._id}:${refund.requestId}`, type: "REFUND_COMPLETED", notifyStaff: false, id: String(order._id), user: String(order.user), branchId: String(order.branchId), driverId: order.driverId ? String(order.driverId) : undefined, amount: refund.disposition === "WALLET" ? refund.walletAmount : refund.amount, wallet: refund.disposition === "WALLET", currencyLabel: (currency?.symbol as any)?.en || "" });
      await Order.updateOne({ _id: order._id, "refunds.requestId": refund.requestId }, { $set: { "refunds.$.notificationSent": true } });
    }
  }
  const now = new Date();
  const announcements = Announcement.find({ isEnabled: true, startsAt: { $lte: now }, endsAt: { $gte: now }, notificationSent: { $ne: true }, $or: [{ startsAt: { $gte: activatedAt } }, { createdAt: { $gte: activatedAt } }] }).cursor();
  for await (const announcement of announcements) {
    await dispatchEvent({ key: `announcement:${announcement._id}`, type: "ANNOUNCEMENT", branchId: String(announcement.branchId), title: announcement.title, description: announcement.description });
    await Announcement.updateOne({ _id: announcement._id }, { $set: { notificationSent: true } });
  }
}

async function expoRequest(path: string, payload: any) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Expo HTTP ${response.status}`);
  const json = await response.json() as any;
  if (json.errors?.length || !json.data) throw new Error("Expo rejected the request");
  return json.data;
}

export async function deliverNotificationPushes() {
  // Atomic leases allow multiple server processes to share this queue.
  for (let count = 0; count < 100; count++) {
    const now = new Date();
    const job = await NotificationPush.findOneAndUpdate({ status: { $in: ["PENDING", "RECEIPT"] }, nextAttempt: { $lte: now }, lockedUntil: { $lte: now } }, { $set: { lockedUntil: new Date(Date.now() + 60000) } }, { new: true });
    if (!job) return;
    try {
      const [user, device, preferences] = await Promise.all([User.findById(job.user), NotificationDevice.findOne({ token: job.token, user: job.user }), NotificationPreferences.findOne({ user: job.user })]);
      const notification = user ? await Notification.findOne({ _id: job.notification, ...notificationAccess(user) }) : null;
      if (!notification || !device || (device.sessionExpiresAt && device.sessionExpiresAt <= now) || preferences?.pushEnabled === false || (notification.type === "ANNOUNCEMENT" && preferences?.promotionsEnabled === false)) {
        job.status = "DONE";
      } else {
        let result: any;
        if (job.status === "PENDING") {
          const lang = job.language === "ar" ? "ar" : "en";
          const badge = await Notification.countDocuments({ ...notificationAccess(user), readAt: null });
          const tickets = await expoRequest("send", [{ to: job.token, title: notification.title?.[lang], body: notification.body?.[lang], badge, sound: "default", channelId: "orders", data: { ...notification.data, notificationId: String(notification._id) } }]);
          result = tickets[0];
          if (result?.status === "ok" && result.id) {
            job.receiptId = result.id; job.status = "RECEIPT"; job.attempts = 0; job.nextAttempt = new Date(Date.now() + 15 * 60000);
          }
        } else {
          const receipts = await expoRequest("getReceipts", { ids: [job.receiptId] });
          result = receipts[job.receiptId!];
          if (result?.status === "ok") job.status = "DONE";
        }
        if (result?.status === "error") {
          const code = result.details?.error;
          if (code === "DeviceNotRegistered") {
            await NotificationDevice.deleteOne({ token: job.token, user: job.user }); job.status = "FAILED"; job.error = code;
          } else if (["MessageTooBig", "MismatchSenderId", "InvalidCredentials"].includes(code)) {
            job.status = "FAILED"; job.error = code;
          } else throw new Error(code || "Expo delivery error");
        } else if (!result || !["ok", "error"].includes(result.status)) throw new Error("Expo receipt not available");
      }
    } catch (error: any) {
      job.attempts += 1; job.error = String(error.message || error).slice(0, 200);
      if (job.attempts >= 10) job.status = "FAILED";
      job.nextAttempt = new Date(Date.now() + Math.min(3600000, 10000 * 2 ** job.attempts));
    }
    job.lockedUntil = new Date(0);
    await job.save();
  }
}

export function startNotificationWorker() {
  let draining = false, pushing = false;
  const drain = async () => {
    if (draining) return; draining = true;
    try { await drainNotificationOutboxes(); } catch (error) { console.error("Notification outbox will retry", error); } finally { draining = false; }
  };
  const push = async () => {
    if (pushing) return; pushing = true;
    try { await deliverNotificationPushes(); } catch (error) { console.error("Notification delivery will retry", error); } finally { pushing = false; }
  };
  void drain(); void push();
  const timer = setInterval(() => { void drain(); void push(); }, 2000);
  timer.unref();
  return () => clearInterval(timer);
}
