import { Router } from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  listActiveAnnouncements,
  listAnnouncements,
  updateAnnouncement,
} from "../controllers/announcementController";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { attachBranchContext, requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/active", attachBranchContext, listActiveAnnouncements);
router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("announcements:view"),
  requireBranchContext,
  listAnnouncements
);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("announcements:view", "announcements:manage"), requireBranchContext, createAnnouncement);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("announcements:view", "announcements:manage"), requireBranchContext, updateAnnouncement);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("announcements:view", "announcements:manage"), requireBranchContext, deleteAnnouncement);

export default router;
