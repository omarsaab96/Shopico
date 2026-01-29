import { Router } from "express";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { adminCreateTopUpRequest, adminListTopUps, adminTopUp, adminUpdateTopUp, createTopUp, getWallet } from "../controllers/walletController";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, requireBranchContext, getWallet);
router.post("/topups", authenticate, requireBranchContext, createTopUp);
router.get(
  "/topups/admin",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("wallet:topups:view", "wallet:manage"),
  requireBranchContext,
  adminListTopUps
);
router.post(
  "/topups/admin/request",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("wallet:topups:create"),
  requireBranchContext,
  adminCreateTopUpRequest
);
router.put("/topups/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("wallet:manage"), requireBranchContext, adminUpdateTopUp);
router.post("/topups/admin/manual", authenticate, authorize("admin", "manager", "staff"), requirePermissions("wallet:manage"), requireBranchContext, adminTopUp);

export default router;
