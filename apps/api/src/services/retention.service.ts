import { prisma } from "../lib/prisma";
import { BILLING_SELECT, isLocked, planOf } from "../lib/plans";
import { emailLayout, escapeHtml, sendEmail } from "../lib/email";
import { notifyMembers } from "./notifications.service";
import { deleteWorkspaceFiles } from "./assets.service";

/**
 * Data retention for locked workspaces (plan C15b). "Locked" = the trial
 * ended without a plan (lib/plans.ts). Runs daily (job "retention").
 *
 *  - The first day a workspace is seen locked is `lockedSince`.
 *  - **30 days locked:** the stored ad platform access tokens are deleted;
 *    the data stays and the accounts need reconnecting. Nothing is revoked on
 *    the platforms themselves: that would also cut the same person's access
 *    in any other workspace they use.
 *  - **From 30 days locked**, the superadmin can schedule a deletion with
 *    7 days' notice (owners are emailed straight away).
 *  - **6 months locked:** deletion is scheduled automatically.
 *  - Owners get emails 10, 5 and 2 days before any deletion (the first one
 *    straight away when there's less notice).
 *  - **Choosing a plan cancels a scheduled deletion**; a workspace is only
 *    ever deleted while it's still locked.
 *
 * Deleting removes the workspace and everything in it, not people's logins.
 * Stripe keeps its invoices; nothing changes on the ad platforms. Every
 * scheduled deletion is recorded in WorkspaceDeletion, which outlives it.
 * Without Stripe set up nothing locks, so nothing here ever runs.
 */

const DAY = 86_400_000;
export const ACCESS_AFTER_DAYS = 30;
export const ADMIN_DELETE_AFTER_DAYS = 30;
export const AUTO_DELETE_AFTER_DAYS = 180;
export const ADMIN_NOTICE_DAYS = 7;
const REMINDER_DAYS = [10, 5, 2];
const FRONTEND_URL = () => process.env.FRONTEND_URL ?? process.env.WEB_ORIGIN ?? "http://localhost:3000";
const day = (d: Date) => d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const SELECT = { id: true, name: true, lockedSince: true, accessRemovedAt: true, deletionScheduledAt: true, deletionReason: true, ...BILLING_SELECT } as const;
type Ws = Awaited<ReturnType<typeof loadOne>>;
const loadOne = (id: string) => prisma.workspace.findUniqueOrThrow({ where: { id }, select: SELECT });

export const retentionError = (status: number, message: string) => Object.assign(new Error(message), { status });

async function ownerEmail(workspaceId: string) {
  const w = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { owner: { select: { email: true } } } });
  return w?.owner?.email ?? null;
}

/** Delete the stored tokens; the accounts show as needing reconnecting. */
async function removeAccess(workspaceId: string, now: Date) {
  await prisma.adAccount.updateMany({ where: { workspaceId }, data: { accessToken: "", refreshToken: null, isActive: false, tokenExpiresAt: now } });
  await prisma.workspace.update({ where: { id: workspaceId }, data: { accessRemovedAt: now } });
  console.log(`[retention] ${workspaceId}: ad platform access removed (30 days locked)`);
}

async function schedule(w: Ws, reason: "superadmin" | "auto", by: string | null, when: Date) {
  await prisma.workspace.update({ where: { id: w.id }, data: { deletionScheduledAt: when, deletionReason: reason } });
  await prisma.workspaceDeletion.create({ data: { workspaceId: w.id, workspaceName: w.name, ownerEmail: await ownerEmail(w.id), reason, requestedBy: by, scheduledFor: when } });
  console.log(`[retention] ${w.id}: deletion scheduled for ${when.toISOString()} (${reason}${by ? ` by ${by}` : ""})`);
}

/** The next deletion email, once each: 10, 5 and 2 days before (the most urgent one that applies). */
async function remind(w: Ws, due: Date, now: Date) {
  const daysLeft = Math.max(1, Math.ceil((due.getTime() - now.getTime()) / DAY));
  const step = [...REMINDER_DAYS].reverse().find((d) => daysLeft <= d);
  if (step === undefined) return;
  const since = w.lockedSince ? day(w.lockedSince) : null;
  await notifyMembers(
    w.id,
    (m) => m.role === "OWNER",
    "USAGE",
    {
      key: `deletion:${due.toISOString().slice(0, 10)}:${step}`,
      clientId: null,
      line: `<strong>${escapeHtml(w.name)}</strong> will be deleted on <strong>${day(due)}</strong>${since ? `. It has been locked since ${since}, because the trial ended without a plan` : ""}. Everything in it goes: clients, synced data, campaigns, creatives, reports and settings. Your ads on the platforms aren't affected. Choose a plan before then to keep it.`,
    },
    `Your Advertix workspace will be deleted on ${day(due)}`,
    "About your Advertix workspace:",
    { label: "Choose a plan", path: "/settings?tab=billing" },
    { always: true }
  ).catch((err) => console.error("[retention] email:", err instanceof Error ? err.message : err));
}

/** Delete a workspace that is still locked, record it, and tell its owners. */
async function deleteNow(w: Ws, now: Date) {
  const owners = await prisma.workspaceMember.findMany({ where: { workspaceId: w.id, role: "OWNER" }, select: { user: { select: { email: true } } } });
  await prisma.workspace.delete({ where: { id: w.id } });
  await deleteWorkspaceFiles(w.id);
  await prisma.workspaceDeletion.updateMany({ where: { workspaceId: w.id, deletedAt: null, cancelledAt: null }, data: { deletedAt: now } });
  console.log(`[retention] ${w.id} (${w.name}) deleted`);
  const html = emailLayout({
    heading: "Your Advertix workspace was deleted",
    body: `<p style="margin:0">${escapeHtml(w.name)} and everything in it has been deleted, as we wrote before. Your ads on the platforms weren't changed, and your Advertix login still works if you want to start again.</p>`,
    footer: "This is about your Advertix workspace, so it goes to its owners.",
  });
  for (const o of owners) await sendEmail(o.user.email, "Your Advertix workspace was deleted", html).catch(() => undefined);
}

async function cancel(workspaceId: string, by: string, now: Date) {
  await prisma.workspaceDeletion.updateMany({ where: { workspaceId, deletedAt: null, cancelledAt: null }, data: { cancelledAt: now, cancelledBy: by } });
}

/** One pass over every workspace (daily). */
export async function retentionTick(now = new Date()) {
  const all = await prisma.workspace.findMany({ select: SELECT });
  for (const w of all) {
    try {
      if (!isLocked(w, now)) {
        // Unlocked (a plan was chosen): forget the lock and cancel any deletion.
        if (w.lockedSince || w.deletionScheduledAt || w.accessRemovedAt) {
          if (w.deletionScheduledAt) await cancel(w.id, "paid", now);
          await prisma.workspace.update({ where: { id: w.id }, data: { lockedSince: null, deletionScheduledAt: null, deletionReason: null, accessRemovedAt: null } });
        }
        continue;
      }
      const since = w.lockedSince ?? now;
      if (!w.lockedSince) await prisma.workspace.update({ where: { id: w.id }, data: { lockedSince: now } });
      const days = (now.getTime() - since.getTime()) / DAY;
      if (days >= ACCESS_AFTER_DAYS && !w.accessRemovedAt) await removeAccess(w.id, now);

      let due = w.deletionScheduledAt;
      if (!due && days >= AUTO_DELETE_AFTER_DAYS - REMINDER_DAYS[0]) {
        due = new Date(since.getTime() + AUTO_DELETE_AFTER_DAYS * DAY);
        await schedule({ ...w, lockedSince: since }, "auto", null, due);
      }
      if (!due) continue;
      if (due <= now) await deleteNow(w, now);
      else await remind({ ...w, lockedSince: since }, due, now);
    } catch (err) {
      console.error(`[retention] ${w.id}:`, err instanceof Error ? err.message : err);
    }
  }
}

/* ── Superadmin ──────────────────────────────────────────────────────────── */

/**
 * Superadmins are server settings, so nobody can make themselves one in the
 * app: SUPERADMIN_EMAILS (the account's verified Clerk email; works before
 * the account exists) and/or SUPERADMIN_CLERK_IDS, both comma separated.
 * Only list inboxes that you alone can read (never a public or disposable
 * inbox: whoever reads it can sign in).
 */
const list = (v: string | undefined) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export function isSuperadmin(user: { clerkId?: string | null; email?: string | null } | null | undefined) {
  if (!user) return false;
  if (user.clerkId && list(process.env.SUPERADMIN_CLERK_IDS).includes(user.clerkId.toLowerCase())) return true;
  return Boolean(user.email && list(process.env.SUPERADMIN_EMAILS).includes(user.email.trim().toLowerCase()));
}

/** Workspaces for the admin page: locked ones (oldest lock first), or all. */
export async function adminWorkspaces(filter: "locked" | "all", now = new Date()) {
  const rows = await prisma.workspace.findMany({
    select: { ...SELECT, createdAt: true, owner: { select: { email: true } }, _count: { select: { members: true, clients: true, adAccounts: true } } },
    orderBy: { createdAt: "desc" },
  });
  const list = rows.map((w) => {
    const p = planOf(w, now);
    const lockedDays = w.lockedSince ? Math.floor((now.getTime() - w.lockedSince.getTime()) / DAY) : null;
    return {
      id: w.id,
      name: w.name,
      ownerEmail: w.owner?.email ?? null,
      createdAt: w.createdAt,
      plan: w.plan,
      state: p.state,
      locked: p.locked,
      tier: p.tier,
      trialEndsAt: w.trialEndsAt,
      lockedSince: w.lockedSince,
      lockedDays,
      accessRemovedAt: w.accessRemovedAt,
      deletionScheduledAt: w.deletionScheduledAt,
      deletionReason: w.deletionReason,
      canDelete: p.locked && lockedDays !== null && lockedDays >= ADMIN_DELETE_AFTER_DAYS,
      members: w._count.members,
      clients: w._count.clients,
      adAccounts: w._count.adAccounts,
    };
  });
  return filter === "all" ? list : list.filter((w) => w.locked).sort((a, b) => (b.lockedDays ?? 0) - (a.lockedDays ?? 0));
}

/** Schedule a deletion in 7 days (locked 30+ days only); the owners are emailed now. */
export async function adminScheduleDeletion(workspaceId: string, confirmName: unknown, by: string, now = new Date()) {
  const w = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: SELECT });
  if (!w) throw retentionError(404, "Workspace not found.");
  if (typeof confirmName !== "string" || confirmName.trim() !== w.name.trim()) throw retentionError(400, "Type the workspace name exactly to confirm.");
  if (!isLocked(w, now) || !w.lockedSince || now.getTime() - w.lockedSince.getTime() < ADMIN_DELETE_AFTER_DAYS * DAY) {
    throw retentionError(409, `Only workspaces locked for ${ADMIN_DELETE_AFTER_DAYS} days or more can be deleted.`);
  }
  const when = new Date(now.getTime() + ADMIN_NOTICE_DAYS * DAY);
  if (w.deletionScheduledAt && w.deletionScheduledAt <= when) throw retentionError(409, `It's already set to be deleted on ${day(w.deletionScheduledAt)}.`);
  if (w.deletionScheduledAt) await cancel(w.id, by, now); // an automatic one later on, replaced by this sooner one
  await schedule(w, "superadmin", by, when);
  await remind(await loadOne(w.id), when, now);
  return { deletionScheduledAt: when };
}

/**
 * Cancel a scheduled deletion. An automatic one would come straight back,
 * so cancelling it also restarts the 6-month clock from today.
 */
export async function adminCancelDeletion(workspaceId: string, by: string, now = new Date()) {
  const w = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: SELECT });
  if (!w) throw retentionError(404, "Workspace not found.");
  if (!w.deletionScheduledAt) throw retentionError(409, "No deletion is scheduled.");
  await cancel(w.id, by, now);
  await prisma.workspace.update({ where: { id: w.id }, data: { deletionScheduledAt: null, deletionReason: null, ...(w.deletionReason === "auto" ? { lockedSince: now } : {}) } });
  return { cancelled: true };
}

/** Every scheduled deletion, newest first (the record that outlives the workspace). */
export function deletionHistory(limit = 100) {
  return prisma.workspaceDeletion.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

/* ── Timer fallback (when the job queue isn't running) ───────────────────── */

let handle: NodeJS.Timeout | null = null;
/** Daily retention pass. Disable with RETENTION_ENABLED=false. */
export function startRetentionScheduler() {
  if (handle) return;
  setTimeout(() => {
    void retentionTick().catch((e) => console.error("[retention]", e));
    handle = setInterval(() => void retentionTick().catch((e) => console.error("[retention]", e)), DAY);
  }, 600_000);
  console.log("[retention] daily retention check scheduled");
}
