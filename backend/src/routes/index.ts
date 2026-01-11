import { Router } from "express";
import authRoutes from "./auth.routes";
import categoryRoutes from "./category.routes";
import productRoutes from "./product.routes";
import cartRoutes from "./cart.routes";
import orderRoutes from "./order.routes";
import walletRoutes from "./wallet.routes";
import pointsRoutes from "./points.routes";
import settingsRoutes from "./settings.routes";
import uploadRoutes from "./upload.routes";
import userRoutes from "./user.routes";
import auditRoutes from "./audit.routes";
import addressRoutes from "./address.routes";
import promotionRoutes from "./promotion.routes";

const router = Router();

router.get("/health", (_req, res) => res.json({ success: true, message: "OK" }));
router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/cart", cartRoutes);
router.use("/orders", orderRoutes);
router.use("/wallet", walletRoutes);
router.use("/points", pointsRoutes);
router.use("/settings", settingsRoutes);
router.use("/uploads", uploadRoutes);
router.use("/users", userRoutes);
router.use("/audit", auditRoutes);
router.use("/addresses", addressRoutes);
router.use("/promotions", promotionRoutes);

export default router;
