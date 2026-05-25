import { Router } from "express";
import authRouter from "./auth";
import campaignRouter from "./campaigns";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";
import adAccountRouter from "./ad-accounts";
import creativeRouter from "./creatives";
import workspaceRouter from "./workspace";
import metaRouter from "./meta";
import googleRouter from "./google";

const router = Router();

router.use("/auth", authRouter);
router.use("/campaigns", campaignRouter);
router.use("/analytics", analyticsRouter);
router.use("/ai", aiRouter);
router.use("/ad-accounts", adAccountRouter);
router.use("/creatives", creativeRouter);
router.use("/workspace", workspaceRouter);
router.use("/meta", metaRouter);
router.use("/google", googleRouter);

export default router;
