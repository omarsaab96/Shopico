import { Router } from "express";
import { login, me, passwordStatus, refresh, register, setPassword } from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/password-status", passwordStatus);
router.post("/set-password", setPassword);
router.post("/refresh", refresh);
router.get("/me", authenticate, me);

export default router;
