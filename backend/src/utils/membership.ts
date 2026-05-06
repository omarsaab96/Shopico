import { IUser, User } from "../models/User";
import { Settings } from "../models/Settings";
import { Wallet } from "../models/Wallet";

export type MembershipLevel = "None" | "Silver" | "Gold" | "Platinum" | "Diamond";

const DEFAULT_THRESHOLDS = {
  silver: 1000000,
  gold: 2000000,
  platinum: 4000000,
  diamond: 6000000,
};

const LEVEL_ORDER: MembershipLevel[] = ["None", "Silver", "Gold", "Platinum", "Diamond"];

type MembershipThresholds = {
  silver: number;
  gold: number;
  platinum: number;
  diamond: number;
};

export const determineMembershipLevelFromThresholds = (
  walletBalance: number,
  thresholds: MembershipThresholds
): MembershipLevel => {
  if (walletBalance >= thresholds.diamond) return "Diamond";
  if (walletBalance >= thresholds.platinum) return "Platinum";
  if (walletBalance >= thresholds.gold) return "Gold";
  if (walletBalance >= thresholds.silver) return "Silver";
  return "None";
};

export const determineMembershipLevel = async (walletBalance: number, branchId?: string): Promise<MembershipLevel> => {
  const settings = branchId ? await Settings.findOne({ branchId }) : await Settings.findOne();
  const thresholds = settings?.membershipThresholds || DEFAULT_THRESHOLDS;
  return determineMembershipLevelFromThresholds(walletBalance, thresholds);
};

export const updateMembershipOnBalanceChange = async (user: IUser, walletBalance: number, branchId?: string) => {
  const settings = branchId ? await Settings.findOne({ branchId }) : await Settings.findOne();
  const graceDays = settings?.membershipGraceDays ?? 14;

  const targetLevel = await determineMembershipLevel(walletBalance, branchId);
  const currentIndex = Math.max(0, LEVEL_ORDER.indexOf(user.membershipLevel as MembershipLevel));
  const targetIndex = LEVEL_ORDER.indexOf(targetLevel);

  if (targetIndex > currentIndex) {
    user.membershipLevel = targetLevel;
    user.membershipGraceUntil = null;
  } else if (targetIndex < currentIndex) {
    const graceMs = Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
    const graceUntil = user.membershipGraceUntil || new Date(Date.now() + graceMs);
    user.membershipGraceUntil = graceUntil;
    const effectiveGraceExpired = graceMs === 0 || graceUntil.getTime() <= Date.now();
    if (effectiveGraceExpired) {
      user.membershipLevel = targetLevel;
      user.membershipGraceUntil = null;
    }
  } else {
    user.membershipGraceUntil = null;
  }
  await user.save();
};

export const recalculateMembershipsForThresholdChange = async (branchId: string) => {
  const settings = await Settings.findOne({ branchId });
  const thresholds = settings?.membershipThresholds || DEFAULT_THRESHOLDS;
  const users = await User.find({ branchIds: branchId });
  const wallets = await Wallet.find({ user: { $in: users.map((user) => user._id) } });
  const walletBalanceByUser = new Map(wallets.map((wallet) => [wallet.user.toString(), wallet.balance]));
  const now = Date.now();

  await Promise.all(users.map(async (user) => {
    const balance = walletBalanceByUser.get(user._id.toString()) ?? 0;
    const targetLevel = determineMembershipLevelFromThresholds(balance, thresholds);
    const currentIndex = Math.max(0, LEVEL_ORDER.indexOf(user.membershipLevel as MembershipLevel));
    const targetIndex = LEVEL_ORDER.indexOf(targetLevel);
    const graceUntil = user.membershipGraceUntil;
    const hasActiveGrace = Boolean(graceUntil && graceUntil.getTime() > now);

    if (!hasActiveGrace) {
      user.membershipLevel = targetLevel;
      user.membershipGraceUntil = null;
      await user.save();
      return;
    }

    if (targetIndex >= currentIndex) {
      user.membershipLevel = targetLevel;
      user.membershipGraceUntil = null;
      await user.save();
      return;
    }

    const protectedIndex = Math.min(currentIndex, targetIndex + 1);
    user.membershipLevel = LEVEL_ORDER[protectedIndex];
    user.membershipGraceUntil = graceUntil;
    await user.save();
  }));
};
