import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";
import { adminTopUpRequestSchema, adminTopUpSchema, topUpRequestSchema, updateTopUpSchema } from "../validators/walletValidators";
import { adminTopUpWallet, getWalletDetails, listTopUps, requestTopUp, updateTopUpStatus } from "../services/walletService";
import { User } from "../models/User";

export const getWallet = catchAsync(async (req: AuthRequest, res) => {
  const data = await getWalletDetails(req.user!._id);
  sendSuccess(res, data);
});

export const createTopUp = catchAsync(async (req: AuthRequest, res) => {
  const payload = topUpRequestSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const topUp = await requestTopUp(req.user!._id, req.branchId, payload.amount, payload.method, payload.note);
  sendSuccess(res, topUp, "Top-up created", 201);
});

export const adminListTopUps = catchAsync(async (req, res) => {
  const { status, method, q } = req.query as { status?: string; method?: string; q?: string };
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const data = await listTopUps(req.branchId, status, method, q);
  sendSuccess(res, data);
});

export const adminUpdateTopUp = catchAsync(async (req, res) => {
  const payload = updateTopUpSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const topUp = await updateTopUpStatus(req.params.id, payload.status, payload.adminNote, req.branchId);
  sendSuccess(res, topUp, "Top-up updated");
});

export const adminTopUp = catchAsync(async (req: AuthRequest, res) => {
  const payload = adminTopUpSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const data = await adminTopUpWallet(req.user!._id, payload.userId, payload.amount, payload.note, req.branchId);
  sendSuccess(res, data, "Wallet topped up");
});

export const adminCreateTopUpRequest = catchAsync(async (req: AuthRequest, res) => {
  const payload = adminTopUpRequestSchema.parse(req.body);
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const user = payload.userId
    ? await User.findById(payload.userId)
    : await User.findOne({ email: payload.email });
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  const userBranchIds = (user as any).branchIds || [];
  const allowed = userBranchIds.some((id: any) => id.toString() === req.branchId);
  if (!allowed) return res.status(403).json({ success: false, message: "User not in branch" });
  const topUp = await requestTopUp(user._id, req.branchId, payload.amount, payload.method, payload.note);
  sendSuccess(res, topUp, "Top-up request created", 201);
});
