import { Types } from "mongoose";
import { PointsTransaction } from "../models/PointsTransaction";
import { RewardToken } from "../models/RewardToken";
import { User } from "../models/User";
import { Settings } from "../models/Settings";

export const getPointsSummary = async (userId: Types.ObjectId, branchId: string) => {
  const settings = (await Settings.findOne({ branchId })) || (await Settings.create({ branchId }));
  const user = await User.findById(userId);
  const transactions = await PointsTransaction.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
  const rewardToken = await RewardToken.findOne({ user: userId, consumed: false });
  return {
    points: user?.points || 0,
    rewardAvailable: !!rewardToken,
    rewardValue: settings.rewardValue,
    rewardThreshold: settings.rewardThresholdPoints,
    transactions,
  };
};
