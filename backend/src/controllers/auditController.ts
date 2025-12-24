import { catchAsync } from "../utils/catchAsync";
import { AuditLog } from "../models/AuditLog";
import { sendSuccess } from "../utils/response";

export const listAuditLogs = catchAsync(async (_req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200).populate("user");
  sendSuccess(res, logs);
});
