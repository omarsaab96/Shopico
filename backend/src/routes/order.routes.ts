import { Router } from "express";
import {
  adminUpdateOrder,
  assignDriver,
  createOrderHandler,
  getOrder,
  listDriverOrders,
  listOrders,
  listOrdersAdmin,
  updateDriverLocation,
  updateDriverStatus,
} from "../controllers/orderController";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, requireBranchContext, listOrders);
router.get("/driver", authenticate, authorize("driver"), listDriverOrders);
router.get(
  "/admin",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("orders:view", "orders:update"),
  requireBranchContext,
  listOrdersAdmin
);
router.get("/:id", authenticate, requireBranchContext, getOrder);
router.post("/", authenticate, requireBranchContext, createOrderHandler);
router.put("/:id/status", authenticate, authorize("admin", "manager", "staff"), requirePermissions("orders:update"), requireBranchContext, adminUpdateOrder);
router.put(
  "/:id/assign-driver",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("orders:update"),
  requireBranchContext,
  assignDriver
);
router.put("/:id/driver-location", authenticate, authorize("driver", "admin", "manager", "staff"), updateDriverLocation);
router.put("/:id/driver-status", authenticate, authorize("driver"), updateDriverStatus);

export default router;
