import { NextFunction, Response } from "express";
import { AuditLog } from "../models/AuditLog";
import { AuthRequest } from "../types/auth";

const ignoredMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const ignoredPathPrefixes = ["/api/audit", "/api/health"];

const getTypeFromPath = (path: string) => {
  const [, apiPrefix, resource] = path.split("/");
  if (apiPrefix !== "api") return "system";
  return resource || "system";
};

const normalizeAction = (method: string, path: string) => `${method.toUpperCase()} ${path.replace(/^\/api/, "") || "/"}`;

export const auditRequests = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (ignoredMethods.has(req.method) || ignoredPathPrefixes.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  const startedAt = Date.now();
  res.on("finish", () => {
    const statusCode = res.statusCode;
    AuditLog.create({
      user: req.user?._id,
      type: getTypeFromPath(req.path),
      action: normalizeAction(req.method, req.path),
      result: statusCode >= 400 ? "FAILURE" : "SUCCESS",
      metadata: {
        method: req.method,
        path: req.originalUrl,
        statusCode,
        branchId: req.branchId,
        durationMs: Date.now() - startedAt,
      },
    }).catch((error) => {
      console.error("Audit request log failed:", error);
    });
  });

  return next();
};
