import { Router } from "express";
import multer from "multer";
import { bulkUpdatePrices, createProduct, deleteProduct, getProduct, importProductsFromExcel, listAllProductsAdmin, listProducts, listProductsAdminPaginated, previewProductsImport, updateProduct } from "../controllers/productController";
import { requireAnyPermissions } from "../middleware/auth";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/", listProducts);
router.get(
  "/admin/all",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("products:view", "products:manage"),
  listAllProductsAdmin
);
router.get(
  "/admin",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("products:view", "products:manage"),
  listProductsAdminPaginated
);
router.post("/bulk-price", authenticate, authorize("admin", "manager", "staff"), requirePermissions("products:manage"), bulkUpdatePrices);
router.post(
  "/import",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("products:import"),
  upload.single("file"),
  importProductsFromExcel
);
router.post(
  "/import/preview",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("products:import"),
  upload.single("file"),
  previewProductsImport
);
router.get("/:id", getProduct);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("products:manage"), createProduct);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("products:manage"), updateProduct);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("products:manage"), deleteProduct);

export default router;
