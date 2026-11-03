import { Router } from "express";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { getSettingsHandler, updateSettingsHandler, getSupportContactHandler } from "../controllers/settingsController";
import { attachBranchContext, requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/support", attachBranchContext, getSupportContactHandler);

router.get("/", authenticate, requireBranchContext, getSettingsHandler);
router.put("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("settings:view", "settings:manage"), requireBranchContext, updateSettingsHandler);

export default router;
