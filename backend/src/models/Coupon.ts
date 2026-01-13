import mongoose, { Document, Schema } from "mongoose";

export type CouponDiscountType = "PERCENT" | "FIXED";
export type CouponUsageType = "SINGLE" | "MULTIPLE";
export type CouponMaxUsesScope = "PER_USER" | "GLOBAL";

export interface ICoupon extends Document {
  code: string;
  title?: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  freeDelivery: boolean;
  restricted: boolean;
  expiresAt?: Date;
  assignedUsers?: mongoose.Types.ObjectId[];
  assignedProducts?: mongoose.Types.ObjectId[];
  assignedMembershipLevels?: string[];
  usageType: CouponUsageType;
  maxUses?: number;
  maxUsesScope?: CouponMaxUsesScope;
  maxUsesPerUser?: number;
  maxUsesGlobal?: number;
  usedCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CouponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, index: true },
    title: { type: String },
    description: { type: String },
    discountType: { type: String, enum: ["PERCENT", "FIXED"], required: true },
    discountValue: { type: Number, required: true },
    freeDelivery: { type: Boolean, default: false },
    restricted: { type: Boolean, default: false },
    expiresAt: { type: Date },
    assignedUsers: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    assignedProducts: { type: [Schema.Types.ObjectId], ref: "Product", default: [] },
    assignedMembershipLevels: { type: [String], default: [] },
    usageType: { type: String, enum: ["SINGLE", "MULTIPLE"], default: "SINGLE" },
    maxUses: { type: Number },
    maxUsesScope: { type: String, enum: ["PER_USER", "GLOBAL"], default: "PER_USER" },
    maxUsesPerUser: { type: Number },
    maxUsesGlobal: { type: Number },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>("Coupon", CouponSchema);
