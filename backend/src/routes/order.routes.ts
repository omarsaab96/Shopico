import { Router } from "express";
import { adminUpdateOrder, createOrderHandler, getOrder, listOrders, listOrdersAdmin } from "../controllers/orderController";
import { authenticate, authorize, requireAnyPermissions, requirePermissions } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, listOrders);
router.get(
  "/admin",
  authenticate,
  authorize("admin", "manager", "staff"),
  requireAnyPermissions("orders:view", "orders:update"),
  listOrdersAdmin
);
router.get("/:id", authenticate, getOrder);
router.post("/", authenticate, createOrderHandler);
router.put("/:id/status", authenticate, authorize("admin", "manager", "staff"), requirePermissions("orders:update"), adminUpdateOrder);

export default router;
