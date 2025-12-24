import { catchAsync } from "../utils/catchAsync";
import { getPointsSummary } from "../services/pointsService";
import { sendSuccess } from "../utils/response";
import { AuthRequest } from "../types/auth";

export const getPoints = catchAsync(async (req: AuthRequest, res) => {
  const data = await getPointsSummary(req.user!._id);
  sendSuccess(res, data);
});
