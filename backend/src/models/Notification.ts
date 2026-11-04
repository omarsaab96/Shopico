import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema({
  key: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: "Branch" },
  permission: String,
  type: { type: String, required: true },
  title: { en: String, ar: String },
  body: { en: String, ar: String },
  data: { type: Schema.Types.Mixed, default: {} },
  readAt: { type: Date, default: null },
}, { timestamps: true });
NotificationSchema.index({ key: 1, user: 1 }, { unique: true });
NotificationSchema.index({ user: 1, createdAt: -1 });
export const Notification = mongoose.model("Notification", NotificationSchema);

const DeviceSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  token: { type: String, required: true, unique: true },
  language: { type: String, enum: ["en", "ar"], default: "en" },
  sessionExpiresAt: Date,
}, { timestamps: true });
export const NotificationDevice = mongoose.model("NotificationDevice", DeviceSchema);

const PreferencesSchema = new Schema({
  user: { type: Schema.Types.ObjectId, required: true, unique: true },
  pushEnabled: { type: Boolean, default: true },
  promotionsEnabled: { type: Boolean, default: true },
}, { timestamps: true });
export const NotificationPreferences = mongoose.model("NotificationPreferences", PreferencesSchema);

const PushSchema = new Schema({
  notification: { type: Schema.Types.ObjectId, required: true },
  user: { type: Schema.Types.ObjectId, required: true },
  token: { type: String, required: true },
  language: { type: String, default: "en" },
  status: { type: String, enum: ["PENDING", "RECEIPT", "DONE", "FAILED"], default: "PENDING" },
  attempts: { type: Number, default: 0 },
  nextAttempt: { type: Date, default: Date.now },
  receiptId: String,
  error: String,
  lockedUntil: { type: Date, default: () => new Date(0) },
}, { timestamps: true });
PushSchema.index({ notification: 1, token: 1 }, { unique: true });
PushSchema.index({ status: 1, nextAttempt: 1, lockedUntil: 1 });
export const NotificationPush = mongoose.model("NotificationPush", PushSchema);

export const NotificationRuntime = mongoose.model("NotificationRuntime", new Schema({
  _id: { type: String, default: "activation" },
  activatedAt: { type: Date, required: true },
}));
