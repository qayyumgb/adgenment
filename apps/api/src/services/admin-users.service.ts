import { prisma } from "../lib/prisma";
import { BILLING_SELECT, planOf } from "../lib/plans";

/**
 * Superadmin Users list (leads): everyone who signed up, how far they got
 * (connected an ad account, published a campaign, paying) and what they've
 * done. Counts are gathered with a handful of grouped queries, never per user.
 */

export type LeadStage = "SIGNED_UP" | "CONNECTED" | "PUBLISHED" | "PAYING";

const DAY = 86_400_000;

export async function adminUsers(now = new Date()) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      lastSeenAt: true,
      workspaceMembers: {
        orderBy: { createdAt: "asc" },
        select: { role: true, workspace: { select: { id: true, name: true, createdAt: true, ownerId: true, lockedSince: true, ...BILLING_SELECT } } },
      },
    },
  });
  const wsIds = [...new Set(users.flatMap((u) => u.workspaceMembers.map((m) => m.workspace.id)))];
  const userIds = users.map((u) => u.id);

  const [accounts, campaigns, published, publishLog, changes, credits] = await Promise.all([
    prisma.adAccount.groupBy({ by: ["workspaceId", "platform"], where: { workspaceId: { in: wsIds }, archivedAt: null }, _count: { _all: true } }),
    prisma.campaign.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: wsIds } }, _count: { _all: true } }),
    prisma.campaign.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: wsIds }, publishedAt: { not: null } }, _count: { _all: true } }),
    // Publishes stay in the change log even when the campaign row is later re-imported or deleted.
    prisma.changeLog.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: wsIds }, action: "campaign.publish", revertOfId: null }, _count: { _all: true } }),
    prisma.changeLog.groupBy({ by: ["actorUserId"], where: { actorUserId: { in: userIds } }, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.aiUsage.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _sum: { credits: true } }),
  ]);

  const platformsOf = new Map<string, Map<string, number>>();
  for (const a of accounts) {
    const m = platformsOf.get(a.workspaceId) ?? new Map<string, number>();
    m.set(a.platform, (m.get(a.platform) ?? 0) + a._count._all);
    platformsOf.set(a.workspaceId, m);
  }
  const campaignsOf = new Map(campaigns.map((c) => [c.workspaceId, c._count._all]));
  const publishedOf = new Map(published.map((c) => [c.workspaceId, c._count._all]));
  for (const l of publishLog) publishedOf.set(l.workspaceId, Math.max(publishedOf.get(l.workspaceId) ?? 0, l._count._all));
  const changesOf = new Map(changes.map((c) => [c.actorUserId, { count: c._count._all, last: c._max.createdAt }]));
  const creditsOf = new Map(credits.map((c) => [c.userId, c._sum.credits ?? 0]));

  return users.map((u) => {
    const workspaces = u.workspaceMembers.map((m) => {
      const w = m.workspace;
      const p = planOf(w, now);
      const platforms = [...(platformsOf.get(w.id)?.entries() ?? [])].map(([platform, count]) => ({ platform, count }));
      return {
        id: w.id,
        name: w.name,
        role: m.role,
        owner: w.ownerId === u.id,
        state: p.state,
        tier: p.tier ?? null,
        locked: p.locked,
        trialEndsAt: w.trialEndsAt,
        paying: p.state === "ACTIVE" || p.state === "PAST_DUE",
        platforms,
        adAccounts: platforms.reduce((s, x) => s + x.count, 0),
        campaigns: campaignsOf.get(w.id) ?? 0,
        published: publishedOf.get(w.id) ?? 0,
      };
    });
    const main = workspaces.find((w) => w.owner) ?? workspaces[0] ?? null;
    const adAccounts = workspaces.reduce((s, w) => s + w.adAccounts, 0);
    const publishedCount = workspaces.reduce((s, w) => s + w.published, 0);
    const stage: LeadStage = workspaces.some((w) => w.paying) ? "PAYING" : publishedCount > 0 ? "PUBLISHED" : adAccounts > 0 ? "CONNECTED" : "SIGNED_UP";
    const c = changesOf.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      daysSinceSignup: Math.floor((now.getTime() - u.createdAt.getTime()) / DAY),
      stage,
      workspace: main,
      otherWorkspaces: Math.max(0, workspaces.length - 1),
      platforms: [...new Set(workspaces.flatMap((w) => w.platforms.map((p) => p.platform)))],
      adAccounts,
      campaigns: workspaces.reduce((s, w) => s + w.campaigns, 0),
      published: publishedCount,
      changes: c?.count ?? 0,
      lastChangeAt: c?.last ?? null,
      aiCredits: creditsOf.get(u.id) ?? 0,
    };
  });
}

/** One user's journey: milestones and their latest changes. */
export async function adminUserActivity(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true, lastSeenAt: true, workspaceMembers: { select: { role: true, createdAt: true, workspace: { select: { id: true, name: true, createdAt: true, ownerId: true } } } } },
  });
  if (!u) return null;
  const wsIds = u.workspaceMembers.map((m) => m.workspace.id);
  const [accounts, firstPublished, changes, ai] = await Promise.all([
    prisma.adAccount.findMany({ where: { workspaceId: { in: wsIds } }, select: { platform: true, accountName: true, createdAt: true, archivedAt: true, workspaceId: true }, orderBy: { createdAt: "asc" }, take: 50 }),
    prisma.changeLog.findMany({ where: { workspaceId: { in: wsIds }, action: "campaign.publish", revertOfId: null }, select: { campaignName: true, createdAt: true }, orderBy: { createdAt: "asc" }, take: 5 }),
    prisma.changeLog.findMany({ where: { actorUserId: userId }, select: { id: true, summary: true, campaignName: true, action: true, createdAt: true, undoneAt: true }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.aiUsage.groupBy({ by: ["feature"], where: { userId }, _sum: { credits: true }, _count: { _all: true } }),
  ]);
  const wsName = new Map(u.workspaceMembers.map((m) => [m.workspace.id, m.workspace.name]));

  type Milestone = { at: Date; kind: "signup" | "workspace" | "connected" | "published"; label: string };
  const milestones: Milestone[] = [{ at: u.createdAt, kind: "signup", label: "Signed up" }];
  for (const m of u.workspaceMembers) {
    milestones.push({ at: m.createdAt, kind: "workspace", label: m.workspace.ownerId === u.id ? `Created workspace ${m.workspace.name}` : `Joined ${m.workspace.name} as ${m.role.toLowerCase().replace("_", " ")}` });
  }
  for (const a of accounts) milestones.push({ at: a.createdAt, kind: "connected", label: `Connected ${a.platform.charAt(0)}${a.platform.slice(1).toLowerCase()} · ${a.accountName}${wsIds.length > 1 ? ` (${wsName.get(a.workspaceId)})` : ""}${a.archivedAt ? " · archived" : ""}` });
  for (const c of firstPublished) milestones.push({ at: c.createdAt, kind: "published", label: `Published ${c.campaignName}` });
  milestones.sort((a, b) => a.at.getTime() - b.at.getTime());

  return {
    user: { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt },
    milestones,
    changes,
    ai: ai.map((a) => ({ feature: a.feature, uses: a._count._all, credits: a._sum.credits ?? 0 })).sort((a, b) => b.credits - a.credits),
  };
}
