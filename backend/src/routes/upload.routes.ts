import { Router } from "express";
import { getImageKitAuth } from "../controllers/uploadController";
import { authenticate, authorize, requireAnyPermissions } from "../middleware/auth";

const router = Router();

router.get(
  "/imagekit-auth",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("uploads:auth", "products:manage", "categories:manage", "announcements:manage"),
  getImageKitAuth
);

export default router;
