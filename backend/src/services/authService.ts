import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Wallet } from "../models/Wallet";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./tokenService";
import { AuditLog } from "../models/AuditLog";
import { getDefaultBranchId } from "../utils/branch";

export const registerUser = async (name: string, email: string, password: string, phone?: string) => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw { status: 400, message: "Email already registered" };
  }
  const hashed = await bcrypt.hash(password, 10);
  const defaultBranchId = await getDefaultBranchId();
  const user = await User.create({
    name,
    email,
    password: hashed,
    phone,
    role: "customer",
    branchIds: defaultBranchId ? [defaultBranchId] : [],
  });
  await Wallet.create({ user: user._id, balance: 0 });
  await AuditLog.create({ user: user._id, action: "USER_REGISTER" });
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  return { user, accessToken, refreshToken };
};

export const loginUser = async (email: string, password: string) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw { status: 401, message: "Invalid credentials" };
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw { status: 401, message: "Invalid credentials" };
  }
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await AuditLog.create({ user: user._id, action: "USER_LOGIN" });
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
