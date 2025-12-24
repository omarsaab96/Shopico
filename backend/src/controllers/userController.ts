import { catchAsync } from "../utils/catchAsync";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { PointsTransaction } from "../models/PointsTransaction";
import { WalletTransaction } from "../models/WalletTransaction";
import { sendSuccess } from "../utils/response";

export const listUsers = catchAsync(async (_req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  sendSuccess(res, users);
});

export const getUserDetails = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  const wallet = await Wallet.findOne({ user: user._id });
  const walletTx = await WalletTransaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(20);
  const pointTx = await PointsTransaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(20);
  sendSuccess(res, { user, wallet, walletTx, pointTx });
});
