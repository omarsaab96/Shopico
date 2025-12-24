import { catchAsync } from "../utils/catchAsync";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { PointsTransaction } from "../models/PointsTransaction";
import { WalletTransaction } from "../models/WalletTransaction";
import { sendSuccess } from "../utils/response";

export const listUsers = catchAsync(async (req, res) => {
  const { q, role } = req.query as { q?: string; role?: string };
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }
  const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
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
