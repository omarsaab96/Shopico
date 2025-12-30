import { Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { loginSchema, registerSchema } from "../validators/authValidators";
import { loginUser, refreshTokens, registerUser } from "../services/authService";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";
import { Wallet } from "../models/Wallet";
import { updateMembershipOnBalanceChange } from "../utils/membership";

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
    await updateMembershipOnBalanceChange(req.user!, balance);
  } catch (e) {
    // best-effort; we still return the user even if this fails
  }
  sendSuccess(res, { user: req.user });
});
