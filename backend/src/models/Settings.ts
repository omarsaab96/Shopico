import mongoose, { Document, Schema } from "mongoose";

export interface IMembershipThresholds {
  silver: number;
  gold: number;
  platinum: number;
  diamond: number;
}

export interface ISettings extends Document {
  branchId: Schema.Types.ObjectId;
  storeLat: number;
  storeLng: number;
  deliveryFreeKm: number;
  deliveryRatePerKm: number;
  allowMultipleCoupons: boolean;
  membershipGraceDays: number;
  membershipThresholds: IMembershipThresholds;
  pointsPerAmount: number;
  rewardThresholdPoints: number;
  rewardValue: number;
  createdAt: Date;
  updatedAt: Date;
}

const MembershipThresholdSchema = new Schema<IMembershipThresholds>(
  {
    silver: { type: Number, default: 1000000 },
    gold: { type: Number, default: 2000000 },
    platinum: { type: Number, default: 4000000 },
    diamond: { type: Number, default: 6000000 },
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    storeLat: { type: Number, default: 0 },
    storeLng: { type: Number, default: 0 },
    deliveryFreeKm: { type: Number, default: 1 },
    deliveryRatePerKm: { type: Number, default: 5000 },
    allowMultipleCoupons: { type: Boolean, default: false },
    membershipGraceDays: { type: Number, default: 14 },
    membershipThresholds: { type: MembershipThresholdSchema, default: () => ({}) },
    pointsPerAmount: { type: Number, default: 10000 },
    rewardThresholdPoints: { type: Number, default: 100 },
    rewardValue: { type: Number, default: 80000 },
  },
  { timestamps: true }
);

SettingsSchema.index({ branchId: 1 }, { unique: true });

export const Settings = mongoose.model<ISettings>("Settings", SettingsSchema);
