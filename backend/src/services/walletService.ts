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

export const requestTopUp = async (userId: Types.ObjectId, amount: number, method: string, note?: string) => {
  const topUp = await TopUpRequest.create({ user: userId, amount, method, note, status: "PENDING" });
  await AuditLog.create({ user: userId, action: "TOPUP_REQUEST", metadata: { topUpId: topUp._id } });
  return topUp;
};

export const listTopUps = async (status?: string) => {
  const query = status ? { status } : {};
  return TopUpRequest.find(query).sort({ createdAt: -1 }).populate("user");
};

export const updateTopUpStatus = async (
  topUpId: string,
  status: "PENDING" | "APPROVED" | "REJECTED",
  adminNote?: string
) => {
  const topUp = await TopUpRequest.findById(topUpId);
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
    if (user) await updateMembershipOnBalanceChange(user, wallet.balance);
  }
  await AuditLog.create({ action: "TOPUP_STATUS", metadata: { topUpId, status } });
  return topUp;
};
