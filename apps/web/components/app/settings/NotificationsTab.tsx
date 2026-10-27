"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, Mail } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type NotificationEvent } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { Button, Card, Pill, Skeleton } from "@/components/app/ui";
import type { SettingsSaver } from "./types";

/**
 * Settings › Notifications (plan A14; decision: real email for a few events).
 * Your own choices, per event. Email is real (sent hourly by the API when
 * something happens); Slack and in-app are shown as coming soon.
 */

const EVENT_LABEL: Record<string, string> = { ACCESS: "Ad platform access", SYNC_FAILED: "Sync failures", PACING: "Budget pacing", APPROVALS: "Approvals", SAFETY: "Safety rules", MORNING_BRIEFING: "Morning briefing", WEEKLY_SUMMARY: "Weekly summary", TEST: "Test email" };

function Box({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "mx-auto inline-flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] transition-colors focus-visible:ring-[3px] focus-visible:ring-brand-soft disabled:cursor-not-allowed",
        checked ? "border-brand bg-brand text-white" : "border-line-2 bg-surface",
        disabled && !checked && "bg-surface-2 opacity-60"
      )}
    >
      {checked && <Check size={12} strokeWidth={3.5} aria-hidden="true" />}
    </button>
  );
}

export function NotificationsTab({ setSaver }: { setSaver: (s: SettingsSaver | null) => void }) {
  const api = useApiClient();
  const q = useApi((c) => c.getMyNotifications(), [], { key: "my-notifications" });
  const data = q.data;
  const initial = useMemo(() => Object.fromEntries((data?.events ?? []).map((e) => [e.id, e.email])) as Record<NotificationEvent, boolean>, [data]);
  const [prefs, setPrefs] = useState<Record<NotificationEvent, boolean> | null>(null);
  const [testing, setTesting] = useState(false);
  const [briefing, setBriefing] = useState(false);
  useEffect(() => setPrefs(data ? initial : null), [data, initial]);
  const dirty = Boolean(prefs && JSON.stringify(prefs) !== JSON.stringify(initial));

  useEffect(() => {
    if (!prefs) return setSaver(null);
    setSaver({
      dirty,
      disabled: false,
      reason: null,
      save: async () => {
        await api.saveMyNotifications(prefs);
        await q.refetch();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, dirty]);
  useEffect(() => () => setSaver(null), [setSaver]);

  const test = async () => {
    setTesting(true);
    try {
      await api.sendTestNotification();
      toast.success("Test email sent. Check your inbox.");
      void q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The test email didn't send.");
    } finally {
      setTesting(false);
    }
  };

  const briefNow = async () => {
    setBriefing(true);
    try {
      await api.sendBriefingNow();
      toast.success("Today's briefing is on its way. Check your inbox.");
      void q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The briefing didn't send.");
    } finally {
      setBriefing(false);
    }
  };

  if (q.error) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load your notifications: {q.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!data || !prefs) return <Skeleton className="h-[360px] rounded-card" />;

  return (
    <>
      {!data.emailConfigured && (
        <div role="status" className="rounded-[14px] bg-warn-soft px-[18px] py-3.5 text-sm">
          <span className="font-semibold">Email isn&apos;t set up on the server yet.</span> <span className="text-ink-2">Your choices are saved, but nothing is sent until an administrator adds the email key (RESEND_API_KEY) to the API.</span>
        </div>
      )}
      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="flex min-w-0 flex-[1_1_260px] flex-col">
            <span className="text-base font-semibold">Your alerts</span>
            <span className="text-[13px] text-ink-2">Advertix checks every hour and emails you once per thing that happens. These choices are yours; teammates set their own.</span>
          </span>
          <Button variant="secondary" size="sm" icon={<Mail size={14} />} loading={testing} disabled={!data.emailConfigured} onClick={() => void test()}>
            Send a test email
          </Button>
        </div>
        <div className="grid grid-cols-[minmax(150px,1fr)_repeat(3,64px)] items-center border-t border-line bg-surface-2 px-5 py-2.5 text-xs font-medium text-ink-2">
          <span>Event</span>
          <span className="text-center">Email</span>
          <span className="text-center">Slack</span>
          <span className="text-center">In app</span>
        </div>
        {data.events.map((e) => (
          <div key={e.id} className={cn("grid grid-cols-[minmax(150px,1fr)_repeat(3,64px)] items-center gap-y-1 border-t border-line px-5 py-3.5", !e.eligible && "opacity-60")}>
            <span className="flex min-w-0 flex-col pr-3">
              <span className="font-semibold">{e.label}</span>
              <span className="text-[13px] text-ink-2">{e.eligible ? e.sub : "Not available for your role"}</span>
              {e.id === "MORNING_BRIEFING" && e.eligible && data.emailConfigured && (
                <button type="button" disabled={briefing} onClick={() => void briefNow()} className="mt-1 self-start text-[13px] font-semibold text-brand hover:text-brand-hover disabled:opacity-60">
                  {briefing ? "Sending…" : "Send me today's briefing now"}
                </button>
              )}
            </span>
            <Box checked={prefs[e.id]} disabled={!e.eligible} onChange={(v) => setPrefs((p) => (p ? { ...p, [e.id]: v } : p))} label={`Email: ${e.label}`} />
            <Box checked={false} disabled label="Slack alerts are coming soon" />
            <Box checked={false} disabled label="In-app alerts are coming soon" />
          </div>
        ))}
        <p className="border-t border-line px-5 py-3.5 text-[13px] text-ink-2">Slack and in-app alerts are coming soon. Emails go to the address on your login.</p>
      </Card>

      {data.recent.length > 0 && (
        <Card padded={false} className="flex flex-col gap-2 px-5 py-4">
          <span className="text-sm font-semibold">Recently sent to you</span>
          <ul className="flex flex-col gap-1.5 text-[13px]">
            {data.recent.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <Pill tone={r.status === "sent" ? "pos" : "neg"}>{r.status === "sent" ? "Sent" : "Didn't send"}</Pill>
                <span>{EVENT_LABEL[r.event] ?? r.event}</span>
                <span className="text-ink-3">{timeAgo(r.createdAt)}</span>
                {r.error && <span className="w-full text-xs text-neg">{r.error}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
