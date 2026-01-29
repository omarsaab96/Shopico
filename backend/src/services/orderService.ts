import { Types } from "mongoose";
import { Cart } from "../models/Cart";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { RewardToken } from "../models/RewardToken";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { PointsTransaction } from "../models/PointsTransaction";
import { Settings } from "../models/Settings";
import { Coupon } from "../models/Coupon";
import { CouponRedemption } from "../models/CouponRedemption";
import { haversineDistanceKm, calculatePointsEarned } from "../utils/pricing";
import { OrderStatus, PaymentMethod } from "../types";
import { AuditLog } from "../models/AuditLog";
import { updateMembershipOnBalanceChange } from "../utils/membership";
import { Address } from "../models/Address";

interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export const getOrdersForUser = async (userId: Types.ObjectId, branchId: string) => {
  return Order.find({ user: userId, branchId }).sort({ createdAt: -1 }).populate("items.product");
};

export const getAllOrders = async (opts?: { status?: string; paymentStatus?: string; q?: string; branchId?: string }) => {
  const filter: Record<string, unknown> = {};
  if (opts?.branchId) filter.branchId = opts.branchId;
  if (opts?.status) filter.status = opts.status;
  if (opts?.paymentStatus) filter.paymentStatus = opts.paymentStatus;

  if (opts?.q) {
    const users = await User.find({
      $or: [
        { email: { $regex: opts.q, $options: "i" } },
        { name: { $regex: opts.q, $options: "i" } },
      ],
    }).select("_id");
    const userIds = users.map((u) => u._id);
    const orClauses = [
      userIds.length ? { user: { $in: userIds } } : null,
      { _id: opts.q },
      { address: { $regex: opts.q, $options: "i" } },
    ].filter(Boolean) as Record<string, unknown>[];
    if (orClauses.length) filter.$or = orClauses;
  }

  return Order.find(filter).sort({ createdAt: -1 }).populate("user").populate("items.product");
};

export const getOrderById = async (id: string, userId?: Types.ObjectId, branchId?: string) => {
  const filter: Record<string, unknown> = { _id: id };
  if (branchId) filter.branchId = branchId;
  const order = await Order.findOne(filter).populate("items.product");
  if (!order) return null;
  if (userId && order.user.toString() !== userId.toString()) return null;
  return order;
};

const buildOrderItems = async (itemsInput?: CheckoutItemInput[], userId?: Types.ObjectId, branchId?: string) => {
  if (itemsInput && itemsInput.length > 0) {
    const ids = itemsInput.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: ids }, ...(branchId ? { branchId } : {}) });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    return itemsInput.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw { status: 404, message: "Product not found" };
      const price = product.isPromoted && product.promoPrice !== undefined ? product.promoPrice : product.price;
      return { product: product._id, quantity: item.quantity, price };
    });
  }
  if (!userId) throw { status: 400, message: "No items provided" };
  const cart = await Cart.findOne({ user: userId });
  if (!cart || cart.items.length === 0) throw { status: 400, message: "Cart is empty" };
  const cartIds = cart.items.map((item) => item.product);
  const products = await Product.find({ _id: { $in: cartIds }, ...(branchId ? { branchId } : {}) }).select("_id");
  const allowedIds = new Set(products.map((p) => p._id.toString()));
  const filtered = cart.items.filter((item) => allowedIds.has(item.product.toString()));
  if (filtered.length === 0) throw { status: 400, message: "Cart items not available for this branch" };
  return filtered.map((item) => ({ product: item.product, quantity: item.quantity, price: item.priceSnapshot }));
};

const getSettingsSnapshot = async (branchId: string) => {
  const settings = (await Settings.findOne({ branchId })) || (await Settings.create({ branchId }));
  return settings;
};

const handleWalletDebit = async (userId: Types.ObjectId, branchId: string, amount: number, reference: string) => {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) throw { status: 404, message: "Wallet not found" };
  if (wallet.balance < amount) throw { status: 400, message: "Insufficient wallet balance" };
  wallet.balance -= amount;
  await wallet.save();
  await WalletTransaction.create({
    user: userId,
    amount,
    type: "DEBIT",
    source: "ORDER",
    reference,
    balanceAfter: wallet.balance,
  });
  const user = await User.findById(userId);
  if (user) await updateMembershipOnBalanceChange(user, wallet.balance, branchId);
};

const tryConsumeRewardToken = async (userId: Types.ObjectId, rewardValue: number, apply: boolean) => {
  if (!apply) return { applied: false, discount: 0 };
  const token = await RewardToken.findOne({ user: userId, consumed: false });
  if (!token) return { applied: false, discount: 0 };
  token.consumed = true;
  await token.save();
  return { applied: true, discount: rewardValue };
};

const normalizeCouponCode = (code: string) => code.trim().toUpperCase();

const applyCoupon = async (
  userId: Types.ObjectId,
  branchId: string,
  subtotal: number,
  deliveryFee: number,
  items: { product: Types.ObjectId; quantity: number; price: number }[],
  code?: string
) => {
  if (!code) return { coupon: null, discount: 0, freeDelivery: false };
  const normalized = normalizeCouponCode(code);
  const coupon = await Coupon.findOne({ code: normalized, isActive: true, branchId });
  if (!coupon) throw { status: 404, message: "Coupon not found" };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    throw { status: 400, message: "Coupon expired" };
  }
  if (coupon.assignedUsers && coupon.assignedUsers.length > 0) {
    const allowed = coupon.assignedUsers.some((id) => id.toString() === userId.toString());
    if (!allowed) {
      throw { status: 403, message: "Coupon not available for this user" };
    }
  }
  if (coupon.assignedMembershipLevels && coupon.assignedMembershipLevels.length > 0) {
    const user = await User.findById(userId).select("membershipLevel");
    const level = user?.membershipLevel || "None";
    if (!coupon.assignedMembershipLevels.includes(level)) {
      throw { status: 403, message: "Coupon not available for this membership level" };
    }
  }
  const userUsedCount = await CouponRedemption.countDocuments({ coupon: coupon._id, user: userId });
  const legacyScope = coupon.maxUsesScope || "PER_USER";
  const maxUsesPerUser = coupon.maxUsesPerUser ?? (legacyScope === "PER_USER" ? coupon.maxUses : undefined);
  const maxUsesGlobal = coupon.maxUsesGlobal ?? (legacyScope === "GLOBAL" ? coupon.maxUses : undefined);
  if (coupon.usageType === "SINGLE" && userUsedCount > 0) {
    throw { status: 400, message: "Coupon already used" };
  }
  if (coupon.usageType === "MULTIPLE") {
    if (maxUsesPerUser && userUsedCount >= maxUsesPerUser) {
      throw { status: 400, message: "Coupon usage limit reached" };
    }
    if (maxUsesGlobal && (coupon.usedCount || 0) >= maxUsesGlobal) {
      throw { status: 400, message: "Coupon usage limit reached" };
    }
  }
  let eligibleSubtotal = subtotal;
  if (coupon.assignedProducts && coupon.assignedProducts.length > 0) {
    const eligibleIds = new Set(coupon.assignedProducts.map((id) => id.toString()));
    eligibleSubtotal = items.reduce((sum, item) => {
      if (!eligibleIds.has(item.product.toString())) return sum;
      return sum + item.price * item.quantity;
    }, 0);
    if (eligibleSubtotal <= 0) {
      throw { status: 400, message: "Coupon not applicable to these items" };
    }
  }

  const rawDiscount = coupon.discountType === "PERCENT"
    ? (eligibleSubtotal * coupon.discountValue) / 100
    : coupon.discountValue;
  const maxTotal = eligibleSubtotal;
  const discount = coupon.freeDelivery ? deliveryFee : Math.max(0, Math.min(maxTotal, rawDiscount));
  return { coupon, discount, freeDelivery: coupon.freeDelivery };
};

const applyCoupons = async (
  userId: Types.ObjectId,
  branchId: string,
  subtotal: number,
  deliveryFee: number,
  items: { product: Types.ObjectId; quantity: number; price: number }[],
  codes: string[]
) => {
  if (!codes.length) return { coupons: [], discount: 0 };
  let freeDeliveryApplied = false;
  let discountTotal = 0;
  const coupons = [];
  for (const code of codes) {
    const result = await applyCoupon(userId, branchId, subtotal, deliveryFee, items, code);
    if (!result.coupon) continue;
    let discount = result.discount;
    if (result.freeDelivery) {
      if (freeDeliveryApplied) {
        discount = 0;
      } else {
        freeDeliveryApplied = true;
      }
    }
    discountTotal += discount;
    coupons.push(result.coupon);
  }
  return { coupons, discount: discountTotal };
};

const maybeGenerateReward = async (userId: Types.ObjectId, newPoints: number, branchId: string) => {
  const settings = await getSettingsSnapshot(branchId);
  const threshold = settings.rewardThresholdPoints;
  const user = await User.findById(userId);
  if (!user) return;
  const currentTotal = user.points;
  const previousRewards = Math.floor(currentTotal / threshold);
  const nextTotal = currentTotal + newPoints;
  const newRewards = Math.floor(nextTotal / threshold) - previousRewards;
  user.points = nextTotal;
  await user.save();
  if (newRewards > 0) {
    const tokens = Array.from({ length: newRewards }).map(() => ({ user: userId }));
    await RewardToken.insertMany(tokens);
  }
};

export const createOrder = async (
  userId: Types.ObjectId,
  branchId: string,
  payload: {
    address?: string;
    lat?: number;
    lng?: number;
    addressId?: string;
    paymentMethod: PaymentMethod;
    notes?: string;
    useReward?: boolean;
    couponCode?: string;
    couponCodes?: string[];
    items?: CheckoutItemInput[];
  }
) => {
  let address = payload.address;
  let lat = payload.lat;
  let lng = payload.lng;

  if (payload.addressId) {
    const saved = await Address.findOne({ _id: payload.addressId, user: userId });
    if (!saved) throw { status: 404, message: "Address not found" };
    address = saved.address;
    lat = saved.lat;
    lng = saved.lng;
  }

  if (!address || lat === undefined || lng === undefined) {
    throw { status: 400, message: "Address and location are required" };
  }

  const items = await buildOrderItems(payload.items, userId, branchId);
  const settings = await getSettingsSnapshot(branchId);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const distanceKm = haversineDistanceKm(settings.storeLat, settings.storeLng, lat, lng);
  const deliveryFee =
    distanceKm <= settings.deliveryFreeKm
      ? 0
      : Math.ceil(distanceKm - settings.deliveryFreeKm) * settings.deliveryRatePerKm;

  const requestedCodes = (payload.couponCodes && payload.couponCodes.length)
    ? payload.couponCodes
    : payload.couponCode ? [payload.couponCode] : [];
  const normalizedCodes = Array.from(new Set(requestedCodes.map(normalizeCouponCode))).filter(Boolean);
  if (!settings.allowMultipleCoupons && normalizedCodes.length > 1) {
    throw { status: 400, message: "Multiple coupons are not allowed" };
  }
  const couponResult = await applyCoupons(userId, branchId, subtotal, deliveryFee, items, normalizedCodes);
  const rewardResult = await tryConsumeRewardToken(userId, settings.rewardValue, payload.useReward ?? false);
  const discount = rewardResult.discount + couponResult.discount;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  if (payload.paymentMethod === "WALLET") {
    await handleWalletDebit(userId, branchId, total, "ORDER");
  }

  const order = await Order.create({
    user: userId,
    branchId,
    items,
    status: "PENDING",
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentMethod === "WALLET" ? "CONFIRMED" : "PENDING",
    address,
    notes: payload.notes,
    subtotal,
    deliveryFee,
    deliveryDistanceKm: distanceKm,
    discount,
    couponCode: couponResult.coupons[0]?.code,
    couponCodes: couponResult.coupons.map((c) => c.code),
    couponDiscount: couponResult.discount,
    total,
    rewardApplied: rewardResult.applied,
    statusHistory: [{ status: "PENDING", at: new Date() }],
  });

  if (couponResult.coupons.length) {
    await CouponRedemption.insertMany(
      couponResult.coupons.map((coupon) => ({ coupon: coupon._id, user: userId, order: order._id }))
    );
    await Coupon.updateMany(
      { _id: { $in: couponResult.coupons.map((c) => c._id) } },
      { $inc: { usedCount: 1 } }
    );
  }

  await Cart.findOneAndUpdate({ user: userId }, { items: [] });
  await AuditLog.create({ user: userId, action: "ORDER_CREATED", metadata: { orderId: order._id } });
  return order;
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  paymentStatus?: "PENDING" | "CONFIRMED",
  branchId?: string
) => {
  const filter: Record<string, unknown> = { _id: orderId };
  if (branchId) filter.branchId = branchId;
  const order = await Order.findOne(filter);
  if (!order) throw { status: 404, message: "Order not found" };
  order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  order.statusHistory.push({ status, at: new Date() });
  await order.save();

  if (status === "DELIVERED") {
    const settings = await getSettingsSnapshot(order.branchId.toString());
    const earned = calculatePointsEarned(order.subtotal, settings.pointsPerAmount);
    await PointsTransaction.create({ user: order.user, points: earned, type: "EARN", reference: order._id.toString() });
    await maybeGenerateReward(order.user as Types.ObjectId, earned, order.branchId.toString());
  }

  await AuditLog.create({ user: order.user, action: "ORDER_STATUS_UPDATE", metadata: { orderId: orderId, status } });
  return order;
};
