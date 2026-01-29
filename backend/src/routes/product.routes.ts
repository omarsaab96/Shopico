import { Router } from "express";
import multer from "multer";
import { bulkUpdatePrices, createProduct, deleteProduct, getProduct, importProductsFromExcel, listAllProductsAdmin, listProducts, listProductsAdminPaginated, previewProductsImport, updateProduct } from "../controllers/productController";
import { requireAnyPermissions } from "../middleware/auth";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { attachBranchContext, requireBranchContext } from "../middleware/branch";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/", attachBranchContext, listProducts);
router.get(
  "/admin/all",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("products:view", "products:manage"),
  requireBranchContext,
  listAllProductsAdmin
);
router.get(
  "/admin",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("products:view", "products:manage"),
  requireBranchContext,
  listProductsAdminPaginated
);
router.post("/bulk-price", authenticate, authorize("admin", "manager", "staff"), requirePermissions("products:manage"), requireBranchContext, bulkUpdatePrices);
router.post(
  "/import",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("products:import"),
  requireBranchContext,
  upload.single("file"),
  importProductsFromExcel
);
router.post(
  "/import/preview",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("products:import"),
  requireBranchContext,
  upload.single("file"),
  previewProductsImport
);
router.get("/:id", attachBranchContext, getProduct);
router.post("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("products:manage"), requireBranchContext, createProduct);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("products:manage"), requireBranchContext, updateProduct);
router.delete("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("products:manage"), requireBranchContext, deleteProduct);

export default router;
