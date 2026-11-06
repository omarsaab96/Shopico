import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { requireBranchContext } from "../middleware/branch";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { listCashSettlements, settleDriverCash } from "../services/cashSettlementService";

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export const cashSettlementSchema = z.object({
  branchId: objectId,
  driverId: objectId,
  requestId: z.uuid(),
  orders: z.array(z.object({ orderId: objectId, expectedTotal: z.number().finite().nonnegative(), currencyId: objectId }))
    .min(1).max(1000).refine(orders => new Set(orders.map(order => order.orderId)).size === orders.length, "Duplicate orders"),
  note: z.string().trim().max(500).optional(),
});
const router = Router();
router.use(authenticate, authorize("admin", "manager", "staff"), requireBranchContext);
router.get("/", requirePermissions("cash-settlements:view"), catchAsync(async (req, res) => {
  sendSuccess(res, await listCashSettlements(req.branchId!));
}));
router.post("/", requirePermissions("cash-settlements:view", "cash-settlements:manage"), catchAsync(async (req, res) => {
  const input = cashSettlementSchema.parse(req.body);
  if (input.branchId !== req.branchId) return res.status(409).json({ success: false, message: "Branch changed. Refresh before settling cash" });
  sendSuccess(res, await settleDriverCash(req.branchId!, req.user!._id, input));
}));
export default router;
