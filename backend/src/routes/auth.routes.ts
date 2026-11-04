import { Router } from "express";
import { changeMyPassword, deleteMe, login, me, passwordStatus, refresh, register, sendEmailOtp, setPassword, updateMe, verifyEmailOtp } from "../controllers/authController";
import { authenticate } from "../middleware/auth";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/response";
import { NotificationDevice } from "../models/Notification";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/password-status", passwordStatus);
router.post("/set-password", setPassword);
router.post("/refresh", refresh);
router.get("/session", authenticate, (req, res) => {
  const payload = jwt.decode(req.headers.authorization!.substring(7)) as jwt.JwtPayload;
  sendSuccess(res, { expiresAt: payload.exp! * 1000, serverNow: Date.now(), warningMinutes: env.sessionExpiryWarningMinutes });
});
router.post("/logout", catchAsync(async (req, res) => {
  res.clearCookie("refreshToken", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.substring(7) : undefined;
  if (bearer && typeof req.body?.deviceToken === "string") {
    try {
      // A signed expired token may unbind only its own device when the session ends.
      const payload = jwt.verify(bearer, env.jwtSecret, { ignoreExpiration: true }) as jwt.JwtPayload;
      await NotificationDevice.deleteOne({ user: payload.sub, token: req.body.deviceToken });
    } catch { /* Cookie logout also works without a valid bearer token. */ }
  }
  sendSuccess(res, { loggedOut: true });
}));
router.get("/me", authenticate, me);
router.put("/me", authenticate, updateMe);
router.put("/me/password", authenticate, changeMyPassword);
router.post("/me/email/send-otp", authenticate, sendEmailOtp);
router.post("/me/email/verify", authenticate, verifyEmailOtp);
router.delete("/me", authenticate, deleteMe);

export default router;
