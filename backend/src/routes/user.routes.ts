import { Router } from "express";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import {
  createUser,
  deleteUser,
  getUserDetails,
  listUsers,
  updateUser,
  updateUserBranches,
  updateUserPermissions,
} from "../controllers/userController";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("users:view", "users:manage"),
  requireBranchContext,
  listUsers
);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:manage"), requireBranchContext, createUser);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:manage"), requireBranchContext, updateUser);
router.get(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("users:view", "users:manage"),
  requireBranchContext,
  getUserDetails
);
router.put("/:id/permissions", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:manage"), requireBranchContext, updateUserPermissions);
router.put("/:id/branches", authenticate, authorize("admin", "manager", "staff"), requirePermissions("branches:assign"), requireBranchContext, updateUserBranches);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:manage"), requireBranchContext, deleteUser);

export default router;
