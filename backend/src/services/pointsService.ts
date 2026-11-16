import { Types } from "mongoose";
import { Coupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { Currency } from "../models/Currency";
import { getPrimaryCurrency } from "./walletService";
import { roundAmount } from "../utils/productUnits";
import { PointsTransaction } from "../models/PointsTransaction";
import { RewardToken } from "../models/RewardToken";
import { User } from "../models/User";
import { Settings } from "../models/Settings";

export const getPointsSummary = async (userId: Types.ObjectId, branchId: string) => {
  const settings = (await Settings.findOne({ branchId })) || (await Settings.create({ branchId }));
  const user = await User.findById(userId);
  const transactions = await PointsTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
  const rewardCount = await RewardToken.countDocuments({ user: userId, consumed: false });
  return {
    points: user?.points || 0,
    rewardAvailable: rewardCount > 0,
    rewardCount,
    rewardValue: settings.rewardValue,
    rewardThreshold: settings.rewardThresholdPoints,
    transactions,
  };
};


export const redeemPointsCoupon = async (userId: Types.ObjectId, branchId: string, requestId: string, currencyId?: string) => {
  const requestKey = `${userId}:${branchId}:${requestId}`;
  const existing = await Coupon.findOne({ rewardRequestKey: requestKey }).populate("currency");
  if (existing) return existing;
  const settings = (await Settings.findOne({ branchId })) || (await Settings.create({ branchId }));
  if (!(settings.rewardValue > 0)) throw { status: 409, message: "Points reward is not available" };
  const currency = currencyId
    ? await Currency.findOne({ _id: currencyId, branchId, isActive: true })
    : await getPrimaryCurrency(branchId);
  if (!currency) throw { status: 400, message: "Currency not found" };
  const token = await RewardToken.findOneAndUpdate(
    { user: userId, consumed: false }, { $set: { consumed: true } },
    { new: true, sort: { createdAt: 1, _id: 1 } }
  );
  if (!token) {
    // A concurrent retry may already have completed the same conversion.
    const retry = await Coupon.findOne({ rewardRequestKey: requestKey }).populate("currency");
    if (retry) return retry;
    throw { status: 409, message: "No points reward is available" };
  }
  let coupon;
  try {
    const rate = currency.isPrimary ? 1 : Number(currency.exchangeRate || 1);
    coupon = await Coupon.create({
      branchId, code: `POINTS-${String(token._id).toUpperCase()}`,
      title: "Points reward", discountType: "FIXED",
      discountValue: roundAmount(settings.rewardValue / (rate > 0 ? rate : 1)),
      currency: currency._id, assignedUsers: [userId], usageType: "SINGLE",
      maxUsesPerUser: 1, maxUsesGlobal: 1, isActive: true,
      rewardToken: token._id, rewardRequestKey: requestKey,
    });
  } catch (error) {
    await RewardToken.updateOne({ _id: token._id }, { $set: { consumed: false } });
    const retry = await Coupon.findOne({ rewardRequestKey: requestKey }).populate("currency");
    if (retry) return retry;
    throw error;
  }
  return coupon.populate("currency");
};

export const getPersonalCoupons = async (userId: Types.ObjectId, branchId: string) => {
  const coupons = await Coupon.find({
    branchId, assignedUsers: userId, isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }],
  }).populate("currency").populate("assignedProducts", "name").sort({ createdAt: -1 });
  const uses = await CouponRedemption.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { user: userId, coupon: { $in: coupons.map(coupon => coupon._id) } } },
    { $group: { _id: "$coupon", count: { $sum: 1 } } },
  ]);
  const used = new Map(uses.map(row => [String(row._id), row.count]));
  return coupons.filter(coupon => {
    const count = used.get(String(coupon._id)) || 0;
    if (coupon.rewardToken && coupon.usedCount > 0) return false;
    if (coupon.usageType === "SINGLE") return count === 0;
    const perUser = coupon.maxUsesPerUser ?? (coupon.maxUsesScope !== "GLOBAL" ? coupon.maxUses : undefined);
    const global = coupon.maxUsesGlobal ?? (coupon.maxUsesScope === "GLOBAL" ? coupon.maxUses : undefined);
    return (!perUser || count < perUser) && (!global || coupon.usedCount < global);
  }).map(coupon => ({
    ...coupon.toObject(),
    userUsedCount: used.get(String(coupon._id)) || 0,
    assignedProductName: (coupon.assignedProducts as unknown as { name?: string }[] | undefined)
      ?.map(product => product.name).filter(Boolean).join(", ") || undefined,
  }));
};
