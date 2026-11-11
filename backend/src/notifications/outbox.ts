import { Schema, Types } from "mongoose";

// The event is saved atomically with its source document, including on standalone MongoDB.
// Delivery workers remove only acknowledged events; unique recipient keys make replay safe.
export function notificationOutbox(schema: Schema<any>, kind: string) {
  schema.add({ notificationOutbox: { type: [Schema.Types.Mixed], default: [] } });
  schema.index({ "notificationOutbox.0": 1 });
  const hideOutbox = (_doc: any, ret: any) => { delete ret.notificationOutbox; return ret; };
  schema.set("toJSON", { transform: hideOutbox });
  schema.set("toObject", { transform: hideOutbox });
  schema.post("init", function(doc: any) {
    doc.$locals.notificationBefore = snapshot(doc);
  });
  schema.pre("save", function(this: any) {
    const before = this.$locals.notificationBefore || {};
    const after = snapshot(this);
    const events = sourceEvents(kind, before, after, this.isNew);
    for (const event of events) {
      if (kind === "order" && this.$locals.notifyStaff === false) event.notifyStaff = false;
      // Mongoose persists these pushes in the same atomic source-document save.
      this.notificationOutbox.push({ ...event, key: new Types.ObjectId().toString(), at: new Date() });
    }
  });
  schema.post("save", function(doc: any) {
    doc.$locals.notificationBefore = snapshot(doc);
    delete doc.$locals.notifyStaff;
  });
}

function snapshot(doc: any) {
  return {
    id: String(doc._id), user: doc.user ? String(doc.user._id || doc.user) : String(doc._id),
    branchId: doc.branchId ? String(doc.branchId._id || doc.branchId) : undefined,
    branchIds: (doc.branchIds || []).map(String), role: doc.role,
    cancellationUntil: doc.cancellationUntil,
    status: doc.status, paymentStatus: doc.paymentStatus,
    driverId: doc.driverId ? String(doc.driverId._id || doc.driverId) : undefined,
    points: doc.points, membershipLevel: doc.membershipLevel,
    amount: doc.amount, currency: doc.currency ? String(doc.currency._id || doc.currency) : undefined,
    source: doc.source, reference: doc.reference, type: doc.type,
  };
}

export function sourceEvents(kind: string, before: any, after: any, isNew: boolean): any[] {
  const events: any[] = [];
  const add = (type: string, extra = {}) => events.push({ ...after, type, ...extra });
  if (kind === "order") {
    if (isNew) { add("ORDER_CREATED", after.cancellationUntil ? { notBefore: after.cancellationUntil } : {}); if (after.paymentStatus === "CONFIRMED") add("PAYMENT_CONFIRMED", after.cancellationUntil ? { notifyStaff: false } : {}); }
    else {
      if (before.status !== after.status) add("ORDER_STATUS");
      if (before.driverId !== after.driverId) add("DRIVER_ASSIGNED", { previousDriverId: before.driverId });
      if (before.paymentStatus !== after.paymentStatus && after.paymentStatus === "CONFIRMED") add("PAYMENT_CONFIRMED");
    }
  }
  if (kind === "topup" && (isNew || before.status !== after.status)) add(isNew ? "TOPUP_REQUESTED" : "TOPUP_STATUS");
  if (kind === "wallet" && isNew && after.source === "ADMIN_TOPUP") add("WALLET_CREDIT");
  if (kind === "reward" && isNew) add("REWARD_UNLOCKED");
  if (kind === "user" && !isNew) {
    if (after.points > before.points) add("POINTS_EARNED", { amount: after.points - before.points });
    if (before.membershipLevel !== after.membershipLevel) add("MEMBERSHIP_CHANGED");
  }
  return events;
}
