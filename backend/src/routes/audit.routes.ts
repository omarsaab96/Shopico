import { Router } from "express";
import { authenticate, authorize, requirePermissions } from "../middleware/auth";
import { listAuditLogs } from "../controllers/auditController";

const router = Router();

router.get("/", authenticate, authorize("admin", "manager", "staff"), requirePermissions("audit:view"), listAuditLogs);

export default router;
