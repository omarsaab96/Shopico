import { Router } from "express";
import {
  createBanner,
  deleteBanner,
  listActiveBanners,
  listBanners,
  updateBanner,
} from "../controllers/bannerController";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { attachBranchContext, requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/active", attachBranchContext, listActiveBanners);
router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("banners:view"),
  requireBranchContext,
  listBanners
);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("banners:view", "banners:manage"), requireBranchContext, createBanner);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("banners:view", "banners:manage"), requireBranchContext, updateBanner);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("banners:view", "banners:manage"), requireBranchContext, deleteBanner);

export default router;
