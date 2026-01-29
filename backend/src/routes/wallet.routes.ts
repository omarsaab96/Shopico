import { Router } from "express";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { adminCreateTopUpRequest, adminListTopUps, adminTopUp, adminUpdateTopUp, createTopUp, getWallet } from "../controllers/walletController";

const router = Router();

router.get("/", authenticate, getWallet);
router.post("/topups", authenticate, createTopUp);
router.get(
  "/topups/admin",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("wallet:topups:view", "wallet:manage"),
  adminListTopUps
);
router.post(
  "/topups/admin/request",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("wallet:topups:create"),
  adminCreateTopUpRequest
);
router.put("/topups/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("wallet:manage"), adminUpdateTopUp);
router.post("/topups/admin/manual", authenticate, authorize("admin", "manager", "staff"), requirePermissions("wallet:manage"), adminTopUp);

export default router;
