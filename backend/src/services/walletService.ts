import { Types } from "mongoose";
import { TopUpRequest } from "../models/TopUpRequest";
import { Wallet } from "../models/Wallet";
import { WalletTransaction } from "../models/WalletTransaction";
import { updateMembershipOnBalanceChange } from "../utils/membership";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import { Currency } from "../models/Currency";

export const getPrimaryCurrency = async (branchId: string) => {
  const currency = await Currency.findOne({ branchId, isPrimary: true });
  if (!currency) throw { status: 404, message: "Primary currency not found" };
  return currency;
};

const getCurrencyForBranch = async (branchId: string, currencyId?: string) => {
  if (!currencyId) return getPrimaryCurrency(branchId);
  const currency = await Currency.findOne({ _id: currencyId, branchId, isActive: true });
  if (!currency) throw { status: 404, message: "Currency not found" };
  return currency;
};

export const getWalletCurrencyBalance = (wallet: any, currencyId: string) => {
  const item = (wallet.balances || []).find((entry: any) => entry.currency?.toString() === currencyId);
  return Number(item?.amount || 0);
};

const setWalletCurrencyBalance = (wallet: any, currencyId: string, amount: number) => {
  const item = (wallet.balances || []).find((entry: any) => entry.currency?.toString() === currencyId);
  if (item) item.amount = amount;
  else wallet.balances.push({ currency: currencyId, amount });
};

export const ensureWalletBalances = async (wallet: any, branchId: string) => {
  const primary = await getPrimaryCurrency(branchId);
  if ((!wallet.balances || wallet.balances.length === 0) && Number(wallet.balance || 0) !== 0) {
    wallet.balances = [{ currency: primary._id, amount: wallet.balance }];
    await wallet.save();
  }
  wallet.balance = getWalletCurrencyBalance(wallet, primary._id.toString());
  return wallet;
};

const syncPrimaryBalance = async (wallet: any, branchId: string) => {
  const primary = await getPrimaryCurrency(branchId);
  wallet.balance = getWalletCurrencyBalance(wallet, primary._id.toString());
};

export const getWalletDetails = async (userId: Types.ObjectId, branchId?: string) => {
  let wallet = await Wallet.findOne({ user: userId }).populate("balances.currency");
  if (wallet && branchId) wallet = await ensureWalletBalances(wallet, branchId).then((w) => w.populate("balances.currency"));
  const transactions = await WalletTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(50).populate("currency");
  return { wallet, transactions };
};

export const requestTopUp = async (
  userId: Types.ObjectId,
  branchId: string,
  amount: number,
  method: string,
  note?: string,
  currencyId?: string,
  actorId?: Types.ObjectId,
  action = "TOPUP_REQUEST"
) => {
  const currency = await getCurrencyForBranch(branchId, currencyId);
  const topUp = await TopUpRequest.create({ user: userId, branchId, amount, currency: currency._id, method, note, status: "PENDING" });
  await AuditLog.create({
    user: actorId || userId,
    type: "wallet",
    action,
    result: "SUCCESS",
    metadata: { topUpId: topUp._id, targetUserId: userId, amount, currencyId: currency._id },
  });
  return topUp;
};

export const listTopUps = async (branchId: string, status?: string, method?: string, q?: string, from?: string, to?: string) => {
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
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) {
        createdAt.$gte = fromDate;
      }
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) {
        createdAt.$lte = toDate;
      }
    }
    if (Object.keys(createdAt).length > 0) {
      query.createdAt = createdAt;
    }
  }
  return TopUpRequest.find(query).sort({ createdAt: -1 }).populate("user").populate("currency");
};

export const updateTopUpStatus = async (
  topUpId: string,
  status: "PENDING" | "APPROVED" | "REJECTED",
  adminNote?: string,
  branchId?: string,
  actorId?: Types.ObjectId
) => {
  const filter: Record<string, unknown> = { _id: topUpId };
  if (branchId) filter.branchId = branchId;
  const topUp = await TopUpRequest.findOne(filter);
  if (!topUp) throw { status: 404, message: "Top-up request not found" };
  const alreadyCredited = await WalletTransaction.exists({
    source: "TOPUP",
    reference: topUp._id.toString(),
    type: "CREDIT",
  });
  topUp.status = status;
  topUp.adminNote = adminNote;
  await topUp.save();

  if (status === "APPROVED" && !alreadyCredited) {
    let wallet = await Wallet.findOne({ user: topUp.user });
    if (!wallet) {
      wallet = await Wallet.create({ user: topUp.user, balance: 0, balances: [] });
    }
    await ensureWalletBalances(wallet, topUp.branchId.toString());
    const currency = topUp.currency || (await getPrimaryCurrency(topUp.branchId.toString()))._id;
    const currencyId = currency.toString();
    const nextBalance = getWalletCurrencyBalance(wallet, currencyId) + topUp.amount;
    setWalletCurrencyBalance(wallet, currencyId, nextBalance);
    await syncPrimaryBalance(wallet, topUp.branchId.toString());
    await wallet.save();
    await WalletTransaction.create({
      user: topUp.user,
      amount: topUp.amount,
      currency,
      type: "CREDIT",
      source: "TOPUP",
      reference: topUp._id.toString(),
      balanceAfter: nextBalance,
    });
    const user = await User.findById(topUp.user);
    if (user) await updateMembershipOnBalanceChange(user, wallet.balance, topUp.branchId.toString());
  }
  await AuditLog.create({ user: actorId, type: "wallet", action: "TOPUP_STATUS", result: "SUCCESS", metadata: { topUpId, status } });
  return topUp;
};

export const adminTopUpWallet = async (
  adminId: Types.ObjectId,
  userId: string,
  amount: number,
  note?: string,
  branchId?: string,
  currencyId?: string
) => {
  const user = await User.findById(userId);
  if (!user) throw { status: 404, message: "User not found" };
  if (branchId) {
    const ids = (user as any).branchIds || [];
    const allowed = ids.some((id: Types.ObjectId) => id.toString() === branchId.toString());
    if (!allowed) throw { status: 403, message: "User not in branch" };
  }

  if (!branchId) throw { status: 400, message: "Branch access required" };
  const currency = await getCurrencyForBranch(branchId, currencyId);
  let wallet = await Wallet.findOne({ user: user._id });
  if (!wallet) {
    wallet = await Wallet.create({ user: user._id, balance: 0, balances: [] });
  }

  await ensureWalletBalances(wallet, branchId);
  const nextBalance = getWalletCurrencyBalance(wallet, currency._id.toString()) + amount;
  setWalletCurrencyBalance(wallet, currency._id.toString(), nextBalance);
  await syncPrimaryBalance(wallet, branchId);
  await wallet.save();

  const transaction = await WalletTransaction.create({
    user: user._id,
    amount,
    currency: currency._id,
    type: "CREDIT",
    source: "ADMIN_TOPUP",
    reference: adminId.toString(),
    balanceAfter: nextBalance,
    metadata: { note, adminId: adminId.toString() },
  });

  await updateMembershipOnBalanceChange(user, wallet.balance, branchId);
  await AuditLog.create({
    user: adminId,
    type: "wallet",
    action: "ADMIN_TOPUP",
    result: "SUCCESS",
    metadata: { userId: user._id.toString(), amount, note },
  });

  return { wallet, transaction };
};
