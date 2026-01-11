import { Router } from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  listActiveAnnouncements,
  listAnnouncements,
  updateAnnouncement,
} from "../controllers/announcementController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/active", listActiveAnnouncements);
router.get("/", authenticate, authorize("admin", "staff"), listAnnouncements);
router.post("/", authenticate, authorize("admin", "staff"), createAnnouncement);
router.put("/:id", authenticate, authorize("admin", "staff"), updateAnnouncement);
router.delete("/:id", authenticate, authorize("admin", "staff"), deleteAnnouncement);

export default router;
