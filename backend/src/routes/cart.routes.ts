import { Router } from "express";
import { getCart, saveCart } from "../controllers/cartController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, getCart);
router.put("/", authenticate, saveCart);

export default router;
