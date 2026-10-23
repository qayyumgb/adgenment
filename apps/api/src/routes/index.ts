import { Router } from "express";
import authRouter from "./auth";
import campaignRouter from "./campaigns";
import campaignStructureRouter from "./campaign-structure";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";
import adAccountRouter from "./ad-accounts";
import creativeRouter from "./creatives";
import audienceRouter from "./audiences";
import budgetOptimizerRouter from "./budget-optimizer";
import insightsRouter from "./insights";
import workspaceRouter from "./workspace";
import metaRouter from "./meta";
import googleRouter from "./google";
import tiktokRouter from "./tiktok";
import linkedinRouter from "./linkedin";
import clientRouter from "./clients";
import budgetsRouter from "./budgets";
import suggestionsRouter from "./suggestions";
import plansRouter from "./plans";
import changeLogRouter from "./change-log";
import invitesRouter from "./invites";
import { roleGuard } from "../lib/access";

const router = Router();

// Team roles (B6): every request with a token is checked here first.
router.use(roleGuard);

router.use("/auth", authRouter);
router.use("/campaigns", campaignRouter);
router.use("/campaigns", campaignStructureRouter);
router.use("/analytics", analyticsRouter);
router.use("/ai", aiRouter);
router.use("/ad-accounts", adAccountRouter);
router.use("/creatives", creativeRouter);
router.use("/audiences", audienceRouter);
router.use("/budget-optimizer", budgetOptimizerRouter);
router.use("/insights", insightsRouter);
router.use("/workspace", workspaceRouter);
router.use("/meta", metaRouter);
router.use("/google", googleRouter);
router.use("/tiktok", tiktokRouter);
router.use("/linkedin", linkedinRouter);
router.use("/clients", clientRouter);
router.use("/budgets", budgetsRouter);
router.use("/suggestions", suggestionsRouter);
router.use("/plans", plansRouter);
router.use("/change-log", changeLogRouter);
router.use("/invites", invitesRouter);

export default router;
