import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models/User";
import { AuthRequest } from "../types/auth";
import { UserRole } from "../types";
import { Permission } from "../constants/permissions";

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

export const authorize =
  (...roles: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    return next();
  };

export const requirePermissions =
  (...permissions: Permission[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const userPermissions = req.user?.permissions || [];
    const hasAll = permissions.every((permission) => userPermissions.includes(permission));
    if (!hasAll) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    return next();
  };

export const requireAnyPermissions =
  (...permissions: Permission[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const userPermissions = req.user?.permissions || [];
    const hasAny = permissions.some((permission) => userPermissions.includes(permission));
    if (!hasAny) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    return next();
  };
