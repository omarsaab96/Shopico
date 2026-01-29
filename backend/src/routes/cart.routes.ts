import { Router } from "express";
import { getCart, saveCart } from "../controllers/cartController";
import { authenticate } from "../middleware/auth";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, requireBranchContext, getCart);
router.put("/", authenticate, requireBranchContext, saveCart);

export default router;
