import { Router } from "express";
import {
  adminUpdateOrder,
  adminUpdateOrderDetails,
  assignDriver,
  createOrderHandler,
  getOrder,
  listDriverOrders,
  listOrders,
  listOrdersAdmin,
  rateDriver,
  updateDriverLocation,
  updateDriverStatus,
} from "../controllers/orderController";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { attachBranchContext, requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, attachBranchContext, listOrders);
router.get("/driver", authenticate, authorize("driver"), listDriverOrders);
router.get(
  "/admin",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("orders:view"),
  requireBranchContext,
  listOrdersAdmin
);
router.get("/:id", authenticate, attachBranchContext, getOrder);
router.post("/", authenticate, requireBranchContext, createOrderHandler);
router.put("/:id", authenticate, authorize("admin", "manager", "staff"), requirePermissions("orders:view", "orders:update"), requireBranchContext, adminUpdateOrderDetails);
router.put("/:id/status", authenticate, authorize("admin", "manager", "staff"), requirePermissions("orders:view", "orders:update"), requireBranchContext, adminUpdateOrder);
router.put(
  "/:id/assign-driver",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("orders:view", "orders:update"),
  requireBranchContext,
  assignDriver
);
router.put("/:id/driver-location", authenticate, authorize("driver", "admin", "manager", "staff"), updateDriverLocation);
router.put("/:id/driver-status", authenticate, authorize("driver"), updateDriverStatus);
router.post("/:id/driver-rating", authenticate, authorize("customer"), requireBranchContext, rateDriver);

export default router;
