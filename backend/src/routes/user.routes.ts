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
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:about:manage"), requireBranchContext, createUser);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:about:manage"), requireBranchContext, updateUser);
router.get(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions(
    "users:about:view",
    "users:about:manage",
    "users:ledger:view",
    "users:ledger:manage",
    "users:branches:view",
    "users:branches:manage",
    "users:permissions:view",
    "users:permissions:manage"
  ),
  requireBranchContext,
  getUserDetails
);
router.put("/:id/permissions", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:permissions:manage"), requireBranchContext, updateUserPermissions);
router.put("/:id/branches", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:branches:manage"), requireBranchContext, updateUserBranches);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("users:about:manage"), requireBranchContext, deleteUser);

export default router;
