import { Router } from "express";
import { bulkUpdatePrices, createProduct, deleteProduct, getProduct, listProducts, updateProduct } from "../controllers/productController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", listProducts);
router.post("/bulk-price", authenticate, authorize("admin", "staff"), bulkUpdatePrices);
router.get("/:id", getProduct);
router.post("/", authenticate, authorize("admin", "staff"), createProduct);
router.put("/:id", authenticate, authorize("admin", "staff"), updateProduct);
router.delete("/:id", authenticate, authorize("admin", "staff"), deleteProduct);

export default router;
