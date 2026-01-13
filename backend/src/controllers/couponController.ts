import { Types } from "mongoose";
import { Coupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { User } from "../models/User";
import { Product } from "../models/Product";
import { couponSchema, couponValidateSchema } from "../validators/couponValidators";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";

const normalizeCode = (code: string) => code.trim().toUpperCase();

const resolveAssignments = (payload: {
  assignedUsers?: string[] | null;
  assignedProducts?: string[] | null;
  assignedMembershipLevels?: string[] | null;
}) => {
  const users = payload.assignedUsers || [];
  const products = payload.assignedProducts || [];
  const levels = payload.assignedMembershipLevels || [];
  const hasUsers = users.length > 0;
  const hasProducts = products.length > 0;
  const hasLevels = levels.length > 0;
  const total = Number(hasUsers) + Number(hasProducts) + Number(hasLevels);
  if (total > 1) return { error: "Coupon can be assigned to only one type" };
  if (hasUsers) return { users, products: [], levels: [] };
  if (hasProducts) return { users: [], products, levels: [] };
  if (hasLevels) return { users: [], products: [], levels };
  return { users: [], products: [], levels: [] };
};

const getProductPriceMap = async (items: { productId: string; quantity: number }[]) => {
  const ids = items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } }).select("_id price promoPrice isPromoted");
  return new Map(
    products.map((p) => [
      p._id.toString(),
      p.isPromoted && p.promoPrice !== undefined ? p.promoPrice : p.price,
    ])
  );
};

const getEligibleSubtotal = (
  coupon: { assignedProducts?: Types.ObjectId[] },
  items: { productId: string; quantity: number }[],
  priceMap: Map<string, number>,
  fallbackSubtotal: number
) => {
  if (!coupon.assignedProducts || coupon.assignedProducts.length === 0) return fallbackSubtotal;
  const eligibleIds = new Set(coupon.assignedProducts.map((id) => id.toString()));
  return items.reduce((sum, item) => {
    if (!eligibleIds.has(item.productId)) return sum;
    const price = priceMap.get(item.productId);
    if (price === undefined) return sum;
    return sum + price * item.quantity;
  }, 0);
};

const computeCouponDiscount = (
  coupon: {
    discountType: string;
    discountValue: number;
    freeDelivery: boolean;
  },
  eligibleSubtotal: number,
  deliveryFee: number
) => {
  if (coupon.freeDelivery) return { discount: 0, freeDelivery: true };
  const rawDiscount =
    coupon.discountType === "PERCENT"
      ? (eligibleSubtotal * coupon.discountValue) / 100
      : coupon.discountValue;
  const discount = Math.max(0, Math.min(eligibleSubtotal, rawDiscount));
  return { discount, freeDelivery: false };
};

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

  const coupons = await Coupon.find(filter)
    .sort({ createdAt: -1 })
    .populate("assignedUsers", "name email")
    .populate("assignedProducts", "name");
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
  const assignments = resolveAssignments(payload);
  if ("error" in assignments) return res.status(400).json({ success: false, message: assignments.error });
  const code = normalizeCode(payload.code);
  const coupon = await Coupon.create({
    ...payload,
    code,
    assignedUsers: assignments.users.length ? assignments.users.map((id) => new Types.ObjectId(id)) : [],
    assignedProducts: assignments.products.length ? assignments.products.map((id) => new Types.ObjectId(id)) : [],
    assignedMembershipLevels: assignments.levels.length ? assignments.levels : [],
  });
  sendSuccess(res, coupon, "Coupon created", 201);
});

export const updateCoupon = catchAsync(async (req, res) => {
  const payload = couponSchema.partial().parse(req.body);
  if (payload.freeDelivery && payload.discountValue === undefined) payload.discountValue = 0;
  const error = ensureValidDiscount(payload);
  if (error) return res.status(400).json({ success: false, message: error });
  const assignments = resolveAssignments(payload);
  if ("error" in assignments) return res.status(400).json({ success: false, message: assignments.error });
  if (payload.code) payload.code = normalizeCode(payload.code);
  const update: Record<string, any> = { ...payload };
  const unset: Record<string, 1> = {};
  if (Object.prototype.hasOwnProperty.call(req.body, "assignedUsers")) {
    update.assignedUsers = assignments.users.map((id) => new Types.ObjectId(id));
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "assignedProducts")) {
    update.assignedProducts = assignments.products.map((id) => new Types.ObjectId(id));
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "assignedMembershipLevels")) {
    update.assignedMembershipLevels = assignments.levels;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "assignedUsers") && assignments.users.length === 0) {
    unset.assignedUsers = 1;
    delete update.assignedUsers;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "assignedProducts") && assignments.products.length === 0) {
    unset.assignedProducts = 1;
    delete update.assignedProducts;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "assignedMembershipLevels") && assignments.levels.length === 0) {
    unset.assignedMembershipLevels = 1;
    delete update.assignedMembershipLevels;
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

export const listAvailableCoupons = catchAsync(async (req: AuthRequest, res) => {
  const { items = [], subtotal = 0, deliveryFee = 0 } = req.body as {
    items?: { productId: string; quantity: number }[];
    subtotal?: number;
    deliveryFee?: number;
  };
  const now = new Date();
  const coupons = await Coupon.find({
    isActive: true,
    restricted: { $ne: true },
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }, { expiresAt: { $exists: false } }],
  });

  const priceMap = items.length > 0 ? await getProductPriceMap(items) : new Map<string, number>();

  const available = [];
  for (const coupon of coupons) {
    if (coupon.assignedUsers && coupon.assignedUsers.length > 0) {
      const allowed = coupon.assignedUsers.some((id) => id.toString() === req.user?._id.toString());
      if (!allowed) continue;
    }
    if (coupon.assignedMembershipLevels && coupon.assignedMembershipLevels.length > 0) {
      const level = req.user?.membershipLevel || "None";
      if (!coupon.assignedMembershipLevels.includes(level)) continue;
    }
    const usedCount = await CouponRedemption.countDocuments({ coupon: coupon._id, user: req.user!._id });
    if (coupon.usageType === "SINGLE" && usedCount > 0) continue;
    if (coupon.usageType === "MULTIPLE" && coupon.maxUses && usedCount >= coupon.maxUses) continue;

    const eligibleSubtotal = getEligibleSubtotal(coupon, items, priceMap, subtotal);
    if (coupon.assignedProducts && coupon.assignedProducts.length > 0 && eligibleSubtotal <= 0) continue;

    const { discount, freeDelivery } = computeCouponDiscount(coupon, eligibleSubtotal, deliveryFee);
    available.push({
      _id: coupon._id,
      code: coupon.code,
      title: coupon.title,
      description: coupon.description,
      freeDelivery,
      discount,
    });
  }

  sendSuccess(res, available);
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
  if (coupon.assignedMembershipLevels && coupon.assignedMembershipLevels.length > 0) {
    const level = req.user?.membershipLevel || "None";
    if (!coupon.assignedMembershipLevels.includes(level)) {
      return res.status(403).json({ success: false, message: "Coupon not available for this membership level" });
    }
  }

  const usedCount = await CouponRedemption.countDocuments({ coupon: coupon._id, user: req.user!._id });
  if (coupon.usageType === "SINGLE" && usedCount > 0) {
    return res.status(400).json({ success: false, message: "Coupon already used" });
  }
  if (coupon.usageType === "MULTIPLE" && coupon.maxUses && usedCount >= coupon.maxUses) {
    return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
  }

  let eligibleSubtotal = payload.subtotal;
  if (coupon.assignedProducts && coupon.assignedProducts.length > 0) {
    if (!payload.items || payload.items.length === 0) {
      return res.status(400).json({ success: false, message: "Coupon items are required" });
    }
    const priceMap = await getProductPriceMap(payload.items);
    eligibleSubtotal = getEligibleSubtotal(coupon, payload.items, priceMap, payload.subtotal);
    if (eligibleSubtotal <= 0) {
      return res.status(400).json({ success: false, message: "Coupon not applicable to these items" });
    }
  }

  const result = computeCouponDiscount(coupon, eligibleSubtotal, payload.deliveryFee || 0);
  sendSuccess(res, {
    code: coupon.code,
    discount: result.discount,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    freeDelivery: result.freeDelivery,
  });
});
