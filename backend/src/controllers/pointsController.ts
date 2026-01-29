import { catchAsync } from "../utils/catchAsync";
import { getPointsSummary } from "../services/pointsService";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";

export const getPoints = catchAsync(async (req: AuthRequest, res) => {
  if (!req.branchId) return res.status(400).json({ success: false, message: "Branch access required" });
  const data = await getPointsSummary(req.user!._id, req.branchId);
  sendSuccess(res, data);
});
