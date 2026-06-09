import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./tokenService";
import { AuditLog } from "../models/AuditLog";
import { getDefaultBranchId } from "../utils/branch";

export const createPasswordSetupToken = () => crypto.randomBytes(32).toString("hex");
export const getPasswordSetupExpiry = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

export const registerUser = async (name: string, email: string, password: string, phone?: string) => {
  const normalizedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw { status: 400, message: "Email already registered" };
  }
  const hashed = await bcrypt.hash(password, 10);
  const defaultBranchId = await getDefaultBranchId();
  const user = await User.create({
    name,
    email: normalizedEmail,
    password: hashed,
    phone,
    role: "customer",
    branchIds: defaultBranchId ? [defaultBranchId] : [],
  });
  await Wallet.create({ user: user._id, balance: 0 });
  await AuditLog.create({ user: user._id, type: "auth", action: "USER_REGISTER", result: "SUCCESS" });
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return { user, accessToken, refreshToken };
};

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw { status: 401, message: "Invalid credentials" };
  }
  if (!user.password) {
    throw { status: 409, message: "PASSWORD_NOT_SET" };
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw { status: 401, message: "Invalid credentials" };
  }
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await AuditLog.create({ user: user._id, type: "auth", action: "USER_LOGIN", result: "SUCCESS" });
  return { user, accessToken, refreshToken };
};

export const getPasswordStatus = async (email: string, setupToken?: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return { exists: false, hasPassword: false };
  const canSetPassword = Boolean(
    !user.password &&
    setupToken &&
    user.passwordSetupToken === setupToken &&
    user.passwordSetupExpires &&
    user.passwordSetupExpires.getTime() > Date.now()
  );
  return { exists: true, hasPassword: Boolean(user.password), canSetPassword };
};

export const setPasswordForUser = async (email: string, setupToken: string, password: string) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw { status: 404, message: "User not found" };
  }
  if (user.password) {
    throw { status: 400, message: "Password already set" };
  }
  if (
    !user.passwordSetupToken ||
    user.passwordSetupToken !== setupToken ||
    !user.passwordSetupExpires ||
    user.passwordSetupExpires.getTime() <= Date.now()
  ) {
    throw { status: 403, message: "Invalid or expired setup token" };
  }
  const hashed = await bcrypt.hash(password, 10);
  user.password = hashed;
  user.passwordSetupToken = null;
  user.passwordSetupExpires = null;
  await user.save();
  await AuditLog.create({ user: user._id, type: "auth", action: "USER_SET_PASSWORD", result: "SUCCESS" });
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return { user, accessToken, refreshToken };
};

export const refreshTokens = async (token: string) => {
  const payload = verifyRefreshToken(token);
  const user = await User.findById(payload.sub);
  if (!user) {
    throw { status: 401, message: "Invalid refresh token" };
  }
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return { user, accessToken, refreshToken };
};
