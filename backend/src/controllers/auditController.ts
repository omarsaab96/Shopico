import { catchAsync } from "../utils/catchAsync";
import { AuditLog } from "../models/AuditLog";
import { sendSuccess } from "../utils/response";

export const listAuditLogs = catchAsync(async (req, res) => {
  const { type, actor, result, from, to } = req.query as {
    type?: string;
    actor?: string;
    result?: string;
    from?: string;
    to?: string;
  };
  const filter: Record<string, unknown> = {};

  if (type) filter.type = { $regex: type, $options: "i" };
  if (result) filter.result = result.toUpperCase();
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) {
      const fromDate = new Date(from);
      if (!Number.isNaN(fromDate.getTime())) createdAt.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      if (!Number.isNaN(toDate.getTime())) createdAt.$lte = toDate;
    }
    if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  }

  if (actor) {
    const { User } = await import("../models/User");
    const users = await User.find({
      $or: [
        { email: { $regex: actor, $options: "i" } },
        { name: { $regex: actor, $options: "i" } },
      ],
    }).select("_id");
    filter.user = users.length ? { $in: users.map((user) => user._id) } : null;
  }

  const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(500).populate("user").populate("metadata.targetUserId");
  sendSuccess(res, logs);
});
