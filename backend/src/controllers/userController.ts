import { catchAsync } from "../utils/catchAsync";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { PointsTransaction } from "../models/PointsTransaction";
import { WalletTransaction } from "../models/WalletTransaction";
import { Address } from "../models/Address";
import { sendSuccess } from "../utils/response";
import { createUserSchema, updateUserPermissionsSchema } from "../validators/userValidators";
import { AuditLog } from "../models/AuditLog";

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
  const userId = user._id;
  const addresses = await Address.collection
    .find({ user: { $in: [userId, userId.toString()] } })
    .sort({ createdAt: -1 })
    .toArray();
  sendSuccess(res, { user, wallet, walletTx, pointTx, addresses });
});

export const createUser = catchAsync(async (req, res) => {
  const payload = createUserSchema.parse(req.body);
  const existing = await User.findOne({ email: payload.email.toLowerCase() });
  if (existing) return res.status(400).json({ success: false, message: "Email already registered" });

  const hashed = await bcrypt.hash(payload.password, 10);
  const user = await User.create({
    name: payload.name,
    email: payload.email.toLowerCase(),
    phone: payload.phone,
    password: hashed,
    role: payload.role,
    permissions: payload.permissions || [],
  });
  await Wallet.create({ user: user._id, balance: 0 });
  await AuditLog.create({ user: req.user?._id, action: "ADMIN_CREATE_USER", metadata: { userId: user._id } });
  const safeUser = await User.findById(user._id).select("-password");
  sendSuccess(res, safeUser, "User created", 201);
});

export const updateUserPermissions = catchAsync(async (req, res) => {
  const payload = updateUserPermissionsSchema.parse(req.body);
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { permissions: payload.permissions },
    { new: true }
  ).select("-password");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  sendSuccess(res, user);
});
