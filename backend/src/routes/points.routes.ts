import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getPoints, redeemPoints, myCoupons } from "../controllers/pointsController";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, requireBranchContext, getPoints);
router.post("/redeem", authenticate, requireBranchContext, redeemPoints);
router.get("/coupons", authenticate, requireBranchContext, myCoupons);

export default router;
