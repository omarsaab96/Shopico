import { Router } from "express";
import { adminUpdateOrder, createOrderHandler, getOrder, listOrders, listOrdersAdmin } from "../controllers/orderController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.get("/", authenticate, listOrders);
router.get("/admin", authenticate, authorize("admin", "staff"), listOrdersAdmin);
router.get("/:id", authenticate, getOrder);
router.post("/", authenticate, createOrderHandler);
router.put("/:id/status", authenticate, authorize("admin", "staff"), adminUpdateOrder);

export default router;
