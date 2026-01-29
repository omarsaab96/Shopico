import { Router } from "express";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { getSettingsHandler, updateSettingsHandler } from "../controllers/settingsController";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, requireBranchContext, getSettingsHandler);
router.put("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("settings:manage"), requireBranchContext, updateSettingsHandler);

export default router;
