import { Router } from "express";
import { getImageKitAuth } from "../controllers/uploadController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/imagekit-auth", authenticate, authorize("admin", "staff"), getImageKitAuth);

export default router;
