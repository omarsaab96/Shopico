import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { AuthRequest } from "../types/auth";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { Notification, NotificationDevice, NotificationPreferences } from "../models/Notification";
import { User } from "../models/User";
import { notificationAccess } from "../notifications/service";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

const router = Router();
router.use(authenticate);
const access = (req: AuthRequest) => {
  const selected = req.headers["x-branch-id"];
  return notificationAccess(req.user, typeof selected === "string" && Types.ObjectId.isValid(selected) ? selected : undefined);
};
router.get("/", catchAsync(async (req: AuthRequest, res) => {
  const before = typeof req.query.before === "string" && Types.ObjectId.isValid(req.query.before) ? req.query.before : undefined;
  const filter = access(req);
  const [items, unreadCount] = await Promise.all([
    Notification.find({ ...filter, ...(before ? { _id: { $lt: before } } : {}) }).sort({ _id: -1 }).limit(50).lean(),
    Notification.countDocuments({ ...filter, readAt: null }),
  ]);
  sendSuccess(res, { items, unreadCount, nextCursor: items.length === 50 ? String(items[49]._id) : null });
}));
router.get("/preferences", catchAsync(async (req: AuthRequest, res) => {
  sendSuccess(res, await NotificationPreferences.findOne({ user: req.user!._id }).lean() || { pushEnabled: true, promotionsEnabled: true });
}));
router.put("/preferences", catchAsync(async (req: AuthRequest, res) => {
  const value = z.object({ pushEnabled: z.boolean().optional(), promotionsEnabled: z.boolean().optional() }).parse(req.body);
  sendSuccess(res, await NotificationPreferences.findOneAndUpdate({ user: req.user!._id }, { $set: value }, { upsert: true, new: true }));
}));
router.post("/devices", catchAsync(async (req: AuthRequest, res) => {
  const value = z.object({ token: z.string().max(200).regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/), language: z.enum(["en", "ar"]).default("en"), refreshToken: z.string().max(4096).optional() }).parse(req.body);
  let payload = jwt.decode(req.headers.authorization!.substring(7)) as jwt.JwtPayload;
  if (value.refreshToken) {
    try {
      payload = jwt.verify(value.refreshToken, env.jwtRefreshSecret) as jwt.JwtPayload;
      if (payload.sub !== String(req.user!._id)) return res.status(403).json({ success: false, message: "Invalid device session" });
    } catch { return res.status(401).json({ success: false, message: "Session expired" }); }
  }
  await NotificationDevice.updateOne({ token: value.token }, { $set: { user: req.user!._id, language: value.language, sessionExpiresAt: new Date(payload.exp! * 1000) } }, { upsert: true });
  sendSuccess(res, { registered: true });
}));
router.delete("/devices", catchAsync(async (req: AuthRequest, res) => {
  const { token } = z.object({ token: z.string().max(200) }).parse(req.body);
  await NotificationDevice.deleteOne({ token, user: req.user!._id });
  sendSuccess(res, { removed: true });
}));
router.put("/read-all", catchAsync(async (req: AuthRequest, res) => {
  await Notification.updateMany({ ...access(req), readAt: null }, { $set: { readAt: new Date() } });
  sendSuccess(res, { read: true });
}));
router.put("/:id/read", catchAsync(async (req: AuthRequest, res) => {
  if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: "Invalid notification ID" });
  const item = await Notification.findOneAndUpdate({ ...access(req), _id: req.params.id }, { $set: { readAt: new Date() } }, { new: true });
  if (!item) return res.status(404).json({ success: false, message: "Notification not found" });
  sendSuccess(res, item);
}));
router.get("/stream", catchAsync(async (req: AuthRequest, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  res.flushHeaders();
  let closed = false, running = false;
  const latest = await Notification.findOne(access(req)).sort({ _id: -1 }).select("_id");
  const since = req.query.since;
  let cursor = typeof since === "string" && Types.ObjectId.isValid(since) ? since : latest?._id.toString();
  res.write(`event: ready\ndata: ${JSON.stringify({ cursor })}\n\n`);
  const tick = async () => {
    if (closed || running) return; running = true;
    try {
      // Recheck roles, branch membership and permissions throughout a long-lived connection.
      jwt.verify(req.headers.authorization!.substring(7), env.jwtSecret);
      const user = await User.findById(req.user!._id);
      if (!user) { res.end(); return; }
      req.user = user;
      const items = await Notification.find({ ...access(req), ...(cursor ? { _id: { $gt: cursor } } : {}) }).sort({ _id: 1 }).limit(100).lean();
      for (const item of items) { if (closed) break; res.write(`id: ${item._id}\nevent: notification\ndata: ${JSON.stringify(item)}\n\n`); cursor = String(item._id); }
      if (!closed) res.write(": heartbeat\n\n");
    } catch { if (!closed) res.end(); } finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, 2000);
  const cleanup = () => { closed = true; clearInterval(timer); };
  res.on("close", cleanup);
  void tick();
}));
export default router;
