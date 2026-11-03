import type { NextFunction, Request, Response } from "express";
import { featureError, planOf, workspaceEntitlement, type Feature } from "./plans";

/**
 * The plan gate (C15), mounted right after roleGuard, which has already
 * loaded the member's access and the workspace's billing columns.
 *
 * - **Locked** (the trial ended with no plan): only Billing and Settings
 *   (/billing, /workspace) answer; everything else is 402 PLAN_LOCKED and the
 *   app shows its lock screen. Sign-in, invites and the public portal have no
 *   role check, so they never reach here; the portal checks the plan itself.
 * - **A feature the plan doesn't include:** 403 PLAN_FEATURE on the routes
 *   that turn it on. Turning something off (revoking a link, stopping a
 *   schedule, pausing automation) is always allowed.
 */

const OPEN_WHEN_LOCKED = /^\/(billing|workspace)(\/|$)/;
export const LOCKED_MESSAGE = "This workspace's free trial has ended. Choose a plan in Settings › Billing to keep using Advertix; your data is safe.";

type Body = Record<string, unknown>;
const offOnly = (b: Body) =>
  b.maxCutPct === undefined &&
  b.autoApplyMaxPct === undefined &&
  (b.automationPaused === undefined || b.automationPaused === true) &&
  (b.clients === undefined || (Array.isArray(b.clients) && b.clients.every((c: Body) => [c.pixel, c.cap, c.autoApply].every((v) => v === undefined || v === false))));

const FEATURE_ROUTES: { method: string; re: RegExp; feature: Feature; allow?: (body: Body) => boolean }[] = [
  { method: "PUT", re: /^\/approvals\/settings$/, feature: "approvals" },
  { method: "PUT", re: /^\/automation\/settings$/, feature: "automation", allow: offOnly },
  { method: "POST", re: /^\/shares$/, feature: "portal" },
  { method: "PATCH", re: /^\/shares\/[^/]+$/, feature: "portal" },
  { method: "PUT", re: /^\/reports\/schedule$/, feature: "reports", allow: (b) => b.active === false },
  { method: "POST", re: /^\/reports\/schedule\/test$/, feature: "reports" },
];

export async function planGate(req: Request, res: Response, next: NextFunction) {
  try {
    const access = req.access;
    if (!access) return next();
    // A workspace from before billing gets its 14 days now (written once).
    const plan = access.billing.trialEndsAt || access.billing.subscriptionStatus ? planOf(access.billing) : await workspaceEntitlement(access.workspaceId);
    if (plan.locked && !OPEN_WHEN_LOCKED.test(req.path)) return res.status(402).json({ error: LOCKED_MESSAGE, code: "PLAN_LOCKED" });
    const rule = FEATURE_ROUTES.find((r) => r.method === req.method && r.re.test(req.path));
    if (rule && !plan.features.includes(rule.feature) && !rule.allow?.((req.body ?? {}) as Body)) {
      const e = featureError(rule.feature);
      return res.status(403).json({ error: e.message, code: e.code, feature: e.feature, tier: e.tier });
    }
    next();
  } catch (err) {
    next(err);
  }
}
