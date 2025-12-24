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
import { haversineDistanceKm, calculatePointsEarned } from "../utils/pricing";
import { OrderStatus, PaymentMethod } from "../types";
import { AuditLog } from "../models/AuditLog";
import { updateMembershipOnBalanceChange } from "../utils/membership";

interface CheckoutItemInput {
  productId: string;
  quantity: number;
}

export const getOrdersForUser = async (userId: Types.ObjectId) => {
  return Order.find({ user: userId }).sort({ createdAt: -1 }).populate("items.product");
};

export const getAllOrders = async () => {
  return Order.find().sort({ createdAt: -1 }).populate("user").populate("items.product");
};

export const getOrderById = async (id: string, userId?: Types.ObjectId) => {
  const order = await Order.findById(id).populate("items.product");
  if (!order) return null;
  if (userId && order.user.toString() !== userId.toString()) return null;
  return order;
};

const buildOrderItems = async (itemsInput?: CheckoutItemInput[], userId?: Types.ObjectId) => {
  if (itemsInput && itemsInput.length > 0) {
    const ids = itemsInput.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: ids } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));
    return itemsInput.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) throw { status: 404, message: "Product not found" };
      return { product: product._id, quantity: item.quantity, price: product.price };
    });
  }
  if (!userId) throw { status: 400, message: "No items provided" };
  const cart = await Cart.findOne({ user: userId });
  if (!cart || cart.items.length === 0) throw { status: 400, message: "Cart is empty" };
  return cart.items.map((item) => ({ product: item.product, quantity: item.quantity, price: item.priceSnapshot }));
};

const getSettingsSnapshot = async () => {
  const settings = (await Settings.findOne()) || (await Settings.create({}));
  return settings;
};

const handleWalletDebit = async (userId: Types.ObjectId, amount: number, reference: string) => {
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
  if (user) await updateMembershipOnBalanceChange(user, wallet.balance);
};

const tryConsumeRewardToken = async (userId: Types.ObjectId, rewardValue: number, apply: boolean) => {
  if (!apply) return { applied: false, discount: 0 };
  const token = await RewardToken.findOne({ user: userId, consumed: false });
  if (!token) return { applied: false, discount: 0 };
  token.consumed = true;
  await token.save();
  return { applied: true, discount: rewardValue };
};

const maybeGenerateReward = async (userId: Types.ObjectId, newPoints: number) => {
  const settings = await getSettingsSnapshot();
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
  payload: {
    address: string;
    lat: number;
    lng: number;
    paymentMethod: PaymentMethod;
    notes?: string;
    useReward?: boolean;
    items?: CheckoutItemInput[];
  }
) => {
  const items = await buildOrderItems(payload.items, userId);
  const settings = await getSettingsSnapshot();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const distanceKm = haversineDistanceKm(settings.storeLat, settings.storeLng, payload.lat, payload.lng);
  const deliveryFee =
    distanceKm <= settings.deliveryFreeKm
      ? 0
      : Math.ceil(distanceKm - settings.deliveryFreeKm) * settings.deliveryRatePerKm;

  const rewardResult = await tryConsumeRewardToken(userId, settings.rewardValue, payload.useReward ?? false);
  const discount = rewardResult.discount;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  if (payload.paymentMethod === "WALLET") {
    await handleWalletDebit(userId, total, "ORDER");
  }

  const order = await Order.create({
    user: userId,
    items,
    status: "PENDING",
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentMethod === "WALLET" ? "CONFIRMED" : "PENDING",
    address: payload.address,
    notes: payload.notes,
    subtotal,
    deliveryFee,
    deliveryDistanceKm: distanceKm,
    discount,
    total,
    rewardApplied: rewardResult.applied,
    statusHistory: [{ status: "PENDING", at: new Date() }],
  });

  await Cart.findOneAndUpdate({ user: userId }, { items: [] });
  await AuditLog.create({ user: userId, action: "ORDER_CREATED", metadata: { orderId: order._id } });
  return order;
};

export const updateOrderStatus = async (
  orderId: string,
  status: OrderStatus,
  paymentStatus?: "PENDING" | "CONFIRMED"
) => {
  const order = await Order.findById(orderId);
  if (!order) throw { status: 404, message: "Order not found" };
  order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  order.statusHistory.push({ status, at: new Date() });
  await order.save();

  if (status === "DELIVERED") {
    const settings = await getSettingsSnapshot();
    const earned = calculatePointsEarned(order.subtotal, settings.pointsPerAmount);
    await PointsTransaction.create({ user: order.user, points: earned, type: "EARN", reference: order._id.toString() });
    await maybeGenerateReward(order.user as Types.ObjectId, earned);
  }

  await AuditLog.create({ user: order.user, action: "ORDER_STATUS_UPDATE", metadata: { orderId: orderId, status } });
  return order;
};
