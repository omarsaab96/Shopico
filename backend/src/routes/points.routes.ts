import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getPoints } from "../controllers/pointsController";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, requireBranchContext, getPoints);

export default router;
