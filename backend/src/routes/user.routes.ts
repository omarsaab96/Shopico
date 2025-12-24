import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { getUserDetails, listUsers } from "../controllers/userController";

const router = Router();

router.get("/", authenticate, authorize("admin", "staff"), listUsers);
router.get("/:id", authenticate, authorize("admin", "staff"), getUserDetails);

export default router;
