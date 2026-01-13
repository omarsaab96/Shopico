import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { adminListTopUps, adminTopUp, adminUpdateTopUp, createTopUp, getWallet } from "../controllers/walletController";

const router = Router();

router.get("/", authenticate, getWallet);
router.post("/topups", authenticate, createTopUp);
router.get("/topups/admin", authenticate, authorize("admin", "staff"), adminListTopUps);
router.put("/topups/:id", authenticate, authorize("admin", "staff"), adminUpdateTopUp);
router.post("/topups/admin/manual", authenticate, authorize("admin", "staff"), adminTopUp);

export default router;
