import { Router } from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  listActiveAnnouncements,
  listAnnouncements,
  updateAnnouncement,
} from "../controllers/announcementController";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";

const router = Router();

router.get("/active", listActiveAnnouncements);
router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("announcements:view", "announcements:manage"),
  listAnnouncements
);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("announcements:manage"), createAnnouncement);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("announcements:manage"), updateAnnouncement);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("announcements:manage"), deleteAnnouncement);

export default router;
