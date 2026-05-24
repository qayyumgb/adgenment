import { Router } from "express";
import authRoutes from "./auth";
import campaignRoutes from "./campaigns";
import analyticsRoutes from "./analytics";
import aiRoutes from "./ai";

const router = Router();

router.use("/auth", authRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/ai", aiRoutes);

export default router;
