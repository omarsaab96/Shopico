import { Router } from "express";
import { createCategory, deleteCategory, getCategories, updateCategory } from "../controllers/categoryController";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";

const router = Router();

router.get("/", getCategories);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("categories:manage"), createCategory);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("categories:manage"), updateCategory);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("categories:manage"), deleteCategory);

export default router;
