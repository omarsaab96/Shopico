import { Router } from "express";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { createCoupon, deleteCoupon, listAvailableCoupons, listCoupons, updateCoupon, validateCoupon } from "../controllers/couponController";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("coupons:view", "coupons:manage"),
  listCoupons
);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("coupons:manage"), createCoupon);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("coupons:manage"), updateCoupon);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("coupons:manage"), deleteCoupon);
router.post("/available", authenticate, listAvailableCoupons);
router.post("/validate", authenticate, validateCoupon);

export default router;
