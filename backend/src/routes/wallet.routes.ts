import { Router } from "express";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { adminListTopUps, adminTopUp, adminUpdateTopUp, createTopUp, getWallet } from "../controllers/walletController";

const router = Router();

router.get("/", authenticate, getWallet);
router.post("/topups", authenticate, createTopUp);
router.get(
  "/topups/admin",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("wallet:view", "wallet:manage"),
  adminListTopUps
);
router.put("/topups/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("wallet:manage"), adminUpdateTopUp);
router.post("/topups/admin/manual", authenticate, authorize("admin", "manager", "staff"), requirePermissions("wallet:manage"), adminTopUp);

export default router;
