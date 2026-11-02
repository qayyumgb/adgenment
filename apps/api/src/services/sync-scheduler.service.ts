/**
 * Background sync scheduler.
 *
 * Periodically re-syncs every active ad account on Meta, Google, TikTok and
 * LinkedIn (A13; Meta only before) so the dashboard stays current without user
 * action. Archived accounts are skipped, and a workspace can turn auto-sync off
 * per platform on the Connections page. "Sync now" still syncs immediately.
 *
 * Interval is `SYNC_INTERVAL_HOURS` (default 6). Disable with
 * `SYNC_SCHEDULER_ENABLED=false`. Each tick skips accounts synced within the
 * last interval so overlapping triggers (manual + scheduled) don't double-work.
 *
 * With the job queue (C10) the tick runs every 15 minutes and only queues the
 * accounts that are due: one job per account, in a queue per platform, a few
 * at a time, retried with backoff when the platform fails for a moment (rate
 * limits, timeouts). Lost access isn't retried; the account shows it on
 * Connections. Without the queue, the old timer syncs them one by one.
 */

import type { AdAccount, Platform } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { enqueue, pendingKeys, queueRunning, type WorkQueue } from "../lib/jobs";
import { isMetaError } from "../lib/meta-errors";
import { syncService } from "./sync.service";

const LOG_PREFIX = "[sync-scheduler]";
/** The platforms with a sync connector. */
export const AUTO_SYNC_PLATFORMS: Platform[] = ["META", "GOOGLE", "TIKTOK", "LINKEDIN"];
export const SYNC_INTERVAL_HOURS_SETTING = () => INTERVAL_HOURS;

const INTERVAL_HOURS = (() => {
  const raw = Number(process.env.SYNC_INTERVAL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : 6;
})();
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;
/** Account syncs running at once per platform, per API instance. */
const CONCURRENCY = Math.min(Math.max(Number(process.env.SYNC_CONCURRENCY) || 2, 1), 5);

export const syncSchedulerEnabled = () => (process.env.SYNC_SCHEDULER_ENABLED ?? "true").toLowerCase() !== "false";
export const syncQueueName = (platform: Platform) => `sync-${platform.toLowerCase()}`;

let intervalHandle: NodeJS.Timeout | null = null;
let running = false;

/** Accounts due a sync: active, not archived, auto-sync on, not synced within the interval. */
async function dueAccounts(now = new Date()): Promise<AdAccount[]> {
  const cutoff = new Date(now.getTime() - INTERVAL_MS);
  // Active, not archived accounts on the platforms we sync, not synced within
  // the last interval (null = never synced), minus platforms a workspace
  // turned auto-sync off for (Connections, A13).
  const accounts = await prisma.adAccount.findMany({
    where: {
      platform: { in: AUTO_SYNC_PLATFORMS },
      isActive: true,
      archivedAt: null,
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
    },
    include: { workspace: { select: { autoSyncOff: true } } },
  });
  return accounts.filter((a) => !a.workspace.autoSyncOff.includes(a.platform)).map(({ workspace: _w, ...acct }) => acct);
}

/** Lost access or a missing setup: retrying won't help until someone reconnects. */
export function permanentSyncError(err: unknown): boolean {
  if (isMetaError(err)) return [3, 10, 190, 200].includes(err.metaCode);
  const status = err instanceof Error ? (err as Error & { httpStatus?: number }).httpStatus : undefined;
  if (status === 401 || status === 403) return true;
  return err instanceof Error && /not configured|can't sync/i.test(err.message);
}

export async function syncTick(): Promise<void> {
  // Guard against overlap if a previous tick (or a manual sync storm) is slow.
  if (running) {
    console.warn(`${LOG_PREFIX} previous tick still running — skipping`);
    return;
  }
  running = true;
  try {
    const due = await dueAccounts();
    if (due.length === 0) return;

    if (queueRunning()) {
      // One job per account; an account with a job waiting, retrying or running isn't queued again.
      let queued = 0;
      const busy = new Map<Platform, Set<string>>();
      for (const a of due) {
        if (!busy.has(a.platform)) busy.set(a.platform, await pendingKeys(syncQueueName(a.platform)));
        if (busy.get(a.platform)!.has(a.id)) continue;
        if (await enqueue(syncQueueName(a.platform), { accountId: a.id }, a.id)) queued++;
      }
      if (queued) console.log(`${LOG_PREFIX} queued ${queued} account sync(s)`);
      return;
    }

    console.log(`${LOG_PREFIX} syncing ${due.length} account(s)…`);
    for (const acct of due) {
      try {
        const r = await syncService.syncAccount(acct);
        console.log(
          `${LOG_PREFIX} ${acct.platform} ${acct.accountName}: ${r.campaignsSynced} campaigns, ${r.metricsSynced} metric rows`
        );
      } catch (err) {
        // One bad account (expired token, etc.) shouldn't stop the rest.
        const msg = err instanceof Error ? err.message : "unknown";
        console.error(`${LOG_PREFIX} ${acct.accountName} sync failed: ${msg}`);
      }
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} tick failed:`, err);
    if (queueRunning()) throw err;
  } finally {
    running = false;
  }
}

/**
 * One queued account sync. Re-checks the account first: it may have been
 * disconnected, archived, set to manual, or synced with "Sync now" since it
 * was queued. A temporary failure throws, so the queue retries it.
 */
export async function syncAccountJob({ accountId }: { accountId: string }): Promise<void> {
  const acct = await prisma.adAccount.findUnique({ where: { id: accountId }, include: { workspace: { select: { autoSyncOff: true } } } });
  if (!acct || !acct.isActive || acct.archivedAt || acct.workspace.autoSyncOff.includes(acct.platform)) return;
  if (acct.lastSyncedAt && acct.lastSyncedAt.getTime() > Date.now() - INTERVAL_MS) return;
  const { workspace: _w, ...account } = acct;
  try {
    const r = await syncService.syncAccount(account);
    console.log(`${LOG_PREFIX} ${acct.platform} ${acct.accountName}: ${r.campaignsSynced} campaigns, ${r.metricsSynced} metric rows`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // syncAccount has already saved the error on the account (Connections, sync alerts).
    if (permanentSyncError(err)) {
      console.error(`${LOG_PREFIX} ${acct.accountName} sync failed (needs reconnecting, not retried): ${msg}`);
      return;
    }
    console.error(`${LOG_PREFIX} ${acct.accountName} sync failed, will retry: ${msg}`);
    throw err;
  }
}

/** The per-platform sync queues: a few accounts at a time, 3 retries (about 1, 2 and 4 minutes apart). */
export const syncQueues: WorkQueue<{ accountId: string }>[] = AUTO_SYNC_PLATFORMS.map((p) => ({
  name: syncQueueName(p),
  concurrency: CONCURRENCY,
  run: syncAccountJob,
  retryLimit: 3,
  retryDelaySeconds: 60,
  expireInMinutes: 30,
}));

/** Register the scheduler. Call once from index.ts after Prisma connects. */
export function startSyncScheduler(): void {
  if (!syncSchedulerEnabled()) {
    console.log(`${LOG_PREFIX} disabled via SYNC_SCHEDULER_ENABLED=false`);
    return;
  }
  if (intervalHandle) {
    console.warn(`${LOG_PREFIX} already running — ignoring start request`);
    return;
  }
  console.log(`${LOG_PREFIX} starting — every ${INTERVAL_HOURS}h`);
  // First tick 90s after boot (let Prisma/Express settle; avoid deploy-rollover
  // spikes). Subsequent ticks on the interval.
  setTimeout(() => {
    void syncTick();
    intervalHandle = setInterval(() => void syncTick(), INTERVAL_MS);
  }, 90_000);
}

/** Stop the scheduler — used during graceful shutdown. */
export function stopSyncScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log(`${LOG_PREFIX} stopped`);
  }
}
