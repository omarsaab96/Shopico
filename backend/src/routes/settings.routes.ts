import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { getSettingsHandler, updateSettingsHandler } from "../controllers/settingsController";

const router = Router();

router.get("/", getSettingsHandler);
router.put("/", authenticate, authorize("admin", "staff"), updateSettingsHandler);

export default router;
