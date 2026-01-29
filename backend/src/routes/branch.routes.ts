import { Router } from "express";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { createBranch, deleteBranch, getBranches, getMyBranches, updateBranch } from "../controllers/branchController";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("branches:view", "branches:manage"),
  getBranches
);
router.get("/me", authenticate, getMyBranches);
router.post(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("branches:manage"),
  createBranch
);
router.put(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("branches:manage"),
  updateBranch
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("branches:manage"),
  deleteBranch
);

export default router;
