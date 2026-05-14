import { Router } from "express";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { requireBranchContext } from "../middleware/branch";
import {
  createCurrencyHandler,
  deleteCurrencyHandler,
  getCurrencies,
  updateCurrencyHandler,
} from "../controllers/currencyController";

const router = Router();

router.get("/", authenticate, requireBranchContext, getCurrencies);
router.post(
  "/",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("currencies:view", "currencies:manage"),
  requireBranchContext,
  createCurrencyHandler
);
router.put(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("currencies:view", "currencies:manage"),
  requireBranchContext,
  updateCurrencyHandler
);
router.delete(
  "/:id",
  authenticate,
  authorize("admin", "manager", "staff"),
  requirePermissions("currencies:view", "currencies:manage"),
  requireBranchContext,
  deleteCurrencyHandler
);

export default router;
