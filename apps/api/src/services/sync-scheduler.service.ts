/**
 * Background sync scheduler.
 *
 * The app only imported Meta data on demand, so campaigns created on Meta
 * after the initial connect (e.g. a boosted post) never appeared until a
 * manual sync. This cron periodically re-syncs every active Meta ad account so
 * the dashboard stays current without user action. A manual "Sync now" button
 * still exists for immediate refresh.
 *
 * Interval is `SYNC_INTERVAL_HOURS` (default 6). Disable with
 * `SYNC_SCHEDULER_ENABLED=false`. Each tick skips accounts synced within the
 * last interval so overlapping triggers (manual + scheduled) don't double-work.
 */

import { prisma } from "../lib/prisma";
import { syncService } from "./sync.service";

const LOG_PREFIX = "[sync-scheduler]";

const INTERVAL_HOURS = (() => {
  const raw = Number(process.env.SYNC_INTERVAL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : 6;
})();
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

let intervalHandle: NodeJS.Timeout | null = null;
let running = false;

async function syncTick(): Promise<void> {
  // Guard against overlap if a previous tick (or a manual sync storm) is slow.
  if (running) {
    console.warn(`${LOG_PREFIX} previous tick still running — skipping`);
    return;
  }
  running = true;
  try {
    const cutoff = new Date(Date.now() - INTERVAL_MS);
    // Sync active Meta accounts that haven't synced within the last interval
    // (null lastSyncedAt = never synced → always include).
    const accounts = await prisma.adAccount.findMany({
      where: {
        platform: "META",
        isActive: true,
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
      },
    });
    if (accounts.length === 0) return;

    console.log(`${LOG_PREFIX} syncing ${accounts.length} Meta account(s)…`);
    for (const acct of accounts) {
      try {
        const r = await syncService.syncMetaAccount(acct);
        console.log(
          `${LOG_PREFIX} ${acct.accountName}: ${r.campaignsSynced} campaigns, ${r.metricsSynced} metric rows`
        );
      } catch (err) {
        // One bad account (expired token, etc.) shouldn't stop the rest.
        const msg = err instanceof Error ? err.message : "unknown";
        console.error(`${LOG_PREFIX} ${acct.accountName} sync failed: ${msg}`);
      }
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} tick failed:`, err);
  } finally {
    running = false;
  }
}

/** Register the scheduler. Call once from index.ts after Prisma connects. */
export function startSyncScheduler(): void {
  const enabled =
    (process.env.SYNC_SCHEDULER_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
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
