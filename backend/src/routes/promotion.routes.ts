import { Router } from "express";
import {
  createPromotion,
  deletePromotion,
  listActivePromotions,
  listPromotions,
  updatePromotion,
} from "../controllers/promotionController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/active", listActivePromotions);
router.get("/", authenticate, authorize("admin", "staff"), listPromotions);
router.post("/", authenticate, authorize("admin", "staff"), createPromotion);
router.put("/:id", authenticate, authorize("admin", "staff"), updatePromotion);
router.delete("/:id", authenticate, authorize("admin", "staff"), deletePromotion);

export default router;
