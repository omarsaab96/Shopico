import { Router } from "express";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { getSettingsHandler, updateSettingsHandler } from "../controllers/settingsController";

const router = Router();

router.get("/", getSettingsHandler);
router.put("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("settings:manage"), updateSettingsHandler);

export default router;
