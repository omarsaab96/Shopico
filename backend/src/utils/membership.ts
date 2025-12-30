import { IUser, User } from "../models/User";
import { Settings } from "../models/Settings";

export type MembershipLevel = "None" | "Silver" | "Gold" | "Platinum" | "Diamond";

export const determineMembershipLevel = async (walletBalance: number): Promise<MembershipLevel> => {
  const settings = await Settings.findOne();
  const thresholds = settings?.membershipThresholds || {
    silver: 1000000,
    gold: 2000000,
    platinum: 4000000,
    diamond: 6000000,
  };
  if (walletBalance >= thresholds.diamond) return "Diamond";
  if (walletBalance >= thresholds.platinum) return "Platinum";
  if (walletBalance >= thresholds.gold) return "Gold";
  if (walletBalance >= thresholds.silver) return "Silver";
  return "None";
};

export const updateMembershipOnBalanceChange = async (user: IUser, walletBalance: number) => {
  const settings = await Settings.findOne();
  const graceDays = settings?.membershipGraceDays ?? 14;
  const thresholds = settings?.membershipThresholds || {
    silver: 1000000,
    gold: 2000000,
    platinum: 4000000,
    diamond: 6000000,
  };

  const targetLevel = await determineMembershipLevel(walletBalance);
  const levelOrder: MembershipLevel[] = ["None", "Silver", "Gold", "Platinum", "Diamond"];
  const currentIndex = levelOrder.indexOf(user.membershipLevel as MembershipLevel);
  const targetIndex = levelOrder.indexOf(targetLevel);

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
