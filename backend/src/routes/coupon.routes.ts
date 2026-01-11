import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { createCoupon, deleteCoupon, listCoupons, updateCoupon, validateCoupon } from "../controllers/couponController";

const router = Router();

router.get("/", authenticate, authorize("admin", "staff"), listCoupons);
router.post("/", authenticate, authorize("admin", "staff"), createCoupon);
router.put("/:id", authenticate, authorize("admin", "staff"), updateCoupon);
router.delete("/:id", authenticate, authorize("admin", "staff"), deleteCoupon);
router.post("/validate", authenticate, validateCoupon);

export default router;
