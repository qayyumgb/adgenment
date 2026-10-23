import { randomBytes } from "node:crypto";
import type { Invite, WorkspaceRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ROLE_LABEL, clientViewersFree, normalizeRole, seatLimit, type Access, type Role } from "../lib/access";

/**
 * Team (plan B6): members with role and client access, invites (stored,
 * emailed with Resend, 7-day link for the invited email only), seats from
 * the plan, and accepting an invite.
 */

const FRONTEND_URL = process.env.FRONTEND_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3000";
const INVITE_DAYS = 7;
const INVITABLE: Role[] = ["MEDIA_BUYER", "ANALYST", "CLIENT_VIEWER"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class TeamError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "TeamError";
  }
}

export const inviteUrl = (token: string) => `${FRONTEND_URL}/invite/${token}`;
const isOpen = (i: Pick<Invite, "status" | "expiresAt">) => i.status === "PENDING" && i.expiresAt.getTime() > Date.now();

/** Does this role use a paid seat on this plan? (Agency / Enterprise include client viewers.) */
const usesSeat = (role: WorkspaceRole | Role, plan: Access["plan"]) => !(normalizeRole(role as WorkspaceRole) === "CLIENT_VIEWER" && clientViewersFree(plan));

async function validClientIds(workspaceId: string, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids)) return [];
  const wanted = [...new Set(ids.filter((x): x is string => typeof x === "string"))];
  if (!wanted.length) return [];
  const found = await prisma.client.findMany({ where: { workspaceId, id: { in: wanted } }, select: { id: true } });
  if (found.length !== wanted.length) throw new TeamError(400, "One of the clients isn't in this workspace.");
  return wanted;
}

function checkRoleAccess(role: Role, clientIds: string[]) {
  if (role === "CLIENT_VIEWER" && clientIds.length === 0) throw new TeamError(400, "Pick at least one client for a client viewer.");
}

export async function seats(workspaceId: string, plan: Access["plan"]) {
  const [members, invites] = await Promise.all([
    prisma.workspaceMember.findMany({ where: { workspaceId }, select: { role: true } }),
    prisma.invite.findMany({ where: { workspaceId, status: "PENDING", expiresAt: { gt: new Date() } }, select: { role: true } }),
  ]);
  const used = [...members, ...invites].filter((m) => usesSeat(m.role, plan)).length;
  const limit = seatLimit(plan);
  return { used, limit: Number.isFinite(limit) ? limit : null, clientViewersFree: clientViewersFree(plan), plan };
}

export async function listTeam(access: Access, userId: string) {
  const [members, invites, clients, seat] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: access.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } }, clientAccess: { select: { clientId: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({ where: { workspaceId: access.workspaceId, status: "PENDING" }, orderBy: { createdAt: "desc" } }),
    prisma.client.findMany({ where: { workspaceId: access.workspaceId }, select: { id: true, name: true } }),
    seats(access.workspaceId, access.plan),
  ]);
  const inviterIds = [...new Set(invites.map((i) => i.invitedById).filter((x): x is string => !!x))];
  const inviters = inviterIds.length ? await prisma.user.findMany({ where: { id: { in: inviterIds } }, select: { id: true, name: true, email: true } }) : [];
  const order: Record<Role, number> = { OWNER: 0, MEDIA_BUYER: 1, ANALYST: 2, CLIENT_VIEWER: 3 };
  return {
    you: { memberId: access.memberId, role: access.role },
    seats: seat,
    clients,
    members: members
      .map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: normalizeRole(m.role),
        clientIds: m.clientAccess.map((c) => c.clientId),
        joinedAt: m.createdAt.toISOString(),
        isYou: m.user.id === userId,
      }))
      .sort((a, b) => order[a.role] - order[b.role]),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: normalizeRole(i.role),
      clientIds: i.clientIds,
      expired: !isOpen(i),
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
      invitedBy: inviters.find((u) => u.id === i.invitedById)?.name ?? inviters.find((u) => u.id === i.invitedById)?.email ?? null,
      emailSent: Boolean(i.emailSentAt),
      emailError: i.emailError,
      // The owner can copy the link, e.g. when email isn't set up.
      url: inviteUrl(i.token),
    })),
  };
}

/** Send (or resend) the invite email. Never throws: a failure is stored on the invite and the link still works. */
async function sendInviteEmail(invite: Invite, workspaceName: string, inviterName: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await prisma.invite.update({ where: { id: invite.id }, data: { emailError: "Email isn't set up on the server (RESEND_API_KEY). Share the link instead.", emailSentAt: null } });
    return false;
  }
  const url = inviteUrl(invite.token);
  const role = ROLE_LABEL[normalizeRole(invite.role)];
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#14121f">
  <h2 style="margin:0 0 12px;font-size:20px">${escapeHtml(inviterName)} invited you to ${escapeHtml(workspaceName)} on Advertix</h2>
  <p style="margin:0 0 20px;line-height:1.5;color:#4a4760">You'll join as <strong>${role}</strong>. The invite is for ${escapeHtml(invite.email)} and works for ${INVITE_DAYS} days.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="background:#6448f2;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;display:inline-block">Accept the invite</a></p>
  <p style="margin:0;font-size:13px;color:#8a879b">Or open this link: <a href="${url}" style="color:#6448f2">${url}</a></p>
</div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.INVITE_FROM || process.env.CONTACT_FROM || "Advertix <onboarding@resend.dev>",
        to: [invite.email],
        subject: `${inviterName} invited you to ${workspaceName} on Advertix`,
        html,
      }),
    });
    if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    await prisma.invite.update({ where: { id: invite.id }, data: { emailSentAt: new Date(), emailError: null } });
    return true;
  } catch (err) {
    console.error("[team] invite email failed:", err instanceof Error ? err.message : err);
    await prisma.invite.update({ where: { id: invite.id }, data: { emailError: "The email didn't send. Share the link instead, or try again." } });
    return false;
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function names(access: Access, userId: string) {
  const [ws, me] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: access.workspaceId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
  ]);
  return { workspaceName: ws?.name ?? "a workspace", inviterName: me?.name || me?.email || "A teammate" };
}

export async function createInvites(access: Access, userId: string, body: { emails?: unknown; role?: unknown; clientIds?: unknown }) {
  const emails = [...new Set((Array.isArray(body.emails) ? body.emails : [body.emails]).filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (!emails.length) throw new TeamError(400, "Add at least one email.");
  if (emails.length > 10) throw new TeamError(400, "Invite up to 10 people at a time.");
  const bad = emails.find((e) => !EMAIL_RE.test(e));
  if (bad) throw new TeamError(400, `“${bad}” isn't a valid email.`);
  const role = body.role as Role;
  if (!INVITABLE.includes(role)) throw new TeamError(400, "Role must be Media buyer, Analyst or Client viewer.");
  const clientIds = await validClientIds(access.workspaceId, body.clientIds);
  checkRoleAccess(role, clientIds);

  const seat = await seats(access.workspaceId, access.plan);
  const { workspaceName, inviterName } = await names(access, userId);
  const memberEmails = new Set(
    (await prisma.workspaceMember.findMany({ where: { workspaceId: access.workspaceId }, select: { user: { select: { email: true } } } })).map((m) => m.user.email.toLowerCase())
  );
  let used = seat.used;
  const results: { email: string; ok: boolean; error?: string; inviteId?: string; url?: string; emailSent?: boolean }[] = [];
  for (const email of emails) {
    if (memberEmails.has(email)) {
      results.push({ email, ok: false, error: "Already a member." });
      continue;
    }
    const existing = await prisma.invite.findFirst({ where: { workspaceId: access.workspaceId, email, status: "PENDING" } });
    const counts = usesSeat(role, access.plan) && !(existing && isOpen(existing) && usesSeat(existing.role, access.plan));
    if (counts && seat.limit !== null && used >= seat.limit) {
      results.push({ email, ok: false, error: `No seats left on your plan (${used} of ${seat.limit} used).` });
      continue;
    }
    const data = { role, clientIds, invitedById: userId, expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) };
    const invite = existing
      ? await prisma.invite.update({ where: { id: existing.id }, data })
      : await prisma.invite.create({ data: { workspaceId: access.workspaceId, email, token: randomBytes(24).toString("base64url"), ...data } });
    if (counts) used++;
    const emailSent = await sendInviteEmail(invite, workspaceName, inviterName);
    results.push({ email, ok: true, inviteId: invite.id, url: inviteUrl(invite.token), emailSent });
  }
  return { results, seats: await seats(access.workspaceId, access.plan) };
}

export async function resendInvite(access: Access, userId: string, id: string) {
  const invite = await prisma.invite.findFirst({ where: { id, workspaceId: access.workspaceId, status: "PENDING" } });
  if (!invite) throw new TeamError(404, "Invite not found.");
  const renewed = await prisma.invite.update({ where: { id }, data: { expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000) } });
  const { workspaceName, inviterName } = await names(access, userId);
  return { emailSent: await sendInviteEmail(renewed, workspaceName, inviterName), url: inviteUrl(renewed.token) };
}

export async function revokeInvite(access: Access, id: string) {
  const r = await prisma.invite.updateMany({ where: { id, workspaceId: access.workspaceId, status: "PENDING" }, data: { status: "REVOKED" } });
  if (!r.count) throw new TeamError(404, "Invite not found.");
}

export async function updateMember(access: Access, userId: string, memberId: string, body: { role?: unknown; clientIds?: unknown }) {
  const target = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId: access.workspaceId }, include: { clientAccess: true } });
  if (!target) throw new TeamError(404, "Member not found.");
  const current = normalizeRole(target.role);
  if (current === "OWNER") throw new TeamError(400, "The owner's role and access can't be changed.");
  if (target.userId === userId) throw new TeamError(400, "You can't change your own role.");
  const role = body.role === undefined ? current : (body.role as Role);
  if (!INVITABLE.includes(role)) throw new TeamError(400, "Role must be Media buyer, Analyst or Client viewer.");
  const clientIds = body.clientIds === undefined ? target.clientAccess.map((c) => c.clientId) : await validClientIds(access.workspaceId, body.clientIds);
  checkRoleAccess(role, clientIds);
  if (!usesSeat(current, access.plan) && usesSeat(role, access.plan)) {
    const s = await seats(access.workspaceId, access.plan);
    if (s.limit !== null && s.used >= s.limit) throw new TeamError(409, `No seats left on your plan (${s.used} of ${s.limit} used). Client viewers are free; other roles use a seat.`);
  }
  await prisma.$transaction([
    prisma.workspaceMember.update({ where: { id: target.id }, data: { role } }),
    prisma.memberClientAccess.deleteMany({ where: { memberId: target.id } }),
    ...(clientIds.length ? [prisma.memberClientAccess.createMany({ data: clientIds.map((clientId) => ({ memberId: target.id, clientId })) })] : []),
  ]);
}

export async function removeMember(access: Access, userId: string, memberId: string) {
  const target = await prisma.workspaceMember.findFirst({ where: { id: memberId, workspaceId: access.workspaceId } });
  if (!target) throw new TeamError(404, "Member not found.");
  if (normalizeRole(target.role) === "OWNER") throw new TeamError(400, "The workspace owner can't be removed.");
  if (target.userId === userId) throw new TeamError(400, "You can't remove yourself.");
  await prisma.workspaceMember.delete({ where: { id: target.id } });
}

/* ── The invitee's side ─────────────────────────────────────────────── */

async function openInvite(token: string) {
  const invite = await prisma.invite.findUnique({ where: { token }, include: { workspace: { select: { id: true, name: true } } } });
  if (!invite) throw new TeamError(404, "This invite link isn't valid.");
  return invite;
}

/** What the invite page shows. */
export async function inviteInfo(token: string, user: { id: string; email: string }) {
  const invite = await openInvite(token);
  const inviter = invite.invitedById ? await prisma.user.findUnique({ where: { id: invite.invitedById }, select: { name: true, email: true } }) : null;
  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId: invite.workspaceId, userId: user.id }, select: { id: true } });
  return {
    workspaceName: invite.workspace.name,
    inviterName: inviter?.name || inviter?.email || null,
    role: normalizeRole(invite.role),
    email: invite.email,
    status: member ? "member" : invite.status === "PENDING" ? (isOpen(invite) ? "open" : "expired") : invite.status === "ACCEPTED" ? "accepted" : "revoked",
    emailMatches: invite.email.toLowerCase() === user.email.toLowerCase(),
    signedInAs: user.email,
  };
}

/** A workspace nobody has used: auto-created at sign-up, sole member, no data. */
async function isEmptyWorkspace(workspaceId: string) {
  const [members, accounts, campaigns, creatives, audiences, plans] = await Promise.all([
    prisma.workspaceMember.count({ where: { workspaceId } }),
    prisma.adAccount.count({ where: { workspaceId } }),
    prisma.campaign.count({ where: { workspaceId } }),
    prisma.creative.count({ where: { workspaceId } }),
    prisma.audience.count({ where: { workspaceId } }),
    prisma.plan.count({ where: { workspaceId } }),
  ]);
  return members <= 1 && accounts + campaigns + creatives + audiences + plans === 0;
}

export async function acceptInvite(token: string, user: { id: string; email: string }) {
  const invite = await openInvite(token);
  if (invite.status === "REVOKED") throw new TeamError(410, "This invite was cancelled. Ask for a new one.");
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new TeamError(403, `This invite is for ${invite.email}. You're signed in as ${user.email}; sign in with the invited email.`);
  }
  const already = await prisma.workspaceMember.findFirst({ where: { workspaceId: invite.workspaceId, userId: user.id } });
  if (already) return { workspaceId: invite.workspaceId, alreadyMember: true };
  if (invite.status === "ACCEPTED") throw new TeamError(410, "This invite was already used.");
  if (!isOpen(invite)) throw new TeamError(410, "This invite has expired. Ask for a new one.");

  // One workspace per person for now: an unused auto-created workspace is
  // replaced; one with data blocks joining (nothing is deleted).
  const others = await prisma.workspaceMember.findMany({ where: { userId: user.id }, include: { workspace: { select: { id: true, name: true, ownerId: true } } } });
  for (const m of others) {
    const empty = m.workspace.ownerId === user.id && (await isEmptyWorkspace(m.workspace.id));
    if (!empty) {
      throw new TeamError(409, `You already belong to “${m.workspace.name}”, which has data. Advertix supports one workspace per person for now: ask its owner to remove you, or accept with another email.`);
    }
  }
  const clientIds = invite.clientIds.length
    ? (await prisma.client.findMany({ where: { workspaceId: invite.workspaceId, id: { in: invite.clientIds } }, select: { id: true } })).map((c) => c.id)
    : [];
  if (normalizeRole(invite.role) === "CLIENT_VIEWER" && !clientIds.length) throw new TeamError(409, "The clients on this invite no longer exist. Ask for a new invite.");

  await prisma.$transaction(async (tx) => {
    for (const m of others) await tx.workspace.delete({ where: { id: m.workspace.id } });
    const member = await tx.workspaceMember.create({ data: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role } });
    if (clientIds.length) await tx.memberClientAccess.createMany({ data: clientIds.map((clientId) => ({ memberId: member.id, clientId })) });
    await tx.invite.update({ where: { id: invite.id }, data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: user.id } });
  });
  return { workspaceId: invite.workspaceId, alreadyMember: false };
}

/** A pending invite for this email (used to skip the auto-created workspace at sign-up). */
export async function pendingInviteFor(email: string) {
  if (!email) return null;
  return prisma.invite.findFirst({
    where: { email: email.toLowerCase(), status: "PENDING", expiresAt: { gt: new Date() } },
    include: { workspace: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
