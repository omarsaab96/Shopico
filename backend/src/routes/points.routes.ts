import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getPoints } from "../controllers/pointsController";

const router = Router();

router.get("/", authenticate, getPoints);

export default router;
