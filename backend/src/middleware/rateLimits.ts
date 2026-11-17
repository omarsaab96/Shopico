import { Router } from "express";
import rateLimit from "express-rate-limit";

export const createRateLimits = (limit = process.env.NODE_ENV === "production" ? 200 : 5000) => {
  const router = Router();
  const options = {
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests. Please try again later." },
  };
  // Separate stores keep browsing traffic from exhausting the sign-in allowance.
  const authLimiter = rateLimit(options);
  const apiLimiter = rateLimit(options);
  router.use((req, res, next) => {
    const isAuth = /^\/api\/auth(?:\/|$)/i.test(req.path);
    return (isAuth ? authLimiter : apiLimiter)(req, res, next);
  });
  return router;
};
