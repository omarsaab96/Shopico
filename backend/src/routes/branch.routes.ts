import { Router } from "express";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { createBranch, deleteBranch, getBranches, getMyBranches, updateBranch, getNearestBranch, getPublicBranches } from "../controllers/branchController";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("branches:view"),
  getBranches
);
router.get("/nearest", getNearestBranch);
router.get("/public", getPublicBranches);
router.get("/me", authenticate, getMyBranches);
router.post(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("branches:view", "branches:manage"),
  createBranch
);
router.put(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("branches:view", "branches:manage"),
  updateBranch
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("branches:view", "branches:manage"),
  deleteBranch
);

export default router;
