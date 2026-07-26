import { Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import crypto from "crypto";
import { changePasswordSchema, deleteProfileSchema, loginSchema, passwordStatusSchema, registerSchema, setPasswordSchema, updateProfileSchema, verifyEmailOtpSchema } from "../validators/authValidators";
import { getPasswordStatus, loginUser, refreshTokens, registerUser, setPasswordForUser } from "../services/authService";
import { sendEmailVerificationOtp } from "../services/emailService";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";
import { Wallet } from "../models/Wallet";
import { updateMembershipOnBalanceChange } from "../utils/membership";
import { User } from "../models/User";
import { AuditLog } from "../models/AuditLog";
import bcrypt from "bcryptjs";
import { Cart } from "../models/Cart";

const EMAIL_VERIFICATION_OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_VERIFICATION_RESEND_MS = 60 * 1000;

const hashOtp = (otp: string) => crypto.createHash("sha256").update(otp).digest("hex");
const createOtp = () => crypto.randomInt(100000, 1000000).toString();

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const register = catchAsync(async (req: AuthRequest, res) => {
  const parsed = registerSchema.parse(req.body);
  const result = await registerUser(parsed.name, parsed.email, parsed.password, parsed.phone);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken }, "Registered", 201);
});

export const login = catchAsync(async (req: AuthRequest, res) => {
  const parsed = loginSchema.parse(req.body);
  const result = await loginUser(parsed.email, parsed.password);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken }, "Logged in");
});

export const passwordStatus = catchAsync(async (req: AuthRequest, res) => {
  const parsed = passwordStatusSchema.parse(req.body);
  const status = await getPasswordStatus(parsed.email, parsed.setupToken);
  sendSuccess(res, status);
});

export const setPassword = catchAsync(async (req: AuthRequest, res) => {
  const parsed = setPasswordSchema.parse(req.body);
  const result = await setPasswordForUser(parsed.email, parsed.setupToken, parsed.password);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken }, "Password set");
});

export const refresh = catchAsync(async (req: AuthRequest, res) => {
  const token = (req.cookies?.refreshToken as string) || req.body.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, message: "No refresh token" });
  }
  const result = await refreshTokens(token);
  setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken }, "Refreshed");
});

export const me = catchAsync(async (req: AuthRequest, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user!._id });
    const balance = wallet?.balance ?? 0;
    const branchIds = (req.user as any)?.branchIds || [];
    const branchId = branchIds.length ? branchIds[0].toString() : undefined;
    await updateMembershipOnBalanceChange(req.user!, balance, branchId);
  } catch (e) {
    // best-effort; we still return the user even if this fails
  }
  const user = await User.findById(req.user!._id).select("-password -passwordSetupToken -passwordSetupExpires");
  sendSuccess(res, { user });
});

export const sendEmailOtp = catchAsync(async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

  const user = await User.findById(req.user._id).select("+emailVerificationSentAt");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (user.emailVerified) return sendSuccess(res, { emailVerified: true }, "Email already verified");

  if (user.emailVerificationSentAt && Date.now() - user.emailVerificationSentAt.getTime() < EMAIL_VERIFICATION_RESEND_MS) {
    return res.status(429).json({ success: false, message: "Please wait before requesting another code" });
  }

  const otp = createOtp();
  user.emailVerificationOtpHash = hashOtp(otp);
  user.emailVerificationOtpExpires = new Date(Date.now() + EMAIL_VERIFICATION_OTP_TTL_MS);
  user.emailVerificationSentAt = new Date();
  await user.save();

  await sendEmailVerificationOtp(user.email, otp);
  await AuditLog.create({ user: user._id, type: "auth", action: "USER_SEND_EMAIL_VERIFICATION_OTP", result: "SUCCESS" });
  sendSuccess(res, { email: user.email }, "Verification code sent");
});

export const verifyEmailOtp = catchAsync(async (req: AuthRequest, res) => {
  const payload = verifyEmailOtpSchema.parse(req.body);
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

  const user = await User.findById(req.user._id).select("+emailVerificationOtpHash +emailVerificationOtpExpires +emailVerificationSentAt");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (user.emailVerified) {
    const safeUser = await User.findById(user._id).select("-password -passwordSetupToken -passwordSetupExpires");
    return sendSuccess(res, { user: safeUser }, "Email already verified");
  }

  const isExpired = !user.emailVerificationOtpExpires || user.emailVerificationOtpExpires.getTime() <= Date.now();
  const isMatch = Boolean(user.emailVerificationOtpHash && user.emailVerificationOtpHash === hashOtp(payload.otp));
  if (isExpired || !isMatch) {
    await AuditLog.create({ user: user._id, type: "auth", action: "USER_VERIFY_EMAIL_OTP", result: "FAILURE" });
    return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
  }

  user.emailVerified = true;
  user.emailVerificationOtpHash = null;
  user.emailVerificationOtpExpires = null;
  user.emailVerificationSentAt = null;
  await user.save();
  await AuditLog.create({ user: user._id, type: "auth", action: "USER_VERIFY_EMAIL_OTP", result: "SUCCESS" });

  const safeUser = await User.findById(user._id).select("-password -passwordSetupToken -passwordSetupExpires");
  sendSuccess(res, { user: safeUser }, "Email verified");
});

export const updateMe = catchAsync(async (req: AuthRequest, res) => {
  const payload = updateProfileSchema.parse(req.body);
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

  const update: { name?: string; email?: string; phone?: string } = {};
  if (payload.name !== undefined) update.name = payload.name.trim();
  if (payload.phone !== undefined) update.phone = payload.phone.trim();
  if (payload.email !== undefined) {
    const email = payload.email.toLowerCase().trim();
    const exists = await User.findOne({ email, _id: { $ne: req.user._id } });
    if (exists) return res.status(400).json({ success: false, message: "Email already registered" });
    update.email = email;
  }

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true }).select("-password -passwordSetupToken -passwordSetupExpires");
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (payload.email !== undefined) {
    user.emailVerified = false;
    user.emailVerificationOtpHash = null;
    user.emailVerificationOtpExpires = null;
    user.emailVerificationSentAt = null;
    await user.save();
  }
  await AuditLog.create({ user: user._id, type: "auth", action: "USER_UPDATE_PROFILE", result: "SUCCESS" });
  sendSuccess(res, { user }, "Profile updated");
});

export const changeMyPassword = catchAsync(async (req: AuthRequest, res) => {
  const payload = changePasswordSchema.parse(req.body);
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (!user.password) return res.status(400).json({ success: false, message: "Password is not set for this account" });

  const matches = await bcrypt.compare(payload.currentPassword, user.password);
  if (!matches) return res.status(400).json({ success: false, message: "Current password is incorrect" });

  user.password = await bcrypt.hash(payload.newPassword, 10);
  await user.save();
  await AuditLog.create({ user: user._id, type: "auth", action: "USER_CHANGE_PASSWORD", result: "SUCCESS" });
  sendSuccess(res, null, "Password changed");
});

export const deleteMe = catchAsync(async (req: AuthRequest, res) => {
  const payload = deleteProfileSchema.parse(req.body);
  if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });

  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  if (!user.password) return res.status(400).json({ success: false, message: "Password is not set for this account" });

  const matches = await bcrypt.compare(payload.password, user.password);
  if (!matches) return res.status(400).json({ success: false, message: "Password is incorrect" });

  await Wallet.deleteOne({ user: user._id });
  await Cart.deleteOne({ user: user._id });
  await User.findByIdAndDelete(user._id);
  await AuditLog.create({ user: req.user._id, type: "auth", action: "USER_DELETE_PROFILE", result: "SUCCESS" });
  sendSuccess(res, { _id: req.user._id }, "Profile deleted");
});
