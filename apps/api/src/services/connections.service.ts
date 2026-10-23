import type { AdAccount, Platform, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ensureClients } from "../lib/clients";
import { healthForAdAccount } from "./meta-health.service";
import { syncService } from "./sync.service";
import { AUTO_SYNC_PLATFORMS, SYNC_INTERVAL_HOURS_SETTING } from "./sync-scheduler.service";

/**
 * Connections (plan A13). OAuth no longer adds every ad account it finds:
 * accounts already in Advertix get their new token (that's "Renew"), and the
 * new ones wait in a PendingConnection for 30 minutes until the Connect
 * dialog adds the picked ones, each with a client. Accounts can be archived
 * (hidden, not synced, data kept) and restored.
 */

const DAY = 86_400_000;
const PENDING_MINUTES = 30;
/** A token this close to expiry is flagged (banner + "Renew"). */
const EXPIRING_DAYS = 7;

export const PLATFORM_INFO: Record<string, { name: string; api: string }> = {
  META: { name: "Meta", api: "Marketing API" },
  GOOGLE: { name: "Google Ads", api: "Google Ads API" },
  TIKTOK: { name: "TikTok", api: "TikTok Business API" },
  LINKEDIN: { name: "LinkedIn", api: "LinkedIn Marketing API" },
  SNAPCHAT: { name: "Snapchat", api: "Snap Marketing API" },
};
/** Platforms with a connector, in card order; Snapchat shows as coming soon. */
export const CONNECTABLE: Platform[] = ["META", "GOOGLE", "TIKTOK", "LINKEDIN"];

export type Discovered = { accountId: string; accountName: string; currency: string | null; timezone: string | null; isActive: boolean };
export type OAuthTokens = { accessToken: string; refreshToken: string | null; tokenExpiresAt: Date | null };

/**
 * Called by each OAuth callback once the code is exchanged and accounts are
 * listed. Returns the query string for /connect/done.
 */
export async function stageConnection(workspaceId: string, userId: string, platform: Platform, tokens: OAuthTokens, discovered: Discovered[]): Promise<string> {
  const p = platform.toLowerCase();
  const existing = await prisma.adAccount.findMany({ where: { workspaceId, platform, accountId: { in: discovered.map((d) => d.accountId) } }, select: { id: true, accountId: true } });
  const known = new Set(existing.map((e) => e.accountId));
  for (const d of discovered.filter((x) => known.has(x.accountId))) {
    await prisma.adAccount.update({
      where: { workspaceId_platform_accountId: { workspaceId, platform, accountId: d.accountId } },
      data: {
        accountName: d.accountName,
        currency: d.currency,
        timezone: d.timezone,
        accessToken: tokens.accessToken,
        // Keep the stored refresh token when the platform didn't issue a new one.
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
        tokenExpiresAt: tokens.tokenExpiresAt,
        isActive: d.isActive,
      },
    });
  }
  // Renewed Meta accounts: re-check health so the page clears token warnings.
  if (platform === "META") await Promise.all(existing.map((e) => healthForAdAccount(e.id, true).catch(() => undefined)));

  const fresh = discovered.filter((x) => !known.has(x.accountId));
  await prisma.pendingConnection.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { workspaceId, userId, platform }] } });
  if (!fresh.length) return `connected=${p}&renewed=${existing.length}`;
  const pending = await prisma.pendingConnection.create({
    data: {
      workspaceId,
      userId,
      platform,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.tokenExpiresAt,
      accounts: fresh as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + PENDING_MINUTES * 60_000),
    },
  });
  return `connected=${p}&renewed=${existing.length}&pending=${pending.id}`;
}

export class ConnectionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function findPending(workspaceId: string, id: string) {
  const pending = await prisma.pendingConnection.findFirst({ where: { id, workspaceId } });
  if (!pending || pending.expiresAt < new Date()) throw new ConnectionError(404, "That connection has expired. Connect again to pick accounts.");
  return pending;
}

export async function pendingView(workspaceId: string, id: string) {
  const p = await findPending(workspaceId, id);
  return { id: p.id, platform: p.platform, accounts: p.accounts as unknown as Discovered[], expiresAt: p.expiresAt };
}

/** Add the picked accounts (each with a client or none), then start their first sync in the background. */
export async function acceptPending(workspaceId: string, id: string, picks: { accountId: string; clientId: string | null }[], allowedClientIds: string[] | null) {
  const p = await findPending(workspaceId, id);
  const offered = new Map((p.accounts as unknown as Discovered[]).map((a) => [a.accountId, a]));
  const chosen = (picks ?? []).filter((x) => offered.has(String(x.accountId)));
  if (!chosen.length) throw new ConnectionError(400, "Pick at least one account.");
  const clientIds = [...new Set(chosen.map((c) => c.clientId).filter((c): c is string => !!c))];
  if (clientIds.length) {
    const valid = await prisma.client.findMany({ where: { workspaceId, id: { in: clientIds } }, select: { id: true } });
    if (valid.length !== clientIds.length) throw new ConnectionError(404, "Client not found");
  }
  if (allowedClientIds && chosen.some((c) => !c.clientId || !allowedClientIds.includes(c.clientId))) throw new ConnectionError(403, "Assign each account to one of your clients.");

  const created: AdAccount[] = [];
  for (const c of chosen) {
    const a = offered.get(String(c.accountId))!;
    created.push(
      await prisma.adAccount.upsert({
        where: { workspaceId_platform_accountId: { workspaceId, platform: p.platform, accountId: a.accountId } },
        create: { workspaceId, platform: p.platform, accountId: a.accountId, accountName: a.accountName, currency: a.currency, timezone: a.timezone, isActive: a.isActive, accessToken: p.accessToken, refreshToken: p.refreshToken, tokenExpiresAt: p.tokenExpiresAt, clientId: c.clientId },
        update: { accountName: a.accountName, accessToken: p.accessToken, ...(p.refreshToken ? { refreshToken: p.refreshToken } : {}), tokenExpiresAt: p.tokenExpiresAt, isActive: a.isActive, clientId: c.clientId, archivedAt: null },
      })
    );
  }
  await prisma.pendingConnection.delete({ where: { id: p.id } });
  // First sync (and Meta health) in the background; the page shows "Syncing…" until lastSyncedAt is set.
  for (const acct of created.filter((x) => x.isActive)) {
    void (async () => {
      if (acct.platform === "META") await healthForAdAccount(acct.id, true).catch(() => undefined);
      await syncService.syncAccount(acct).catch((err) => console.error(`[connections] first sync ${acct.accountName}:`, err instanceof Error ? err.message : err));
    })();
  }
  return { added: created.map((a) => ({ id: a.id, accountName: a.accountName, platform: a.platform, clientId: a.clientId, isActive: a.isActive })) };
}

export async function discardPending(workspaceId: string, id: string) {
  await prisma.pendingConnection.deleteMany({ where: { id, workspaceId } });
}

/* ── Status of each account ───────────────────────────────────────────────── */

export type AccountStatus = "HEALTHY" | "TOKEN_EXPIRING" | "TOKEN_EXPIRED" | "PIXEL_ISSUE" | "BLOCKED" | "UNASSIGNED" | "INACTIVE" | "ARCHIVED";
type StoredCheck = { status?: string; code?: string; title?: string; message?: string };
type StoredReport = { overall?: string; checks?: StoredCheck[] };
const TOKEN_CODES = /^(TOKEN_EXPIRED|TOKEN_INVALID|PERMISSION_DENIED|MISSING_PERMISSION_)/;
const PIXEL_CODES = /^(NO_PIXEL|PIXEL_NEVER_FIRED)$/;

/** The one thing to show (and act on) for an account, most urgent first. */
export function accountStatus(a: Pick<AdAccount, "archivedAt" | "isActive" | "tokenExpiresAt" | "clientId" | "metadata">, hasClients: boolean, now = Date.now()): { status: AccountStatus; detail: string | null } {
  if (a.archivedAt) return { status: "ARCHIVED", detail: null };
  if (!a.isActive) return { status: "INACTIVE", detail: "Paused or disabled on the platform" };
  const problems = ((a.metadata as StoredReport | null)?.checks ?? []).filter((c) => c.status === "error" || c.status === "warning");
  const tokenProblem = problems.find((c) => TOKEN_CODES.test(c.code ?? ""));
  const expires = a.tokenExpiresAt ? a.tokenExpiresAt.getTime() : null;
  if ((expires !== null && expires <= now) || tokenProblem) return { status: "TOKEN_EXPIRED", detail: tokenProblem?.title ?? "Access expired" };
  if (expires !== null && expires - now < EXPIRING_DAYS * DAY) {
    const days = Math.max(1, Math.ceil((expires - now) / DAY));
    return { status: "TOKEN_EXPIRING", detail: `Access expires in ${days} day${days === 1 ? "" : "s"}` };
  }
  const blocking = problems.find((c) => c.status === "error" && !PIXEL_CODES.test(c.code ?? ""));
  if (blocking) return { status: "BLOCKED", detail: blocking.title ?? "Needs attention" };
  const pixel = problems.find((c) => PIXEL_CODES.test(c.code ?? ""));
  if (pixel) return { status: "PIXEL_ISSUE", detail: pixel.title ?? "Pixel issue" };
  if (hasClients && !a.clientId) return { status: "UNASSIGNED", detail: "Not assigned to a client" };
  return { status: "HEALTHY", detail: null };
}
const ATTENTION: AccountStatus[] = ["TOKEN_EXPIRING", "TOKEN_EXPIRED", "PIXEL_ISSUE", "BLOCKED"];

/* ── The Connections page ─────────────────────────────────────────────────── */

export async function connectionsOverview(workspaceId: string, clientId: string | null) {
  await ensureClients(workspaceId);
  const [workspace, clientCount, accounts] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { autoSyncOff: true } }),
    prisma.client.count({ where: { workspaceId } }),
    prisma.adAccount.findMany({
      where: { workspaceId, ...(clientId ? { clientId } : {}) },
      select: { id: true, platform: true, accountId: true, accountName: true, currency: true, timezone: true, minDailyBudget: true, isActive: true, archivedAt: true, createdAt: true, lastSyncedAt: true, clientId: true, tokenExpiresAt: true, metadata: true, lastHealthCheck: true, client: { select: { name: true } }, _count: { select: { campaigns: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const since = new Date(Date.now() - 30 * DAY);
  const spendRows = accounts.length
    ? await prisma.campaignMetrics.groupBy({ by: ["campaignId"], where: { date: { gte: since }, campaign: { adAccountId: { in: accounts.map((a) => a.id) } } }, _sum: { spend: true } })
    : [];
  const campaignAccount = spendRows.length
    ? new Map((await prisma.campaign.findMany({ where: { id: { in: spendRows.map((r) => r.campaignId) } }, select: { id: true, adAccountId: true } })).map((c) => [c.id, c.adAccountId]))
    : new Map<string, string>();
  const spendBy = new Map<string, number>();
  for (const r of spendRows) {
    const acct = campaignAccount.get(r.campaignId);
    if (acct) spendBy.set(acct, (spendBy.get(acct) ?? 0) + Number(r._sum.spend ?? 0));
  }

  const rows = accounts.map(({ metadata, client, _count, ...a }) => {
    const s = accountStatus({ ...a, metadata }, clientCount > 1);
    return {
      ...a,
      clientName: client?.name ?? null,
      campaigns: _count.campaigns,
      spend30d: Math.round((spendBy.get(a.id) ?? 0) * 100) / 100,
      status: s.status,
      statusDetail: s.detail,
      // Meta health report summary (null for other platforms, or before a check).
      health: (metadata as StoredReport | null)?.overall ?? null,
    };
  });
  const live = rows.filter((r) => r.status !== "ARCHIVED");
  const platforms = [...CONNECTABLE, "SNAPCHAT" as Platform].map((platform) => {
    const mine = live.filter((r) => r.platform === platform);
    const currencies = [...new Set(mine.map((r) => r.currency).filter(Boolean))];
    const synced = mine.map((r) => r.lastSyncedAt?.getTime() ?? 0).filter(Boolean);
    return {
      platform,
      ...PLATFORM_INFO[platform],
      available: CONNECTABLE.includes(platform),
      accounts: mine.length,
      spend30d: currencies.length <= 1 ? Math.round(mine.reduce((s, r) => s + r.spend30d, 0) * 100) / 100 : null,
      currency: currencies.length === 1 ? currencies[0] : null,
      status: !CONNECTABLE.includes(platform) ? ("COMING_SOON" as const) : !mine.length ? ("NOT_CONNECTED" as const) : mine.some((r) => ATTENTION.includes(r.status)) ? ("ATTENTION" as const) : ("CONNECTED" as const),
      lastSyncedAt: synced.length ? new Date(Math.max(...synced)) : null,
      autoSync: AUTO_SYNC_PLATFORMS.includes(platform) && !workspace.autoSyncOff.includes(platform),
    };
  });
  return { platforms, accounts: rows, hasClients: clientCount > 1, syncIntervalHours: SYNC_INTERVAL_HOURS_SETTING() };
}

/** Sync now: every live account (optionally one platform's), one after another; failures reported per account. */
export async function syncAll(workspaceId: string, clientId: string | null, platform: Platform | null) {
  const accounts = await prisma.adAccount.findMany({ where: { workspaceId, isActive: true, archivedAt: null, platform: platform ? platform : { in: CONNECTABLE }, ...(clientId ? { clientId } : {}) } });
  if (!accounts.length) throw new ConnectionError(400, platform ? `No active ${PLATFORM_INFO[platform]?.name ?? platform} accounts to sync.` : "No active ad accounts to sync.");
  const results: { id: string; accountName: string; platform: Platform; ok: boolean; campaigns: number; error: string | null }[] = [];
  for (const a of accounts) {
    try {
      const r = await syncService.syncAccount(a);
      results.push({ id: a.id, accountName: a.accountName, platform: a.platform, ok: true, campaigns: r.campaignsSynced, error: null });
    } catch (err) {
      results.push({ id: a.id, accountName: a.accountName, platform: a.platform, ok: false, campaigns: 0, error: err instanceof Error ? err.message : "Sync failed" });
    }
  }
  return { synced: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
}

export async function setArchived(workspaceId: string, id: string, archived: boolean) {
  const a = await prisma.adAccount.findFirst({ where: { id, workspaceId } });
  if (!a) throw new ConnectionError(404, "Ad account not found");
  // Archiving also marks it inactive so planners, allocators and syncs leave it alone; restoring turns it back on (the next sync corrects it from the platform).
  return prisma.adAccount.update({ where: { id }, data: archived ? { archivedAt: new Date(), isActive: false } : { archivedAt: null, isActive: true }, select: { id: true, archivedAt: true, isActive: true, clientId: true } });
}

export async function setAutoSync(workspaceId: string, platform: Platform, enabled: boolean) {
  if (!AUTO_SYNC_PLATFORMS.includes(platform)) throw new ConnectionError(400, "Advertix can't sync that platform yet.");
  const w = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { autoSyncOff: true } });
  const off = new Set(w.autoSyncOff);
  if (enabled) off.delete(platform);
  else off.add(platform);
  await prisma.workspace.update({ where: { id: workspaceId }, data: { autoSyncOff: [...off] } });
  return { platform, autoSync: enabled };
}
