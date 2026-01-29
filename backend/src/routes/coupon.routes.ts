import { Router } from "express";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { createCoupon, deleteCoupon, listAvailableCoupons, listCoupons, updateCoupon, validateCoupon } from "../controllers/couponController";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("coupons:view", "coupons:manage"),
  requireBranchContext,
  listCoupons
);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("coupons:manage"), requireBranchContext, createCoupon);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("coupons:manage"), requireBranchContext, updateCoupon);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("coupons:manage"), requireBranchContext, deleteCoupon);
router.post("/available", authenticate, requireBranchContext, listAvailableCoupons);
router.post("/validate", authenticate, requireBranchContext, validateCoupon);

export default router;
