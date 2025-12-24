import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";
import { topUpRequestSchema, updateTopUpSchema } from "../validators/walletValidators";
import { getWalletDetails, listTopUps, requestTopUp, updateTopUpStatus } from "../services/walletService";

export const getWallet = catchAsync(async (req: AuthRequest, res) => {
  const data = await getWalletDetails(req.user!._id);
  sendSuccess(res, data);
});

export const createTopUp = catchAsync(async (req: AuthRequest, res) => {
  const payload = topUpRequestSchema.parse(req.body);
  const topUp = await requestTopUp(req.user!._id, payload.amount, payload.method, payload.note);
  sendSuccess(res, topUp, "Top-up created", 201);
});

export const adminListTopUps = catchAsync(async (req, res) => {
  const { status } = req.query as { status?: string };
  const data = await listTopUps(status);
  sendSuccess(res, data);
});

export const adminUpdateTopUp = catchAsync(async (req, res) => {
  const payload = updateTopUpSchema.parse(req.body);
  const topUp = await updateTopUpStatus(req.params.id, payload.status, payload.adminNote);
  sendSuccess(res, topUp, "Top-up updated");
});
