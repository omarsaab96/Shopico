import { Router } from "express";
import { adminUpdateOrder, createOrderHandler, getOrder, listOrders, listOrdersAdmin } from "../controllers/orderController";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";
import { requireBranchContext } from "../middleware/branch";

const router = Router();

router.get("/", authenticate, requireBranchContext, listOrders);
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

export default router;
