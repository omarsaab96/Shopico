import { Types } from "mongoose";
import { Coupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { User } from "../models/User";
import { couponSchema, couponValidateSchema } from "../validators/couponValidators";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";

const normalizeCode = (code: string) => code.trim().toUpperCase();

const ensureValidDiscount = (payload: {
  discountType?: string;
  discountValue?: number;
  freeDelivery?: boolean;
  usageType?: string;
  maxUses?: number;
}) => {
  if (payload.discountType === "PERCENT" && payload.discountValue !== undefined && payload.discountValue > 100) {
    return "Percentage discount cannot exceed 100";
  }
  if (payload.freeDelivery && payload.discountValue && payload.discountValue > 0) {
    return "Coupon cannot have free delivery and a discount at the same time";
  }
  if (!payload.freeDelivery && payload.discountValue !== undefined && payload.discountValue <= 0) {
    return "Discount value must be greater than 0";
  }
  if (payload.usageType === "MULTIPLE" && payload.maxUses !== undefined && payload.maxUses <= 0) {
    return "Max uses must be greater than 0";
  }
  return null;
};

export const listCoupons = catchAsync(async (req, res) => {
  const {
    q,
    consumed,
    enabled,
    expiresFrom,
    expiresTo,
  } = req.query as {
    q?: string;
    consumed?: string;
    enabled?: string;
    expiresFrom?: string;
    expiresTo?: string;
  };
  const filter: Record<string, any> = {};

  if (enabled === "true") filter.isActive = true;
  if (enabled === "false") filter.isActive = false;

  if (expiresFrom) {
    const date = new Date(expiresFrom);
    if (!Number.isNaN(date.getTime())) {
      filter.expiresAt = { ...(filter.expiresAt || {}), $gte: date };
    }
  }
  if (expiresTo) {
    const date = new Date(expiresTo);
    if (!Number.isNaN(date.getTime())) {
      filter.expiresAt = { ...(filter.expiresAt || {}), $lte: date };
    }
  }

  if (q) {
    const isObjectId = Types.ObjectId.isValid(q);
    const users = isObjectId
      ? []
      : await User.find({
          $or: [
            { email: { $regex: q, $options: "i" } },
            { name: { $regex: q, $options: "i" } },
          ],
        }).select("_id");
    const userIds = [
      ...(isObjectId ? [new Types.ObjectId(q)] : []),
      ...users.map((u) => u._id),
    ];
    const orClauses = [
      { code: { $regex: q, $options: "i" } },
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      userIds.length ? { assignedUsers: { $in: userIds } } : null,
    ].filter(Boolean) as Record<string, unknown>[];
    if (orClauses.length) filter.$or = orClauses;
  }

  const coupons = await Coupon.find(filter).sort({ createdAt: -1 }).populate("assignedUsers", "name email");
  if (consumed === "true" || consumed === "false") {
    const wantConsumed = consumed === "true";
    const filtered = coupons.filter((coupon) => {
      const threshold = coupon.usageType === "SINGLE" ? 1 : (coupon.maxUses ?? Number.POSITIVE_INFINITY);
      const isConsumed = coupon.usedCount >= threshold;
      return wantConsumed ? isConsumed : !isConsumed;
    });
    return sendSuccess(res, filtered);
  }
  sendSuccess(res, coupons);
});

export const createCoupon = catchAsync(async (req, res) => {
  const payload = couponSchema.parse(req.body);
  if (payload.freeDelivery && payload.discountValue === undefined) payload.discountValue = 0;
  const error = ensureValidDiscount(payload);
  if (error) return res.status(400).json({ success: false, message: error });
  const code = normalizeCode(payload.code);
  const coupon = await Coupon.create({
    ...payload,
    code,
    assignedUsers: payload.assignedUsers?.length ? payload.assignedUsers.map((id) => new Types.ObjectId(id)) : [],
  });
  sendSuccess(res, coupon, "Coupon created", 201);
});

export const updateCoupon = catchAsync(async (req, res) => {
  const payload = couponSchema.partial().parse(req.body);
  if (payload.freeDelivery && payload.discountValue === undefined) payload.discountValue = 0;
  const error = ensureValidDiscount(payload);
  if (error) return res.status(400).json({ success: false, message: error });
  if (payload.code) payload.code = normalizeCode(payload.code);
  const update: Record<string, any> = { ...payload };
  const unset: Record<string, 1> = {};
  if (Object.prototype.hasOwnProperty.call(req.body, "assignedUsers")) {
    if (payload.assignedUsers && payload.assignedUsers.length > 0) {
      update.assignedUsers = payload.assignedUsers.map((id) => new Types.ObjectId(id));
    } else {
      unset.assignedUsers = 1;
      delete update.assignedUsers;
    }
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "expiresAt") && !payload.expiresAt) {
    unset.expiresAt = 1;
    delete update.expiresAt;
  }
  const coupon = await Coupon.findByIdAndUpdate(
    req.params.id,
    Object.keys(unset).length ? { $set: update, $unset: unset } : update,
    { new: true }
  );
  if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });
  sendSuccess(res, coupon, "Coupon updated");
});

export const deleteCoupon = catchAsync(async (req, res) => {
  const deleted = await Coupon.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, message: "Coupon not found" });
  await CouponRedemption.deleteMany({ coupon: deleted._id });
  sendSuccess(res, deleted, "Coupon deleted");
});

export const validateCoupon = catchAsync(async (req: AuthRequest, res) => {
  const payload = couponValidateSchema.parse(req.body);
  const code = normalizeCode(payload.code);
  const coupon = await Coupon.findOne({ code, isActive: true });
  if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ success: false, message: "Coupon expired" });
  }

  if (coupon.assignedUsers && coupon.assignedUsers.length > 0) {
    const allowed = coupon.assignedUsers.some((id) => id.toString() === req.user?._id.toString());
    if (!allowed) {
      return res.status(403).json({ success: false, message: "Coupon not available for this user" });
    }
  }

  const usedCount = await CouponRedemption.countDocuments({ coupon: coupon._id, user: req.user!._id });
  if (coupon.usageType === "SINGLE" && usedCount > 0) {
    return res.status(400).json({ success: false, message: "Coupon already used" });
  }
  if (coupon.usageType === "MULTIPLE" && coupon.maxUses && usedCount >= coupon.maxUses) {
    return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
  }

  const rawDiscount =
    coupon.discountType === "PERCENT"
      ? (payload.subtotal * coupon.discountValue) / 100
      : coupon.discountValue;
  const maxTotal = payload.subtotal + (payload.deliveryFee || 0);
  const discount = coupon.freeDelivery
    ? 0
    : Math.max(0, Math.min(maxTotal, rawDiscount));
  sendSuccess(res, {
    code: coupon.code,
    discount,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    freeDelivery: coupon.freeDelivery,
  });
});
