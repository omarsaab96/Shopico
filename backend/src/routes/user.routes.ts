import { Router } from "express";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { createUser, getUserDetails, listUsers, updateUserPermissions } from "../controllers/userController";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("users:view", "users:manage"),
  listUsers
);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:manage"), createUser);
router.get(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("users:view", "users:manage"),
  getUserDetails
);
router.put("/:id/permissions", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:manage"), updateUserPermissions);

export default router;
