import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { listAuditLogs } from "../controllers/auditController";

const router = Router();

router.get("/", authenticate, authorize("admin", "staff"), listAuditLogs);

export default router;
