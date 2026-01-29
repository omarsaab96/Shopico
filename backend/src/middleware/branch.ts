import { Types } from "mongoose";
import { AuthRequest } from "../types/auth";
import { Response, NextFunction } from "express";

const toId = (value: any) => {
  try {
    return value ? new Types.ObjectId(String(value)) : null;
  } catch {
    return null;
  }
};

export const resolveBranchId = (req: AuthRequest) => {
  const user = req.user;
  const branchIds = (user as any)?.branchIds as Types.ObjectId[] | undefined;
  if (!branchIds || branchIds.length === 0) return null;
  if (branchIds.length === 1) return branchIds[0].toString();
  const selected = req.headers["x-branch-id"] || (req.query as any)?.branchId;
  const selectedId = toId(selected)?.toString();
  if (!selectedId) return null;
  const allowed = branchIds.some((id) => id.toString() === selectedId);
  return allowed ? selectedId : null;
};

export const attachBranchContext = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const selected = req.headers["x-branch-id"] || (req.query as any)?.branchId;
  const selectedId = toId(selected)?.toString();
  if (req.user) {
    const resolved = resolveBranchId(req);
    if (resolved) req.branchId = resolved;
    else if (selectedId) req.branchId = selectedId;
  } else if (selectedId) {
    req.branchId = selectedId;
  }
  return next();
};

export const requireBranchContext = (req: AuthRequest, res: Response, next: NextFunction) => {
  const branchId = resolveBranchId(req);
  if (!branchId) {
    return res.status(403).json({ success: false, message: "Branch access required" });
  }
  req.branchId = branchId;
  return next();
};
