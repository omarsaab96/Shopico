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
  requirePermissions("users:view"),
  requireBranchContext,
  listUsers
);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:view", "users:about:view", "users:about:manage"), requireBranchContext, createUser);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:view", "users:about:view", "users:about:manage"), requireBranchContext, updateUser);
router.get(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("users:view"),
  requireAnyPermissions("users:about:view", "users:ledger:view", "users:branches:view", "users:permissions:view"),
  requireBranchContext,
  getUserDetails
);
router.put("/:id/permissions", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:view", "users:permissions:view", "users:permissions:manage"), requireBranchContext, updateUserPermissions);
router.put("/:id/branches", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:view", "users:branches:view", "users:branches:manage"), requireBranchContext, updateUserBranches);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:view", "users:about:view", "users:about:manage"), requireBranchContext, deleteUser);

export default router;
