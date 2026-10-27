import type { NextFunction, Request, Response } from "express";
import type { PlanType, WorkspaceRole } from "@prisma/client";
import { prisma } from "./prisma";
import { requireAuth } from "../middleware/auth";

/**
 * Team roles and what they may do (plan B6, decision 7), enforced for every
 * API request by `roleGuard` (mounted before all routers):
 *
 *   Owner          everything
 *   Media buyer    view, export, edit (campaigns, creatives, audiences,
 *                  suggestions, AI that saves), connect ad accounts
 *   Analyst        view and export; changes nothing
 *   Client viewer  view and export, only the clients they're given
 *
 * Any non-owner can be limited to some clients (`MemberClientAccess`); a
 * client viewer always is. Limited members always work inside one client.
 */

export type Role = "OWNER" | "MEDIA_BUYER" | "ANALYST" | "CLIENT_VIEWER";
export type Capability = "view" | "export" | "edit" | "connect" | "clients" | "team" | "workspace";

export const ROLES: Role[] = ["OWNER", "MEDIA_BUYER", "ANALYST", "CLIENT_VIEWER"];
export const ROLE_LABEL: Record<Role, string> = { OWNER: "Owner", MEDIA_BUYER: "Media buyer", ANALYST: "Analyst", CLIENT_VIEWER: "Client viewer" };

const CAPS: Record<Role, Capability[]> = {
  OWNER: ["view", "export", "edit", "connect", "clients", "team", "workspace"],
  MEDIA_BUYER: ["view", "export", "edit", "connect"],
  ANALYST: ["view", "export"],
  CLIENT_VIEWER: ["view", "export"],
};

/** Legacy enum values (migrated by scripts/migrate-roles.ts) read as their new equivalents. */
export function normalizeRole(r: WorkspaceRole): Role {
  if (r === "ADMIN" || r === "EDITOR") return "MEDIA_BUYER";
  if (r === "VIEWER") return "ANALYST";
  return r;
}

export const can = (role: Role, cap: Capability) => CAPS[role].includes(cap);

export type Access = {
  workspaceId: string;
  plan: PlanType;
  memberId: string;
  role: Role;
  /** null = all clients. */
  clientIds: string[] | null;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      access?: Access | null;
    }
  }
}

/** The signed-in member's access in their workspace (cached on the request). Null when they have no workspace. */
export async function getAccess(req: Request): Promise<Access | null> {
  if (req.access !== undefined) return req.access;
  // Without a user, `userId: undefined` would match any member.
  if (!req.dbUserId) return null;
  const m = await prisma.workspaceMember.findFirst({
    where: { userId: req.dbUserId! },
    include: { workspace: { select: { id: true, plan: true } }, clientAccess: { select: { clientId: true } } },
    orderBy: { workspace: { createdAt: "asc" } },
  });
  const role = m ? normalizeRole(m.role) : null;
  req.access = m
    ? {
        workspaceId: m.workspace.id,
        plan: m.workspace.plan,
        memberId: m.id,
        role: role!,
        clientIds: role === "OWNER" || m.clientAccess.length === 0 ? (role === "CLIENT_VIEWER" ? [] : null) : m.clientAccess.map((c) => c.clientId),
      }
    : null;
  return req.access;
}

export class AccessError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
    this.name = "AccessError";
  }
}

const DENIED: Record<Exclude<Capability, "view" | "export">, string> = {
  edit: "can view and export, but not change anything here. Ask an owner for Media buyer access.",
  connect: "can't connect or change ad accounts. Ask an owner or a media buyer.",
  clients: "can't set up clients or assign ad accounts. Only owners can.",
  team: "can't manage the team. Only owners can invite people and change roles.",
  workspace: "can't change workspace settings. Only owners can.",
};
export const deniedMessage = (role: Role, cap: Capability) =>
  cap === "view" || cap === "export" ? "You don't have access to this." : `${ROLE_LABEL[role]}s ${DENIED[cap]}`;

/** What a request needs (path is relative to /api). Null = no role check (auth flows, invites). */
export function capabilityFor(method: string, path: string): Capability | null {
  if (path.startsWith("/auth") || path.startsWith("/invites")) return null;
  const read = method === "GET" || method === "HEAD" || method === "OPTIONS";
  if (path.startsWith("/workspace")) {
    if (read) return "view";
    return /^\/workspace\/(invites|members)/.test(path) || path === "/workspace/invite" ? "team" : "workspace";
  }
  // Safety rules and automation settings (C14): everyone sees them; owners change them.
  if (path.startsWith("/automation")) return read ? "view" : "workspace";
  // Approvals (C1): everyone sees them (the route narrows it); the requester can
  // withdraw theirs; deciding and the rules are the owner's.
  if (path.startsWith("/approvals")) {
    if (read) return "view";
    return /^\/approvals\/[^/]+\/cancel$/.test(path) ? "edit" : "workspace";
  }
  // Starting OAuth attaches accounts to the workspace, so it needs connect even though it is a GET.
  if (/^\/(meta|google|tiktok|linkedin)\/oauth-url$/.test(path)) return "connect";
  if (read) return "view";
  // Read-only questions that happen to be POSTs.
  if (/^\/ai\/campaigns\/[^/]+\/ask$/.test(path) || path === "/insights/generate" || path === "/suggestions/refresh") return "view";
  if (path.startsWith("/clients")) return "clients";
  if (path.startsWith("/connections")) return "connect";
  if (path.startsWith("/ad-accounts")) return method === "PATCH" && /^\/ad-accounts\/[^/]+$/.test(path) ? "clients" : "connect";
  if (/^\/meta\/(upload-image|upload-video|lookalike)/.test(path)) return "edit";
  if (/^\/(meta|google|tiktok|linkedin)\//.test(path)) return "connect";
  return "edit";
}

/** Throws (404, so other clients' ids don't leak) when a limited member reaches outside their clients. */
export function assertClientAccess(access: Access, clientId: string | null | undefined, opts: { allowShared?: boolean } = {}) {
  if (!access.clientIds) return;
  if (clientId == null && opts.allowShared) return;
  if (!clientId || !access.clientIds.includes(clientId)) {
    const e = new Error("Not found") as Error & { status: number };
    e.status = 404;
    throw e;
  }
}

/** The client of the object a path points at, for limited members. */
async function objectClient(workspaceId: string, path: string, query: Request["query"]): Promise<{ clientId: string | null; shared: boolean } | undefined> {
  const id = (re: RegExp) => path.match(re)?.[1];
  const campaignId = id(/^\/campaigns\/([^/]+)/) ?? id(/^\/ai\/campaigns\/([^/]+)/) ?? (typeof query.campaignId === "string" ? query.campaignId : undefined);
  if (campaignId && !["new", "board"].includes(campaignId)) {
    const c = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, select: { adAccount: { select: { clientId: true } } } });
    return c ? { clientId: c.adAccount.clientId, shared: false } : undefined;
  }
  const creativeId = id(/^\/creatives\/([^/]+)/);
  if (creativeId && creativeId !== "board") {
    const c = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId }, select: { clientId: true } });
    return c ? { clientId: c.clientId, shared: true } : undefined;
  }
  const audienceId = id(/^\/audiences\/([^/]+)/);
  if (audienceId && audienceId !== "board") {
    const a = await prisma.audience.findFirst({ where: { id: audienceId, workspaceId }, select: { clientId: true } });
    return a ? { clientId: a.clientId, shared: true } : undefined;
  }
  const suggestionId = id(/^\/suggestions\/([^/]+)\//);
  if (suggestionId) {
    const s = await prisma.suggestion.findFirst({ where: { id: suggestionId, workspaceId }, select: { clientId: true } });
    return s ? { clientId: s.clientId, shared: false } : undefined;
  }
  const changeId = id(/^\/change-log\/([^/]+)\//);
  if (changeId) {
    const e = await prisma.changeLog.findFirst({ where: { id: changeId, workspaceId }, select: { clientId: true } });
    return e ? { clientId: e.clientId, shared: false } : undefined;
  }
  return undefined;
}

/**
 * Mounted on the API router before every sub-router. Requests without a
 * bearer token pass through (public routes answer, protected ones 401).
 */
export async function roleGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.headers.authorization) return next();
  const cap = capabilityFor(req.method, req.path);
  if (cap === null) return next();
  await requireAuth(req, res, async () => {
    try {
      const access = await getAccess(req);
      if (!access) return next(); // no workspace yet: routes answer NO_WORKSPACE
      if (access.role === "CLIENT_VIEWER" && req.path.startsWith("/workspace")) {
        return res.status(403).json({ error: "Client viewers don't see workspace settings." });
      }
      if (!can(access.role, cap)) return res.status(403).json({ error: deniedMessage(access.role, cap), code: "ROLE_FORBIDDEN" });
      if (access.clientIds) {
        const target = await objectClient(access.workspaceId, req.path, req.query);
        if (target) assertClientAccess(access, target.clientId, { allowShared: target.shared });
      }
      next();
    } catch (err) {
      next(err);
    }
  });
}

/** Seats per plan (pricing page): Founder 2, Team 5, Agency 10, Enterprise unlimited. */
export function seatLimit(plan: PlanType): number {
  return plan === "FREE" ? 2 : plan === "STARTER" ? 5 : plan === "PRO" ? 10 : Infinity;
}
/** Agency and Enterprise include free client-viewer seats. */
export const clientViewersFree = (plan: PlanType) => plan === "PRO" || plan === "ENTERPRISE";
