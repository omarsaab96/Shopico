import mongoose, { Document, Schema } from "mongoose";

export type CouponDiscountType = "PERCENT" | "FIXED";
export type CouponUsageType = "SINGLE" | "MULTIPLE";

export interface ICoupon extends Document {
  code: string;
  title?: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  freeDelivery: boolean;
  expiresAt?: Date;
  assignedUsers?: mongoose.Types.ObjectId[];
  usageType: CouponUsageType;
  maxUses?: number;
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
    expiresAt: { type: Date },
    assignedUsers: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    usageType: { type: String, enum: ["SINGLE", "MULTIPLE"], default: "SINGLE" },
    maxUses: { type: Number },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>("Coupon", CouponSchema);
