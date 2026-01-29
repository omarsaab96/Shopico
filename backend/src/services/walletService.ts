import { Types } from "mongoose";
import { TopUpRequest } from "../models/TopUpRequest";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { updateMembershipOnBalanceChange } from "../utils/membership";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";

export const getWalletDetails = async (userId: Types.ObjectId) => {
  const wallet = await Wallet.findOne({ user: userId });
  const transactions = await WalletTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
  return { wallet, transactions };
};

export const requestTopUp = async (userId: Types.ObjectId, branchId: string, amount: number, method: string, note?: string) => {
  const topUp = await TopUpRequest.create({ user: userId, branchId, amount, method, note, status: "PENDING" });
  await AuditLog.create({ user: userId, action: "TOPUP_REQUEST", metadata: { topUpId: topUp._id } });
  return topUp;
};

export const listTopUps = async (branchId: string, status?: string, method?: string, q?: string) => {
  const query: Record<string, unknown> = { branchId };
  if (status) query.status = status;
  if (method) query.method = method;
  if (q) {
    const users = await User.find({
      $or: [
        { email: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
      ],
    }).select("_id");
    const ids = users.map((u) => u._id);
    if (ids.length) query.user = { $in: ids };
    else query.user = null; // force empty if no user matches
  }
  return TopUpRequest.find(query).sort({ createdAt: -1 }).populate("user");
};

export const updateTopUpStatus = async (
  topUpId: string,
  status: "PENDING" | "APPROVED" | "REJECTED",
  adminNote?: string,
  branchId?: string
) => {
  const filter: Record<string, unknown> = { _id: topUpId };
  if (branchId) filter.branchId = branchId;
  const topUp = await TopUpRequest.findOne(filter);
  if (!topUp) throw { status: 404, message: "Top-up request not found" };
  topUp.status = status;
  topUp.adminNote = adminNote;
  await topUp.save();

  if (status === "APPROVED") {
    const wallet = await Wallet.findOne({ user: topUp.user });
    if (!wallet) throw { status: 404, message: "Wallet not found" };
    wallet.balance += topUp.amount;
    await wallet.save();
    await WalletTransaction.create({
      user: topUp.user,
      amount: topUp.amount,
      type: "CREDIT",
      source: "TOPUP",
      reference: topUp._id.toString(),
      balanceAfter: wallet.balance,
    });
    const user = await User.findById(topUp.user);
    if (user) await updateMembershipOnBalanceChange(user, wallet.balance, topUp.branchId.toString());
  }
  await AuditLog.create({ action: "TOPUP_STATUS", metadata: { topUpId, status } });
  return topUp;
};

export const adminTopUpWallet = async (
  adminId: Types.ObjectId,
  userId: string,
  amount: number,
  note?: string,
  branchId?: string
) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };
  if (branchId) {
    const ids = (user as any).branchIds || [];
    const allowed = ids.some((id: Types.ObjectId) => id.toString() === branchId.toString());
    if (!allowed) throw { status: 403, message: "User not in branch" };
  }

  let wallet = await Wallet.findOne({ user: user._id });
  if (!wallet) {
    wallet = await Wallet.create({ user: user._id, balance: 0 });
  }

  wallet.balance += amount;
  await wallet.save();

  const transaction = await WalletTransaction.create({
    user: user._id,
    amount,
    type: "CREDIT",
    source: "ADMIN_TOPUP",
    reference: adminId.toString(),
    balanceAfter: wallet.balance,
    metadata: { note, adminId: adminId.toString() },
  });

  await updateMembershipOnBalanceChange(user, wallet.balance, branchId);
  await AuditLog.create({
    user: adminId,
    action: "ADMIN_TOPUP",
    metadata: { userId: user._id.toString(), amount, note },
  });

  return { wallet, transaction };
};
