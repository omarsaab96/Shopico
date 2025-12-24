import { Router } from "express";
import { createCategory, deleteCategory, getCategories, updateCategory } from "../controllers/categoryController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", getCategories);
router.post("/", authenticate, authorize("admin", "staff"), createCategory);
router.put("/:id", authenticate, authorize("admin", "staff"), updateCategory);
router.delete("/:id", authenticate, authorize("admin", "staff"), deleteCategory);

export default router;
