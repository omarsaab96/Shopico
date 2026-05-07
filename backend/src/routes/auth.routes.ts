import { Router } from "express";
import { deleteMe, login, me, passwordStatus, refresh, register, setPassword, updateMe } from "../controllers/authController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/password-status", passwordStatus);
router.post("/set-password", setPassword);
router.post("/refresh", refresh);
router.get("/me", authenticate, me);
router.put("/me", authenticate, updateMe);
router.delete("/me", authenticate, deleteMe);

export default router;
