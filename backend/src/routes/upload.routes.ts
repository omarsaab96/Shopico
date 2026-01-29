import { Router } from "express";
import { getImageKitAuth } from "../controllers/uploadController";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";

const router = Router();

router.get("/imagekit-auth", authenticate, authorize("admin", "manager", "staff"), requirePermissions("uploads:auth"), getImageKitAuth);

export default router;
