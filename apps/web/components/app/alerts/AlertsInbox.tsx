"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AlertOctagon, AlertTriangle, Bell, CheckCircle2, Info, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useRefreshOnNavigate } from "@/hooks/useRefreshOnNavigate";
import { useApiClient, type AlertAction, type AlertSeverity, type AppAlert } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { Button, Drawer, EmptyState, IconButton, Segmented, Skeleton, useConfirm } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";

/**
 * Alerts inbox (plan C2): the header bell and its panel. The badge counts
 * alerts that are new since you last opened it (red when any is critical).
 * Alerts are grouped by campaign / account / client, each with one-click
 * fixes; they resolve on their own when the problem clears.
 */

const ICON: Record<AlertSeverity, { icon: typeof Info; tone: string; label: string }> = {
  CRITICAL: { icon: AlertOctagon, tone: "text-neg", label: "Critical" },
  WARNING: { icon: AlertTriangle, tone: "text-warn", label: "Warning" },
  INFO: { icon: Info, tone: "text-brand", label: "For your information" },
};

/** Group in the order the API sorted them (most severe first). */
function grouped(alerts: AppAlert[]) {
  const groups: { label: string; items: AppAlert[] }[] = [];
  for (const a of alerts) {
    const g = groups.find((x) => x.label === a.groupLabel);
    if (g) g.items.push(a);
    else groups.push({ label: a.groupLabel, items: [a] });
  }
  return groups;
}

function Inbox({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const api = useApiClient();
  const router = useRouter();
  const access = useAccess();
  const canEdit = access.can("edit");
  const [state, setState] = useState<"open" | "resolved">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const q = useApi((c) => (open ? c.getAlerts(state) : new Promise<never>(() => {})), [open, state], { key: "alerts" });

  // Opening the inbox marks everything as seen.
  useEffect(() => {
    if (!open) return;
    void api.markAlertsSeen().then(onChanged).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reload = async () => {
    try {
      // Recompute now so a fixed problem drops out straight away.
      await api.getAlerts("open", true);
    } catch {
      /* the list refetch below still runs */
    }
    await q.refetch();
    onChanged();
  };

  const run = async (a: AppAlert, x: AlertAction) => {
    if (x.type === "link") {
      onClose();
      router.push(x.href);
      return;
    }
    if (x.type === "pause" && !(await confirm({ title: `Pause “${a.groupLabel}”?`, body: "It stops delivering on Meta straight away. You can resume it, or undo this for 7 days.", confirmLabel: "Pause" }))) return;
    if (x.type === "undo" && !(await confirm({ title: "Undo this automatic change?", body: a.detail, confirmLabel: "Undo" }))) return;
    setBusy(`${a.id}:${x.type}`);
    try {
      if (x.type === "sync") {
        await api.syncAdAccount(x.adAccountId);
        toast.success("Synced");
      } else if (x.type === "pause") {
        await api.launchCampaign(x.campaignId, "PAUSED");
        toast.success("Paused");
      } else {
        await api.undoChange(x.changeId);
        toast.success("Undone");
      }
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async (a: AppAlert) => {
    setBusy(`${a.id}:dismiss`);
    try {
      await api.dismissAlert(a.id);
      await q.refetch();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't dismiss it.");
    } finally {
      setBusy(null);
    }
  };

  const alerts = q.data?.alerts ?? [];
  const critical = alerts.filter((a) => a.severity === "CRITICAL").length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Alerts"
      sub={state === "open" ? (alerts.length ? `${alerts.length} open${critical ? ` · ${critical} critical` : ""}` : "Nothing needs you right now") : "Cleared or dismissed in the last 7 days"}
      width={460}
    >
      <div className="flex flex-col gap-4">
        <Segmented
          label="Alerts"
          size="sm"
          value={state}
          onChange={setState}
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
          ]}
          className="self-start"
        />
        {q.loading ? (
          <Skeleton className="h-40" />
        ) : q.error ? (
          <div className="flex flex-col items-start gap-2 text-sm">
            <span className="text-neg">Couldn’t load alerts: {q.error}</span>
            <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
              Try again
            </Button>
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} className="text-pos" />}
            title={state === "open" ? "All clear" : "Nothing resolved this week"}
            body={state === "open" ? "Advertix checks every hour for access problems, failed syncs, pacing, cost spikes, broken tracking and automatic changes." : "Alerts move here when the problem clears or someone dismisses them."}
          />
        ) : (
          grouped(alerts).map((g) => (
            <section key={g.label} className="flex flex-col gap-2">
              <h3 className="m-0 truncate text-xs font-semibold uppercase tracking-[.04em] text-ink-3">{g.label}</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {g.items.map((a) => {
                  const S = ICON[a.severity];
                  const actions = a.actions.filter((x) => x.type === "link" || canEdit);
                  return (
                    <li key={a.id} className={cn("relative flex gap-3 rounded-card border bg-surface p-3.5", a.severity === "CRITICAL" && state === "open" ? "border-neg/40" : "border-line")}>
                      <S.icon size={18} className={cn("mt-0.5 flex-none", S.tone)} aria-label={S.label} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-start gap-2 pr-6">
                          <span className="text-sm font-semibold">{a.title}</span>
                          {a.unread && <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-brand" aria-label="New" />}
                        </span>
                        <span className="text-[13px] text-ink-2">{a.detail}</span>
                        <span className="text-xs text-ink-3">
                          {state === "open" ? `Since ${timeAgo(a.firstSeenAt)}` : a.dismissedAt ? `Dismissed ${timeAgo(a.dismissedAt)}` : `Cleared ${timeAgo(a.resolvedAt!)}`}
                        </span>
                        {state === "open" && actions.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-2">
                            {actions.map((x, i) => (
                              <Button key={i} variant={i === 0 ? "primary" : "secondary"} size="sm" loading={busy === `${a.id}:${x.type}`} disabled={busy !== null} onClick={() => void run(a, x)}>
                                {x.label}
                              </Button>
                            ))}
                          </span>
                        )}
                      </div>
                      {state === "open" && canEdit && (
                        <button
                          type="button"
                          aria-label={`Dismiss: ${a.title}`}
                          title="Dismiss for everyone (it comes back if the problem returns)"
                          disabled={busy !== null}
                          onClick={() => void dismiss(a)}
                          className="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
      {dialog}
    </Drawer>
  );
}

/** The header bell: unread badge (red when something is critical) and the inbox. */
export function AlertsButton({ size = 36 }: { size?: 36 | 38 }) {
  const [open, setOpen] = useState(false);
  const summary = useApi((c) => c.getAlertSummary(), [], { key: "alert-summary" });
  const { refetch } = summary;
  // Desktop and mobile bars both render the bell: one refresh per page change.
  useRefreshOnNavigate("alert-summary", refetch);
  useEffect(() => {
    const t = setInterval(() => void refetch(), 5 * 60_000);
    return () => clearInterval(t);
  }, [refetch]);
  const s = summary.data;
  const count = s?.unread ?? 0;
  const label = s ? `Alerts: ${s.open} open${s.unread ? `, ${s.unread} new` : ""}${s.critical ? `, ${s.critical} critical` : ""}` : "Alerts";

  return (
    <>
      <span className="relative inline-flex">
        <IconButton label={label} size={size} onClick={() => setOpen(true)}>
          <Bell size={18} />
        </IconButton>
        {count > 0 && (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ring-2 ring-surface", s?.critical ? "bg-neg" : "bg-brand")}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </span>
      <Inbox open={open} onClose={() => setOpen(false)} onChanged={() => void refetch()} />
    </>
  );
}
