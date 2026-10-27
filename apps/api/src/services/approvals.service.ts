/**
 * Approvals (plan C1). A Media buyer's spend change waits for an owner when
 *   - it raises a live Meta campaign or ad set budget by more than the
 *     workspace limit (`Workspace.approvalBudgetPct`, default 20%), or
 *   - it touches a client marked "Ask first" (`Client.askFirst`).
 * Owners never wait; analysts and client viewers can't change spend anyway.
 *
 * `approvalGate` holds the request (202 + an ApprovalRequest) instead of
 * running it. Approving replays the same API request as the requester, so it
 * goes through the exact same route code (role check, client limits, push to
 * Meta, change log). The change log notes the approval (approval-context).
 * With `Workspace.approvalTimeout` set, requests nobody answered within 24
 * hours are approved or rejected automatically.
 */

import type { NextFunction, Request, Response, Router } from "express";
import { Prisma, type ApprovalRequest, type ApprovalTimeout } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getAccess, type Access } from "../lib/access";
import { money } from "../lib/format";
import { approvalContext } from "../lib/approval-context";
import { allocatable } from "./allocator.service";
import { notifyMembers } from "./notifications.service";

export const APPROVAL_TIMEOUT_MS = 24 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set only on an approval replay (never from HTTP): skip the gate. */
      approvalReplay?: { id: string };
    }
  }
}

type Held = { summary: string; reason: string; campaignId: string | null; campaignName: string; clientId: string | null };

/* ── Rules ─────────────────────────────────────────────────────────────────── */

/** Requests the gate looks at; everything else passes straight through. */
const WATCHED: { method: string; re: RegExp }[] = [
  { method: "PUT", re: /^\/campaigns\/([^/]+)$/ },
  { method: "POST", re: /^\/campaigns\/([^/]+)\/launch$/ },
  { method: "POST", re: /^\/campaigns\/([^/]+)\/publish$/ },
  { method: "DELETE", re: /^\/campaigns\/([^/]+)$/ },
  { method: "POST", re: /^\/campaigns\/([^/]+)\/adsets\/([^/]+)\/(budget|status)$/ },
  { method: "POST", re: /^\/campaigns\/([^/]+)\/ads\/([^/]+)\/status$/ },
  { method: "POST", re: /^\/suggestions\/([^/]+)\/apply$/ },
  { method: "POST", re: /^\/budgets\/allocator\/apply$/ },
  { method: "POST", re: /^\/change-log\/([^/]+)\/undo$/ },
  { method: "POST", re: /^\/suggestions\/([^/]+)\/undo$/ },
];

const pctUp = (from: number, to: number) => (from > 0 ? ((to - from) / from) * 100 : to > 0 ? Infinity : 0);
const fmtPct = (p: number) => (Number.isFinite(p) ? `${Math.round(p)}%` : "from zero");

async function loadCampaign(workspaceId: string, id: string) {
  return prisma.campaign.findFirst({
    where: { id, workspaceId },
    include: { adAccount: { select: { currency: true, client: { select: { id: true, name: true, askFirst: true } } } } },
  });
}

/** Why this request needs an owner, or null when it can go ahead. */
async function evaluate(workspaceId: string, method: string, path: string, body: Record<string, unknown>): Promise<Held | null> {
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { approvalBudgetPct: true } });
  const limit = ws.approvalBudgetPct;
  const overLimit = (from: number, to: number) => limit !== null && to > from && pctUp(from, to) > limit;
  const askFirstReason = (name: string) => `${name} is an “Ask first” client`;
  const limitReason = (from: number, to: number, cur: string | null) =>
    `Raises the budget ${fmtPct(pctUp(from, to))} (${money(from, cur)} → ${money(to, cur)}), above the ${limit}% limit`;

  let m: RegExpMatchArray | null;

  // Suggestion apply: the suggestion carries the change.
  if ((m = path.match(/^\/suggestions\/([^/]+)\/apply$/))) {
    const s = await prisma.suggestion.findFirst({ where: { id: m[1], workspaceId } });
    if (!s?.campaignId) return null;
    const c = await loadCampaign(workspaceId, s.campaignId);
    if (!c) return null;
    const client = c.adAccount.client;
    const p = (s.actionPayload ?? {}) as { dailyBudget?: number };
    const held = (reason: string): Held => ({ summary: `Apply suggestion: ${s.title}`, reason, campaignId: c.id, campaignName: c.name, clientId: client?.id ?? null });
    if (client?.askFirst) return held(askFirstReason(client.name));
    if (s.actionType === "SET_DAILY_BUDGET" && overLimit(Number(c.budget), Number(p.dailyBudget))) return held(limitReason(Number(c.budget), Number(p.dailyBudget), c.adAccount.currency));
    return null;
  }

  // Budget allocator: one client, a new daily total per platform (Meta is applied).
  if (path === "/budgets/allocator/apply") {
    const clientId = typeof body.clientId === "string" ? body.clientId : "";
    const client = await prisma.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true, name: true, askFirst: true } });
    if (!client) return null;
    const targets = (body.targets ?? {}) as Record<string, unknown>;
    const campaigns = (await allocatable(workspaceId, clientId)).filter((c) => c.platform === "META");
    const from = campaigns.reduce((a, c) => a + Number(c.budget), 0);
    const to = Number(targets.META);
    const cur = campaigns[0]?.adAccount.currency ?? null;
    const summary = Number.isFinite(to) && to > 0 ? `Apply budget split for ${client.name}: Meta ${money(from, cur)} → ${money(to, cur)} a day` : `Apply budget split for ${client.name}`;
    const held = (reason: string): Held => ({ summary, reason, campaignId: null, campaignName: `${client.name} · budget split`, clientId: client.id });
    if (client.askFirst) return held(askFirstReason(client.name));
    if (Number.isFinite(to) && overLimit(from, to)) return held(limitReason(from, to, cur));
    return null;
  }

  // Undo: judged by what it would change, like the edit itself.
  if ((m = path.match(/^\/(change-log|suggestions)\/([^/]+)\/undo$/))) {
    const e =
      m[1] === "change-log"
        ? await prisma.changeLog.findFirst({ where: { id: m[2], workspaceId } })
        : await prisma.changeLog.findFirst({ where: { workspaceId, suggestionId: m[2], undoneAt: null }, orderBy: { createdAt: "desc" } });
    if (!e?.campaignId || e.undoneAt) return null;
    const c = await loadCampaign(workspaceId, e.campaignId);
    if (!c || c.platform !== "META" || !c.externalId) return null;
    const client = c.adAccount.client;
    const before = (e.before ?? {}) as Record<string, unknown>;
    const held = (reason: string): Held => ({ summary: `Undo: ${e.summary}`, reason, campaignId: c.id, campaignName: c.name, clientId: client?.id ?? null });
    if (e.action === "campaign.rename") return null;
    if (client?.askFirst) return held(askFirstReason(client.name));
    if (e.action === "campaign.budget") {
      const from = Number(c.budget);
      const to = Number(before.budget);
      return overLimit(from, to) ? held(limitReason(from, to, c.adAccount.currency)) : null;
    }
    if (e.action === "adset.budget") {
      const s = await prisma.adSet.findFirst({ where: { id: String(((e.after ?? {}) as Record<string, unknown>).adSetId), campaignId: c.id }, select: { dailyBudget: true } });
      const from = Number(s?.dailyBudget ?? 0);
      const to = Number(before.dailyBudget);
      return overLimit(from, to) ? held(limitReason(from, to, c.adAccount.currency)) : null;
    }
    return null;
  }

  // Campaign, ad set and ad routes.
  if (!(m = path.match(/^\/campaigns\/([^/]+)/))) return null;
  const c = await loadCampaign(workspaceId, m[1]);
  if (!c) return null;
  const client = c.adAccount.client;
  const cur = c.adAccount.currency;
  const live = c.platform === "META" && Boolean(c.externalId);
  const held = (summary: string, reason: string): Held => ({ summary, reason, campaignId: c.id, campaignName: c.name, clientId: client?.id ?? null });
  const status = typeof body.status === "string" ? body.status : null;

  if (path.endsWith("/publish")) {
    return client?.askFirst ? held("Publish to Meta", askFirstReason(client.name)) : null;
  }
  if (method === "DELETE") {
    return client?.askFirst && live ? held("Delete the campaign (on Meta too)", askFirstReason(client.name)) : null;
  }
  // Drafts and read-only platforms don't spend from Advertix: nothing to hold.
  if (!live) return null;

  if (path.endsWith("/launch")) {
    return client?.askFirst ? held(status === "PAUSED" ? "Pause the campaign" : "Resume the campaign", askFirstReason(client.name)) : null;
  }
  let a: RegExpMatchArray | null;
  if ((a = path.match(/\/adsets\/([^/]+)\/(budget|status)$/))) {
    const s = await prisma.adSet.findFirst({ where: { id: a[1], campaignId: c.id } });
    if (!s) return null;
    if (a[2] === "status") return client?.askFirst ? held(`${status === "PAUSED" ? "Pause" : "Resume"} ad set “${s.name}”`, askFirstReason(client.name)) : null;
    const from = Number(s.dailyBudget ?? 0);
    const to = Number(body.dailyBudget);
    const summary = `Change ad set “${s.name}” daily budget from ${money(from, cur)} to ${money(to, cur)}`;
    if (client?.askFirst) return held(summary, askFirstReason(client.name));
    return overLimit(from, to) ? held(summary, limitReason(from, to, cur)) : null;
  }
  if ((a = path.match(/\/ads\/([^/]+)\/status$/))) {
    if (!client?.askFirst) return null;
    const ad = await prisma.ad.findFirst({ where: { id: a[1], adSet: { campaignId: c.id } }, select: { name: true } });
    return held(`${status === "PAUSED" ? "Pause" : "Resume"} ad “${ad?.name ?? "ad"}”`, askFirstReason(client.name));
  }

  // PUT /campaigns/:id
  const spendFields = ["budget", "status", "budgetType", "startDate", "endDate", "targeting", "audienceId"].filter((k) => body[k] !== undefined);
  if (!spendFields.length) return null;
  const from = Number(c.budget);
  const to = body.budget !== undefined ? Number(body.budget) : from;
  // Published before we tracked the ad set: the route refuses budget changes
  // for everyone, so let it say so now rather than after an owner approves.
  if (to !== from && !c.externalAdSetId) return null;
  const parts = [
    body.budget !== undefined && to !== from ? `change the budget from ${money(from, cur)} to ${money(to, cur)}` : null,
    status && status !== c.status ? (status === "PAUSED" ? "pause it" : status === "ACTIVE" ? "resume it" : `set it to ${status.toLowerCase()}`) : null,
    spendFields.some((k) => ["startDate", "endDate", "targeting", "audienceId", "budgetType"].includes(k)) ? "edit schedule or targeting" : null,
  ].filter(Boolean) as string[];
  const summary = parts.length ? parts.join(", ").replace(/^./, (x) => x.toUpperCase()) : "Edit the campaign";
  if (client?.askFirst) return held(summary, askFirstReason(client.name));
  return overLimit(from, to) ? held(summary, limitReason(from, to, cur)) : null;
}

/* ── Gate ──────────────────────────────────────────────────────────────────── */

const view = (a: ApprovalRequest & { requestedBy?: { name: string | null; email: string }; decidedBy?: { name: string | null; email: string } | null; client?: { name: string } | null }) => ({
  id: a.id,
  status: a.status,
  summary: a.summary,
  reason: a.reason,
  campaignId: a.campaignId,
  campaignName: a.campaignName,
  clientId: a.clientId,
  clientName: a.client?.name ?? null,
  requestedById: a.requestedById,
  requestedBy: a.requestedBy ? a.requestedBy.name ?? a.requestedBy.email : null,
  decidedBy: a.decidedBy ? a.decidedBy.name ?? a.decidedBy.email : null,
  decidedAt: a.decidedAt,
  decidedVia: a.decidedVia,
  note: a.note,
  error: a.error,
  createdAt: a.createdAt,
});

/** Mounted after roleGuard: holds a Media buyer's spend change when a rule says so. */
export async function approvalGate(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.approvalReplay || !WATCHED.some((w) => w.method === req.method && w.re.test(req.path))) return next();
    const access = await getAccess(req);
    if (!access || access.role !== "MEDIA_BUYER") return next();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const held = await evaluate(access.workspaceId, req.method, req.path, body);
    if (!held) return next();

    // Asking twice for the same thing returns the request already waiting.
    const same = await prisma.approvalRequest.findFirst({ where: { workspaceId: access.workspaceId, requestedById: req.dbUserId!, status: "PENDING", method: req.method, path: req.path }, orderBy: { createdAt: "desc" } });
    const a =
      same && JSON.stringify(same.body ?? {}) === JSON.stringify(body)
        ? same
        : await prisma.approvalRequest.create({
            data: {
              workspaceId: access.workspaceId,
              clientId: held.clientId,
              campaignId: held.campaignId,
              campaignName: held.campaignName.slice(0, 200),
              method: req.method,
              path: req.path,
              body: body as Prisma.InputJsonValue,
              summary: held.summary.slice(0, 300),
              reason: held.reason.slice(0, 300),
              requestedById: req.dbUserId!,
            },
          });
    if (a !== same) void notifyRequested(a, req.user?.name ?? req.user?.email ?? "A media buyer");
    res.status(202).json({ pendingApproval: true, approval: view(a), message: `Sent to an owner for approval: ${held.reason}.` });
  } catch (err) {
    next(err);
  }
}

/* ── Replay ────────────────────────────────────────────────────────────────── */

let apiRouter: Router | null = null;
/** The /api router, so approvals can replay a request through it (routes/index.ts). */
export function registerApprovalReplay(router: Router) {
  apiRouter = router;
}

/** Run the held request again, as the person who asked, through the normal routes. */
async function replay(a: ApprovalRequest, approvedById: string | null): Promise<{ status: number; body: unknown }> {
  const requester = await prisma.user.findUnique({ where: { id: a.requestedById } });
  if (!requester) return { status: 410, body: { error: "The person who asked is no longer in Advertix." } };
  if (!apiRouter) return { status: 500, body: { error: "Approvals aren't ready yet. Try again in a moment." } };
  const router = apiRouter;
  return new Promise((resolve) => {
    let code = 200;
    const done = (body: unknown) => resolve({ status: code, body });
    const req = {
      method: a.method,
      url: a.path,
      originalUrl: `/api${a.path}`,
      baseUrl: "",
      // roleGuard only runs when a bearer header is present; with it, the
      // requester's current role and client limits are checked again (the
      // token itself isn't read: requireAuth sees dbUserId already set).
      headers: { authorization: "Bearer approval-replay" },
      query: {},
      params: {},
      body: (a.body ?? {}) as unknown,
      dbUserId: requester.id,
      user: requester,
      approvalReplay: { id: a.id },
      get: () => undefined,
      header: () => undefined,
    } as unknown as Request;
    Object.defineProperty(req, "path", { get: () => String((req as { url: string }).url).split("?")[0] });
    const res = {
      statusCode: 200,
      headersSent: false,
      locals: {},
      status(c: number) {
        code = c;
        (res as unknown as { statusCode: number }).statusCode = c;
        return res;
      },
      json: done,
      send: done,
      end: () => done(null),
      set: () => res,
      header: () => res,
      type: () => res,
      setHeader: () => undefined,
      getHeader: () => undefined,
    } as unknown as Response;
    approvalContext.run({ approvalId: a.id, approvedById }, () => {
      router(req, res, (err?: unknown) => {
        if (err) {
          const e = err as { status?: number; statusCode?: number; message?: string };
          resolve({ status: e.status ?? e.statusCode ?? 500, body: { error: e.message || "The change failed." } });
        } else resolve({ status: 404, body: { error: "This change can't be run any more." } });
      });
    });
  });
}

/* ── Decide ────────────────────────────────────────────────────────────────── */

const withPeople = { requestedBy: { select: { name: true, email: true } }, decidedBy: { select: { name: true, email: true } }, client: { select: { name: true } } } as const;

/** Approve (replay the change) or reject. `deciderId` null = decided by the 24-hour rule. */
export async function decide(workspaceId: string, id: string, decision: "approve" | "reject", deciderId: string | null, note: string | null, via: "manual" | "timeout" = "manual") {
  // Claim it first, so two owners (or the timeout and an owner) can't both act.
  const claimed = await prisma.approvalRequest.updateMany({
    where: { id, workspaceId, status: "PENDING" },
    data: { status: decision === "approve" ? "APPROVED" : "REJECTED", decidedById: deciderId, decidedAt: new Date(), decidedVia: via, note: note?.slice(0, 500) || null },
  });
  if (!claimed.count) {
    const exists = await prisma.approvalRequest.findFirst({ where: { id, workspaceId }, select: { status: true } });
    throw Object.assign(new Error(exists ? "This request was already decided." : "Approval not found"), { status: exists ? 409 : 404 });
  }
  let a = await prisma.approvalRequest.findUniqueOrThrow({ where: { id } });
  if (decision === "approve") {
    const r = await replay(a, deciderId);
    if (r.status >= 300) {
      const message = (r.body as { error?: string } | null)?.error ?? "The change failed.";
      a = await prisma.approvalRequest.update({ where: { id }, data: { status: "FAILED", error: message.slice(0, 500) } });
    }
  }
  const full = await prisma.approvalRequest.findUniqueOrThrow({ where: { id }, include: withPeople });
  void notifyDecided(full);
  return view(full);
}

/** The requester withdraws their own pending request. */
export async function cancel(workspaceId: string, id: string, userId: string) {
  const r = await prisma.approvalRequest.updateMany({ where: { id, workspaceId, requestedById: userId, status: "PENDING" }, data: { status: "CANCELLED", decidedById: userId, decidedAt: new Date(), decidedVia: "manual" } });
  if (!r.count) throw Object.assign(new Error("Only a request of yours that's still waiting can be withdrawn."), { status: 409 });
  return view(await prisma.approvalRequest.findUniqueOrThrow({ where: { id }, include: withPeople }));
}

/* ── Read ──────────────────────────────────────────────────────────────────── */

/** Owners see every request; everyone else sees their own. */
const scope = (access: Access, userId: string): Prisma.ApprovalRequestWhereInput =>
  access.role === "OWNER" ? { workspaceId: access.workspaceId } : { workspaceId: access.workspaceId, requestedById: userId };

export async function listApprovals(access: Access, userId: string, status: "pending" | "decided" | "all") {
  const rows = await prisma.approvalRequest.findMany({
    where: { ...scope(access, userId), ...(status === "pending" ? { status: "PENDING" } : status === "decided" ? { status: { not: "PENDING" } } : {}) },
    include: withPeople,
    orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
    take: 100,
  });
  return rows.map(view);
}

/** Badge + banner: how many wait (for owners: on them), how many past 24 hours, the oldest. */
export async function approvalSummary(access: Access, userId: string) {
  const where = { ...scope(access, userId), status: "PENDING" as const };
  const [pending, oldest, overdue, ws] = await Promise.all([
    prisma.approvalRequest.count({ where }),
    prisma.approvalRequest.findFirst({ where, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    prisma.approvalRequest.count({ where: { ...where, createdAt: { lt: new Date(Date.now() - APPROVAL_TIMEOUT_MS) } } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: access.workspaceId }, select: { approvalTimeout: true } }),
  ]);
  return { pending, overdue, oldestAt: oldest?.createdAt ?? null, timeout: ws.approvalTimeout, decides: access.role === "OWNER" };
}

/* ── Settings ──────────────────────────────────────────────────────────────── */

export async function approvalSettings(workspaceId: string) {
  const [ws, clients] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { approvalBudgetPct: true, approvalTimeout: true } }),
    prisma.client.findMany({ where: { workspaceId }, select: { id: true, name: true, askFirst: true, isDefault: true }, orderBy: { name: "asc" } }),
  ]);
  return { budgetPct: ws.approvalBudgetPct, timeout: ws.approvalTimeout, clients };
}

const TIMEOUTS: ApprovalTimeout[] = ["KEEP", "APPROVE", "REJECT"];

export async function saveApprovalSettings(workspaceId: string, input: { budgetPct?: unknown; timeout?: unknown; askFirstClientIds?: unknown }) {
  const data: Prisma.WorkspaceUpdateInput = {};
  if (input.budgetPct !== undefined) {
    if (input.budgetPct === null) data.approvalBudgetPct = null;
    else {
      const n = Math.round(Number(input.budgetPct));
      if (!Number.isFinite(n) || n < 1 || n > 1000) throw Object.assign(new Error("The limit must be between 1% and 1000%, or off."), { status: 400 });
      data.approvalBudgetPct = n;
    }
  }
  if (input.timeout !== undefined) {
    if (!TIMEOUTS.includes(input.timeout as ApprovalTimeout)) throw Object.assign(new Error("Unknown 24-hour rule."), { status: 400 });
    data.approvalTimeout = input.timeout as ApprovalTimeout;
  }
  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length) await tx.workspace.update({ where: { id: workspaceId }, data });
    if (Array.isArray(input.askFirstClientIds)) {
      const ids = input.askFirstClientIds.filter((x): x is string => typeof x === "string");
      await tx.client.updateMany({ where: { workspaceId, id: { in: ids } }, data: { askFirst: true } });
      await tx.client.updateMany({ where: { workspaceId, id: { notIn: ids } }, data: { askFirst: false } });
    }
  });
  return approvalSettings(workspaceId);
}

/* ── Emails ────────────────────────────────────────────────────────────────── */

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

async function notifyRequested(a: ApprovalRequest, requester: string) {
  try {
    await notifyMembers(
      a.workspaceId,
      (m) => m.role === "OWNER",
      "APPROVALS",
      { key: `approval:${a.id}:new`, clientId: a.clientId, line: `<strong>${esc(a.campaignName)}</strong>: ${esc(a.summary)}. ${esc(a.reason)}.` },
      "A change is waiting for your approval",
      `${esc(requester)} asked for this change:`,
      { label: "Review it", path: "/activity" }
    );
  } catch (err) {
    console.error("[approvals] notify owners failed:", err instanceof Error ? err.message : err);
  }
}

async function notifyDecided(a: ApprovalRequest & { decidedBy?: { name: string | null; email: string } | null }) {
  if (a.status === "CANCELLED") return;
  const by = a.decidedVia === "timeout" ? "automatically after 24 hours" : `by ${a.decidedBy?.name ?? a.decidedBy?.email ?? "an owner"}`;
  const subject = a.status === "APPROVED" ? "Your change was approved" : a.status === "REJECTED" ? "Your change was rejected" : "Your change was approved but didn't go through";
  const extra = a.status === "FAILED" && a.error ? ` It failed: ${esc(a.error)}` : a.note ? ` Note: “${esc(a.note)}”` : "";
  try {
    await notifyMembers(
      a.workspaceId,
      (m) => m.userId === a.requestedById,
      "APPROVALS",
      { key: `approval:${a.id}:decided`, clientId: a.clientId, line: `<strong>${esc(a.campaignName)}</strong>: ${esc(a.summary)}.${extra}` },
      subject,
      `Decided ${esc(by)}:`,
      { label: "Open Activity", path: "/activity" }
    );
  } catch (err) {
    console.error("[approvals] notify requester failed:", err instanceof Error ? err.message : err);
  }
}

/* ── 24-hour rule ──────────────────────────────────────────────────────────── */

/** One pass of the 24-hour rule (exported for tests). */
export async function runApprovalTimeouts() {
  const due = await prisma.approvalRequest.findMany({
    where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - APPROVAL_TIMEOUT_MS) }, workspace: { approvalTimeout: { not: "KEEP" } } },
    include: { workspace: { select: { approvalTimeout: true } } },
    take: 50,
  });
  for (const a of due) {
    try {
      await decide(a.workspaceId, a.id, a.workspace.approvalTimeout === "APPROVE" ? "approve" : "reject", null, "No one answered within 24 hours.", "timeout");
    } catch (err) {
      console.error("[approvals] timeout failed for", a.id, err instanceof Error ? err.message : err);
    }
  }
}

let timer: NodeJS.Timeout | null = null;
/** Every 10 minutes: apply the 24-hour rule where a workspace chose Approve or Reject. */
export function startApprovalScheduler() {
  if (timer || process.env.APPROVALS_TIMEOUT_ENABLED === "false") return;
  timer = setInterval(() => void runApprovalTimeouts().catch((e) => console.error("[approvals] tick failed:", e)), 10 * 60 * 1000);
}
