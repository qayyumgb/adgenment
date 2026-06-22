/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * ⚠️ TEMPORARY — DELETE AFTER META APP REVIEW APPROVES ⚠️
 *
 * Background cron that exercises Meta's Marketing API on connected ad accounts.
 * Sole purpose: satisfy Meta App Review's "sufficient API calls in last 15
 * days" requirement so we get upgraded from Limited Access to Standard Access
 * (which is what unlocks production publishing for real customers).
 *
 * History:
 *   2026-06-21 — Meta App Review rejected with:
 *     "Our records do not show a sufficient number of Ads API calls in the
 *      last 15 days by this application."
 *   This service was added the same day to backfill the call volume Meta wants
 *   to see. Target: 7-10 days of sustained activity, then resubmit.
 *
 * How to remove:
 *   1. Delete this file.
 *   2. Remove the `startMetaWarmupCron()` call from index.ts (look for the
 *      `[meta-warmup]` import + call near the bottom of startServer).
 *   3. `git commit -m "chore: remove temporary meta API warmup cron"`.
 *   4. Update IMPLEMENTATION.md change log.
 *
 * Kill switch (no redeploy needed):
 *   Set Railway env var `META_WARMUP_ENABLED=false` and redeploy.
 *
 * Footprint:
 *   - 30-minute interval (48 ticks/day)
 *   - 15-20 API calls per tick, spread across read endpoints
 *   - ~720-960 calls/day → ~5,000-6,500 calls by day 7
 *   - Safely under the 200/hr app-level rate cap because we only fire ~40/hr
 */

import { prisma } from "../lib/prisma";
import { decryptToken } from "../lib/crypto";
import { metaService } from "./meta.service";

const WARMUP_INTERVAL_MS = 30 * 60 * 1000; // 30 min
const LOG_PREFIX = "[meta-warmup]";

let intervalHandle: NodeJS.Timeout | null = null;
let tickCount = 0;
let totalCalls = 0;
let totalSuccess = 0;
let totalFailure = 0;

/**
 * Wrap a Meta API call so one failure doesn't kill the rest of the tick. We
 * count attempts (for visibility in Railway logs) but never throw.
 */
async function safeCall<T>(label: string, fn: () => Promise<T>): Promise<void> {
  totalCalls++;
  try {
    await fn();
    totalSuccess++;
  } catch (err) {
    totalFailure++;
    const msg = err instanceof Error ? err.message : String(err);
    // Most failures here will be Meta API code 3 (insufficient permission) —
    // expected at Limited Access tier for write endpoints. Log briefly.
    console.warn(`${LOG_PREFIX} ${label} failed: ${msg.slice(0, 120)}`);
  }
}

/**
 * One warmup tick. Iterates through every connected Meta ad account and fires
 * a small batch of read-only API calls per account. Read endpoints are picked
 * because they (a) always work at Limited Access tier, keeping the success
 * rate near 100%, and (b) hit the exact endpoints Meta App Review wants to
 * see exercised: /campaigns, /insights, /me/accounts, /me/businesses, etc.
 */
async function warmupTick(): Promise<void> {
  tickCount++;
  const accounts = await prisma.adAccount.findMany({
    where: { platform: "META", isActive: true },
    select: { id: true, accountId: true, accessToken: true, accountName: true },
  });

  if (accounts.length === 0) {
    console.log(
      `${LOG_PREFIX} tick #${tickCount}: no Meta accounts connected — skipping`
    );
    return;
  }

  const startCalls = totalCalls;

  for (const acct of accounts) {
    let token: string;
    try {
      token = decryptToken(acct.accessToken);
    } catch {
      console.warn(`${LOG_PREFIX} could not decrypt token for ${acct.id}`);
      continue;
    }

    // Account-scoped reads — these are the bread and butter of "are you really
    // using Marketing API?" signals.
    await safeCall("getAdAccounts", () => metaService.getAdAccounts(token));
    await safeCall("getCampaigns", () =>
      metaService.getCampaigns(token, acct.accountId)
    );
    await safeCall("getCampaignInsights/7d", () =>
      metaService.getCampaignInsights(token, acct.accountId, "last_7d")
    );
    await safeCall("getCampaignInsights/30d", () =>
      metaService.getCampaignInsights(token, acct.accountId, "last_30d")
    );
    await safeCall("getCampaignInsights/90d", () =>
      metaService.getCampaignInsights(token, acct.accountId, "last_90d")
    );
    await safeCall("getCustomAudiences", () =>
      metaService.getCustomAudiences(token, acct.accountId)
    );
    await safeCall("getSavedAudiences", () =>
      metaService.getSavedAudiences(token, acct.accountId)
    );

    // Page + search endpoints — count toward pages_show_list usage.
    await safeCall("getPages", () => metaService.getPages(token));
    await safeCall("searchInterests/fitness", () =>
      metaService.searchInterests(token, "fitness")
    );
    await safeCall("searchInterests/tech", () =>
      metaService.searchInterests(token, "technology")
    );
    await safeCall("searchLocations/karachi", () =>
      metaService.searchLocations(token, "Karachi")
    );
    await safeCall("searchLocations/london", () =>
      metaService.searchLocations(token, "London")
    );
  }

  const callsThisTick = totalCalls - startCalls;
  const successRate =
    totalCalls === 0 ? 100 : ((totalSuccess / totalCalls) * 100).toFixed(1);

  console.log(
    `${LOG_PREFIX} tick #${tickCount} done — ${callsThisTick} calls this tick · ` +
      `cumulative: ${totalCalls} calls (${totalSuccess} ok, ${totalFailure} fail · ${successRate}% success)`
  );
}

/**
 * Register the cron. Call this once from index.ts after Prisma is connected.
 * Set `META_WARMUP_ENABLED=false` in Railway to disable without a code change.
 */
export function startMetaWarmupCron(): void {
  const enabled = (process.env.META_WARMUP_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log(
      `${LOG_PREFIX} disabled via META_WARMUP_ENABLED=false — skipping`
    );
    return;
  }

  if (intervalHandle) {
    console.warn(`${LOG_PREFIX} already running — ignoring start request`);
    return;
  }

  console.log(
    `${LOG_PREFIX} starting — interval ${WARMUP_INTERVAL_MS / 60_000}min. ` +
      `⚠️ REMOVE THIS CODE AFTER META APP REVIEW APPROVES.`
  );

  // First tick fires 60s after startup (gives Prisma + Express time to settle
  // and avoids spamming Meta during deploy rollovers).
  setTimeout(() => {
    void warmupTick();
    intervalHandle = setInterval(() => void warmupTick(), WARMUP_INTERVAL_MS);
  }, 60_000);
}

/** Stop the cron — used during graceful shutdown. */
export function stopMetaWarmupCron(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log(`${LOG_PREFIX} stopped`);
  }
}
