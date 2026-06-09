import { catchAsync } from "../utils/catchAsync";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { createPasswordSetupToken, getPasswordSetupExpiry } from "../services/authService";
import { Wallet } from "../models/Wallet";
import { PointsTransaction } from "../models/PointsTransaction";
import { WalletTransaction } from "../models/WalletTransaction";
import { Address } from "../models/Address";
import { sendSuccess } from "../utils/response";
import { createUserSchema, updateUserBranchesSchema, updateUserPermissionsSchema, updateUserSchema } from "../validators/userValidators";
import { AuditLog } from "../models/AuditLog";
import { UserRole } from "../types";
import { ensureWalletBalances } from "../services/walletService";

const PERMISSION_CONTROLLED_USER_ROLES: UserRole[] = ["manager", "staff", "driver", "customer"];
const CREATABLE_USER_ROLES: UserRole[] = ["manager", "staff", "driver", "customer"];

const viewRolePermission = (role: UserRole) => `users:roles:${role}:view`;
const createRolePermission = (role: UserRole) => `users:roles:${role}:create`;

const hasPermission = (req: any, permission: string) => {
  const permissions = req.user?.permissions || [];
  return permissions.includes(permission);
};

const getVisibleUserRoles = (req: any): UserRole[] => {
  const roles = PERMISSION_CONTROLLED_USER_ROLES.filter((role) => hasPermission(req, viewRolePermission(role)));
  return req.user?.role === "admin" ? ["admin", ...roles] : roles;
};

const getCreatableUserRoles = (req: any): UserRole[] => {
  return CREATABLE_USER_ROLES.filter((role) => hasPermission(req, createRolePermission(role)));
};

const getScopedUserFilter = (req: any, baseFilter: Record<string, unknown> = {}) => {
  const visibleRoles = getVisibleUserRoles(req);
  return { ...baseFilter, role: { $in: visibleRoles } };
};

const canViewRole = (req: any, role?: UserRole) => {
  if (!role) return true;
  return getVisibleUserRoles(req).includes(role);
};

const canCreateOrAssignRole = (req: any, role?: UserRole) => {
  if (!role) return true;
  return getCreatableUserRoles(req).includes(role);
};

export const listUsers = catchAsync(async (req, res) => {
  const { q, role } = req.query as { q?: string; role?: string };
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const filter: Record<string, unknown> = getScopedUserFilter(req, { branchIds: req.branchId });
  if (role) {
    if (!canViewRole(req, role as UserRole)) return sendSuccess(res, []);
    filter.role = role;
  }
  if (q) {
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ];
  }
  const users = await User.find(filter).select("-password -passwordSetupToken -passwordSetupExpires").sort({ createdAt: -1 });
  sendSuccess(res, users);
});

export const getUserDetails = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const user = await User.findOne(getScopedUserFilter(req, { _id: req.params.id, branchIds: req.branchId })).select("-password -passwordSetupToken -passwordSetupExpires");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  let wallet = await Wallet.findOne({ user: user._id }).populate("balances.currency");
  if (wallet) wallet = await ensureWalletBalances(wallet, req.branchId).then((w) => w.populate("balances.currency"));
  const walletTx = await WalletTransaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(20).populate("currency");
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
  if (!canCreateOrAssignRole(req, payload.role)) {
    return res.status(403).json({ success: false, message: "Cannot create this type of user" });
  }
  const existing = await User.findOne({ email: payload.email.toLowerCase() });
  if (existing) return res.status(400).json({ success: false, message: "Email already registered" });
  if (!req.branchId && (!payload.branchIds || payload.branchIds.length === 0)) {
    return res.status(400).json({ success: false, message: "Branch access required" });
  }

  const hashed = payload.password ? await bcrypt.hash(payload.password, 10) : null;
  const passwordSetupToken = hashed ? null : createPasswordSetupToken();
  const branchIds = payload.branchIds && payload.branchIds.length > 0
    ? payload.branchIds
    : req.branchId ? [req.branchId] : [];
  const allowedBranches = (req.user as any)?.branchIds?.map((id: any) => id.toString()) || [];
  const isAdmin = req.user?.role === "admin";
  if (!isAdmin && branchIds.some((id) => !allowedBranches.includes(id))) {
    return res.status(403).json({ success: false, message: "Cannot assign branches outside your scope" });
  }
  const user = await User.create({
    name: payload.name,
    email: payload.email.toLowerCase(),
    phone: payload.phone,
    password: hashed,
    passwordSetupToken,
    passwordSetupExpires: passwordSetupToken ? getPasswordSetupExpiry() : null,
    role: payload.role,
    permissions: payload.permissions || [],
    branchIds,
  });
  await Wallet.create({ user: user._id, balance: 0 });
  await AuditLog.create({ user: req.user?._id, type: "users", action: "ADMIN_CREATE_USER", result: "SUCCESS", metadata: { userId: user._id } });
  const safeUser = await User.findById(user._id).select("-password -passwordSetupToken -passwordSetupExpires");
  const data = safeUser?.toObject ? safeUser.toObject() : safeUser;
  sendSuccess(res, { ...data, setupToken: passwordSetupToken || undefined }, "User created", 201);
});

export const updateUserPermissions = catchAsync(async (req, res) => {
  const payload = updateUserPermissionsSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const user = await User.findOneAndUpdate(
    getScopedUserFilter(req, { _id: req.params.id, branchIds: req.branchId }),
    { permissions: payload.permissions },
    { new: true }
  ).select("-password -passwordSetupToken -passwordSetupExpires");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  sendSuccess(res, user);
});

export const updateUserBranches = catchAsync(async (req, res) => {
  const payload = updateUserBranchesSchema.parse(req.body);
  const allowedBranches = (req.user as any)?.branchIds?.map((id: any) => id.toString()) || [];
  const isAdmin = req.user?.role === "admin";
  const canAssign = isAdmin || payload.branchIds.every((id) => allowedBranches.includes(id));
  if (!canAssign) {
    return res.status(403).json({ success: false, message: "Cannot assign branches outside your scope" });
  }
  const user = await User.findOneAndUpdate(
    getScopedUserFilter(req, { _id: req.params.id }),
    { branchIds: payload.branchIds },
    { new: true }
  ).select("-password -passwordSetupToken -passwordSetupExpires");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  sendSuccess(res, user);
});

export const updateUser = catchAsync(async (req, res) => {
  const payload = updateUserSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  if (!canCreateOrAssignRole(req, payload.role)) {
    return res.status(403).json({ success: false, message: "Cannot assign this user role" });
  }

  if (payload.email) {
    const exists = await User.findOne({ email: payload.email.toLowerCase(), _id: { $ne: req.params.id } });
    if (exists) return res.status(400).json({ success: false, message: "Email already registered" });
    payload.email = payload.email.toLowerCase();
  }

  const user = await User.findOneAndUpdate(
    getScopedUserFilter(req, { _id: req.params.id, branchIds: req.branchId }),
    payload,
    { new: true }
  ).select("-password -passwordSetupToken -passwordSetupExpires");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  sendSuccess(res, user);
});

export const deleteUser = catchAsync(async (req, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  if (req.user?._id?.toString() === req.params.id) {
    return res.status(400).json({ success: false, message: "Cannot delete your own account" });
  }
  const user = await User.findOneAndDelete(getScopedUserFilter(req, { _id: req.params.id, branchIds: req.branchId }));
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  sendSuccess(res, { _id: user._id }, "User deleted");
});
