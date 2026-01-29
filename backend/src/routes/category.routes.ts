import { Router } from "express";
import { createCategory, deleteCategory, getCategories, updateCategory } from "../controllers/categoryController";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { attachBranchContext, requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", attachBranchContext, getCategories);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("categories:manage"), requireBranchContext, createCategory);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("categories:manage"), requireBranchContext, updateCategory);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("categories:manage"), requireBranchContext, deleteCategory);

export default router;
