import { Branch } from "../models/Branch";

export const getDefaultBranchId = async () => {
  const branch = await Branch.findOne().sort({ createdAt: 1 }).select("_id");
  return branch?._id || null;
};
