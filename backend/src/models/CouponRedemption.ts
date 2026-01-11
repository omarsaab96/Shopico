import mongoose, { Document, Schema } from "mongoose";

export interface ICouponRedemption extends Document {
  coupon: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  redeemedAt: Date;
}

const CouponRedemptionSchema = new Schema<ICouponRedemption>(
  {
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

CouponRedemptionSchema.index({ coupon: 1, user: 1 });

export const CouponRedemption = mongoose.model<ICouponRedemption>("CouponRedemption", CouponRedemptionSchema);
