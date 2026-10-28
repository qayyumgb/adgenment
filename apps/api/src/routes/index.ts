import { Router } from "express";
import authRouter from "./auth";
import campaignRouter from "./campaigns";
import campaignStructureRouter from "./campaign-structure";
import autoPauseRouter from "./auto-pause";
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
import connectionsRouter from "./connections";
import approvalsRouter from "./approvals";
import automationRouter from "./automation";
import alertsRouter from "./alerts";
import { publicPortalRouter, sharesRouter } from "./portal";
import reportsRouter from "./reports";
import billingRouter from "./billing";
import calendarRouter from "./calendar";
import { roleGuard } from "../lib/access";
import { approvalGate, registerApprovalReplay } from "../services/approvals.service";

const router = Router();

// Team roles (B6): every request with a token is checked here first.
router.use(roleGuard);
// Approvals (C1): a Media buyer's spend change may wait for an owner instead of running.
router.use(approvalGate);

router.use("/auth", authRouter);
router.use("/campaigns", campaignRouter);
router.use("/campaigns", campaignStructureRouter);
router.use("/campaigns", autoPauseRouter);
router.use("/analytics", analyticsRouter);
router.use("/ai", aiRouter);
router.use("/ad-accounts", adAccountRouter);
router.use("/connections", connectionsRouter);
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
router.use("/approvals", approvalsRouter);
router.use("/automation", automationRouter);
router.use("/alerts", alertsRouter);
router.use("/shares", sharesRouter);
router.use("/reports", reportsRouter);
router.use("/billing", billingRouter);
router.use("/calendar", calendarRouter);
// Public (C4): the client portal; the token in the link is the only key.
router.use("/portal", publicPortalRouter);

// Approving replays the held request through this same router.
registerApprovalReplay(router);

export default router;
