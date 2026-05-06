import { Router } from "express";
import { getCart, saveCart, syncCartHandler } from "../controllers/cartController";
import { authenticate } from "../middleware/auth";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, requireBranchContext, getCart);
router.put("/", authenticate, requireBranchContext, saveCart);
router.post("/sync", authenticate, requireBranchContext, syncCartHandler);

export default router;
