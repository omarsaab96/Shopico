import { z } from "zod";
import { catchAsync } from "../utils/catchAsync";
import { getPointsSummary, redeemPointsCoupon, getPersonalCoupons } from "../services/pointsService";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";

export const getPoints = catchAsync(async (req: AuthRequest, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const data = await getPointsSummary(req.user!._id, req.branchId);
  sendSuccess(res, data);
});


export const redeemPoints = catchAsync(async (req: AuthRequest, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const payload = z.object({
    requestId: z.string().min(10).max(100).regex(/^[a-zA-Z0-9-]+$/),
    currencyId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  }).parse(req.body);
  const coupon = await redeemPointsCoupon(req.user!._id, req.branchId, payload.requestId, payload.currencyId);
  sendSuccess(res, coupon, "Reward coupon added");
});

export const myCoupons = catchAsync(async (req: AuthRequest, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  sendSuccess(res, await getPersonalCoupons(req.user!._id, req.branchId));
});
