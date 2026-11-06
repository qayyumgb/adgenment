import { startJobs, type Recurring } from "../lib/jobs";
import { runApprovalTimeouts, startApprovalScheduler } from "./approvals.service";
import { alertsTick, startAlertsScheduler } from "./alerts.service";
import { hoursTick, startHoursScheduler } from "./hours.service";
import { notificationsTick, startNotificationScheduler } from "./notifications.service";
import { reportsTick, startReportScheduler } from "./reports.service";
import { safetyTick, startSafetyScheduler } from "./safety.service";
import { retentionTick, startRetentionScheduler } from "./retention.service";
import { cleanupDesigns, startDesignCleanupScheduler } from "./designs.service";
import { startSyncScheduler, syncQueues, syncSchedulerEnabled, syncTick } from "./sync-scheduler.service";

/**
 * Everything Advertix does on its own (plan C10), as scheduled jobs. Times are
 * UTC; the hourly jobs are spread over the hour so they don't all start at
 * once. Each keeps its *_ENABLED switch, and its old timer as the fallback
 * when the queue isn't available (see lib/jobs.ts).
 *
 * Emails that go out at a local time (morning briefing, client reports) check
 * the workspace's hour themselves, so they run hourly here.
 */

const on = (flag: string) => (process.env[flag] ?? "true").toLowerCase() !== "false";

export const RECURRING: Recurring[] = [
  // Queues the accounts that are due (each every SYNC_INTERVAL_HOURS); the per-platform queues sync them.
  { name: "sync-due-accounts", cron: "7,22,37,52 * * * *", enabled: syncSchedulerEnabled(), run: syncTick, timer: startSyncScheduler, expireInMinutes: 10 },
  // Held changes past 24 hours (Approvals, C1).
  { name: "approval-timeouts", cron: "*/10 * * * *", enabled: on("APPROVALS_TIMEOUT_ENABLED"), run: runApprovalTimeouts, timer: startApprovalScheduler, expireInMinutes: 10 },
  // Email alerts and the morning briefing (A14, C12); nothing is sent without RESEND_API_KEY.
  { name: "email-alerts", cron: "0 * * * *", enabled: on("NOTIFICATIONS_ENABLED"), run: notificationsTick, timer: startNotificationScheduler },
  // Scheduled client reports (C4b), 09:00 workspace time.
  { name: "client-reports", cron: "2 * * * *", enabled: on("SCHEDULED_REPORTS_ENABLED"), run: reportsTick, timer: startReportScheduler, expireInMinutes: 45 },
  // Safety rules, auto-apply and auto-pause (C13, C14, C6).
  { name: "safety-rules", cron: "5 * * * *", enabled: on("SAFETY_RULES_ENABLED"), run: safetyTick, timer: startSafetyScheduler },
  // Alerts inbox and trial emails (C2, C11).
  { name: "alerts-inbox", cron: "12 * * * *", enabled: on("ALERTS_INBOX_ENABLED"), run: alertsTick, timer: startAlertsScheduler },
  // Smart hours: each account's hourly report once a day, then suggestions (C7).
  { name: "smart-hours", cron: "20 * * * *", enabled: on("SMART_HOURS_ENABLED"), run: () => hoursTick(), timer: startHoursScheduler, expireInMinutes: 45 },
  // Locked workspaces (C15b): access removed at 30 days, deletion emails and deletions. Daily.
  { name: "retention", cron: "40 3 * * *", enabled: on("RETENTION_ENABLED"), run: () => retentionTick(), timer: startRetentionScheduler, expireInMinutes: 60 },
  // Creative editor (C19): unsaved designs left for a day, and uploads unused for 30 days (files deleted from R2).
  { name: "design-cleanup", cron: "47 * * * *", enabled: on("DESIGN_CLEANUP_ENABLED"), run: () => cleanupDesigns(), timer: startDesignCleanupScheduler, expireInMinutes: 30 },
];

/** Start the background jobs: the queue, or the in-process timers if it can't start. */
export function startBackgroundJobs() {
  return startJobs(RECURRING, syncQueues);
}
