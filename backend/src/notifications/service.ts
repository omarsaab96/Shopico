import { Types } from "mongoose";
import { Notification, NotificationDevice, NotificationPreferences, NotificationPush } from "../models/Notification";
import { User } from "../models/User";
import { Currency } from "../models/Currency";

export const staffRoles = ["admin", "manager", "staff"];
export function notificationAccess(user: any, branchId?: string) {
  if (!staffRoles.includes(user.role)) return { user: user._id, permission: { $exists: false } };
  const branches = (user.branchIds || []).map(String);
  const selected = branchId ? branches.filter((id: string) => id === branchId) : branches;
  return { user: user._id, $or: [
    { permission: { $exists: false } },
    { branchId: { $in: selected.map((id: string) => new Types.ObjectId(id)) }, permission: { $in: user.permissions || [] } },
  ] };
}

type Message = { en: string; ar: string };
async function deliver(event: any, user: any, title: Message, body: Message, data: any, permission?: string) {
  const filter = { key: event.key, user: user._id };
  await Notification.updateOne(filter, { $setOnInsert: {
    ...filter, branchId: event.branchId, type: event.type, title, body, data,
    ...(permission ? { permission } : {}),
  } }, { upsert: true });
  const notification = await Notification.findOne(filter).orFail();
  const preferences = await NotificationPreferences.findOne({ user: user._id });
  if (preferences?.pushEnabled === false || (event.type === "ANNOUNCEMENT" && preferences?.promotionsEnabled === false)) return;
  const devices = await NotificationDevice.find({ user: user._id });
  for (const device of devices) {
    await NotificationPush.updateOne({ notification: notification._id, token: device.token }, { $setOnInsert: {
      notification: notification._id, user: user._id, token: device.token, language: device.language,
    } }, { upsert: true });
  }
}

export async function dispatchEvent(event: any) {
  const currency = event.currency ? await Currency.findById(event.currency).lean() : null;
  const moneyEn = `${event.amount} ${currency?.symbol?.en || event.currencyLabel || ""}`.trim();
  const moneyAr = `${event.amount} ${currency?.symbol?.ar || currency?.symbol?.en || event.currencyLabel || ""}`.trim();
  const orderId = event.id;
  const short = String(orderId).slice(-6).toUpperCase();
  const data = event.type.startsWith("ORDER") || ["DRIVER_ASSIGNED", "PAYMENT_CONFIRMED", "REFUND_COMPLETED"].includes(event.type)
    ? { orderId, screen: "order" } : { screen: event.type.startsWith("TOPUP") || event.type === "WALLET_CREDIT" ? "wallet" : event.type === "ANNOUNCEMENT" ? "home" : "points" };
  let title: Message = { en: "Shopico", ar: "شوبيكو" };
  let body: Message = { en: "You have an update.", ar: "لديك تحديث جديد." };
  const statusText: Record<string, Message> = {
    PENDING: { en: "received", ar: "تم استلامه" }, PROCESSING: { en: "being prepared", ar: "قيد التحضير" },
    SHIPPING: { en: "out for delivery", ar: "في الطريق إليك" }, DELIVERED: { en: "delivered", ar: "تم توصيله" },
    CANCELLED: { en: "cancelled", ar: "تم إلغاؤه" },
  };
  switch (event.type) {
    case "ORDER_CREATED": title = { en: "New order", ar: "طلب جديد" }; body = { en: `Order #${short} has been placed.`, ar: `تم استلام الطلب #${short}.` }; break;
    case "ORDER_STATUS": title = { en: "Order update", ar: "تحديث الطلب" }; body = { en: `Order #${short} is ${statusText[event.status]?.en || event.status}.`, ar: `الطلب #${short}: ${statusText[event.status]?.ar || event.status}.` }; break;
    case "DRIVER_ASSIGNED": title = { en: "Delivery assignment", ar: "تعيين التوصيل" }; body = { en: `The driver assignment for order #${short} has changed.`, ar: `تم تحديث السائق المكلّف بالطلب #${short}.` }; break;
    case "PAYMENT_CONFIRMED": title = { en: "Payment confirmed", ar: "تم تأكيد الدفع" }; body = { en: `Payment for order #${short} is confirmed.`, ar: `تم تأكيد دفع الطلب #${short}.` }; break;
    case "REFUND_COMPLETED": title = { en: event.wallet ? "Refund completed" : "Order total reduced", ar: event.wallet ? "تم رد المبلغ" : "تم تخفيض إجمالي الطلب" }; body = { en: event.wallet ? `${event.amount} ${event.currencyLabel || ""} credited to your wallet for order #${short}.` : `Order #${short} total reduced by ${event.amount} ${event.currencyLabel || ""}.`, ar: event.wallet ? `تمت إضافة ${event.amount} ${event.currencyLabel || ""} إلى محفظتك للطلب #${short}.` : `تم تخفيض الطلب #${short} بمقدار ${event.amount} ${event.currencyLabel || ""}.` }; break;
    case "TOPUP_REQUESTED": title = { en: "Wallet top-up requested", ar: "طلب شحن المحفظة" }; body = { en: `A top-up of ${moneyEn} was requested.`, ar: `تم طلب شحن المحفظة بمبلغ ${moneyAr}.` }; break;
    case "TOPUP_STATUS": title = { en: "Wallet top-up update", ar: "تحديث شحن المحفظة" }; body = { en: `Your top-up of ${moneyEn} was ${String(event.status).toLowerCase()}.`, ar: `طلب الشحن بمبلغ ${moneyAr}: ${event.status === "APPROVED" ? "تمت الموافقة" : event.status === "REJECTED" ? "تم الرفض" : "قيد المراجعة"}.` }; break;
    case "WALLET_CREDIT": title = { en: "Wallet credited", ar: "تم شحن المحفظة" }; body = { en: `${moneyEn} was added to your wallet.`, ar: `تمت إضافة ${moneyAr} إلى محفظتك.` }; break;
    case "POINTS_EARNED": title = { en: "Points earned", ar: "نقاط جديدة" }; body = { en: `You earned ${event.amount} points.`, ar: `حصلت على ${event.amount} نقطة.` }; break;
    case "REWARD_UNLOCKED": title = { en: "Reward unlocked", ar: "مكافأة جديدة" }; body = { en: "Your new reward is ready to use.", ar: "مكافأتك الجديدة جاهزة للاستخدام." }; break;
    case "MEMBERSHIP_CHANGED": title = { en: "Membership updated", ar: "تحديث العضوية" }; body = { en: `Your membership is now ${event.membershipLevel}.`, ar: `مستوى عضويتك الآن ${event.membershipLevel}.` }; data.screen = "membership"; break;
    case "ANNOUNCEMENT": title = { en: event.title || "Shopico news", ar: event.title || "أخبار شوبيكو" }; body = { en: event.description || "See what's new in Shopico.", ar: event.description || "اطّلع على جديد شوبيكو." }; break;
    default: return;
  }
  const ids = new Set<string>();
  if (event.user) ids.add(String(event.user));
  if (event.type.startsWith("ORDER") || event.type === "DRIVER_ASSIGNED" || event.type === "REFUND_COMPLETED") {
    if (event.driverId) ids.add(String(event.driverId));
    if (event.previousDriverId) ids.add(String(event.previousDriverId));
  }
  if (event.type === "ANNOUNCEMENT") {
    const customers = User.find({ role: "customer", branchIds: event.branchId }).cursor();
    for await (const user of customers) await deliver(event, user, title, body, data);
    return;
  }
  const recipients = await User.find({ _id: { $in: [...ids] } });
  for (const user of recipients) {
    const recipientBody = event.type === "DRIVER_ASSIGNED" && user.role === "driver"
      ? { en: String(user._id) === event.driverId ? `Order #${short} is assigned to you.` : `Order #${short} is no longer assigned to you.`, ar: String(user._id) === event.driverId ? `تم تكليفك بالطلب #${short}.` : `لم تعد مكلّفاً بالطلب #${short}.` } : body;
    const recipientData = user.role === "driver" && data.orderId ? {
      ...data, screen: "driver-order",
      assignmentState: event.type === "DRIVER_ASSIGNED" ? (String(user._id) === event.driverId ? "ASSIGNED" : "REMOVED") : event.type === "ORDER_STATUS" && event.status === "CANCELLED" ? "CANCELLED" : undefined,
    } : data;
    await deliver(event, user, title, recipientBody, recipientData);
  }
  const permission = event.type.startsWith("ORDER") || ["DRIVER_ASSIGNED", "PAYMENT_CONFIRMED", "REFUND_COMPLETED"].includes(event.type)
    ? "orders:view" : event.type.startsWith("TOPUP") ? "wallet:topups:view" : undefined;
  if (permission && event.branchId) {
    const staff = User.find({ role: { $in: staffRoles }, branchIds: event.branchId, permissions: permission }).cursor();
    for await (const user of staff) if (!ids.has(String(user._id))) await deliver(event, user, title, body, data, permission);
  }
}
