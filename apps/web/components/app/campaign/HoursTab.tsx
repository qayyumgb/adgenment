"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Clock, Sparkles, Undo2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { ApprovalPendingError, useApiClient, type Campaign, type CampaignHours, type HoursRecommendation } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { useAccess } from "@/components/app/team/access";
import { Button, Card, CardHeader, EmptyState, Skeleton, Toggle } from "@/components/app/ui";
import { HoursHeatmap, hh } from "@/components/app/hours/HoursHeatmap";
import { PlatformCaps } from "@/components/app/hours/PlatformCaps";

/**
 * Hours (plan C7, the mockup's F6): when this campaign converts cheaply, by
 * weekday and hour, and what to change. Suggestions start after 14 days and
 * 300 conversions; every change goes through Approvals and can be undone.
 */

export const resultWord = (platform: string, metric: "conversion" | "click") => (metric === "click" ? "click" : platform === "META" ? "purchase" : "conversion");

export function recTitle(platform: string, r: HoursRecommendation) {
  const range = `${hh(r.from)}–${hh(r.to)}`;
  if (platform === "GOOGLE") return `Lower bids ${Math.abs(r.bidAdjustment)}% from ${hh(r.from)} to ${hh(r.to)}`;
  if (platform === "TIKTOK") return `Pause ${range} in dayparting`;
  return `Switch off ${range}`;
}

export function recWhy(r: HoursRecommendation, word: string) {
  const range = `${hh(r.from)}–${hh(r.to)}`;
  const cost = r.pctMore >= 999 ? `bring no ${word}s for their spend` : `cost ${r.pctMore}% more per ${word} than average`;
  return `${range} ${cost}, and take ${Math.round(r.spendShare * 100)}% of the spend for ${Math.round(r.conversionShare * 100)}% of the ${word}s.`;
}

function Progress({ label, value, need }: { label: string; value: number; need: number }) {
  const pct = Math.min(100, Math.round((value / need) * 100));
  return (
    <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
      <span className="flex justify-between text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-ink-2">
          {value.toLocaleString()} / {need.toLocaleString()}
        </span>
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemax={need}>
        <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-pos" : "bg-brand")} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function HoursTab({ campaign: c }: { campaign: Campaign }) {
  const api = useApiClient();
  const canEdit = useAccess().can("edit");
  const q = useApi((x) => x.getCampaignHours(c.id), [c.id], { key: "campaign-hours" });
  const [busy, setBusy] = useState<"apply" | "undo" | "toggle" | null>(null);
  const [waiting, setWaiting] = useState(false);
  const d = q.data;

  if (q.loading && !d) return <Skeleton className="h-96 rounded-card" />;
  if (!d) return <EmptyState title="Hours didn't load" body={q.error ?? undefined} action={<Button variant="secondary" size="sm" onClick={() => void q.refetch()}>Try again</Button>} />;

  const word = resultWord(d.platform, d.metric);
  const hasData = d.total.spend > 0;
  const r = d.recommendation;
  // Applied in the last 7 days (Undo still possible).
  const applied = d.suggestion?.status === "APPLIED" ? d.suggestion : null;
  const zone = d.timezone ? d.timezone.replace(/_/g, " ") : "the account's time zone";

  const apply = async () => {
    setBusy("apply");
    try {
      const { suggestionId } = await api.suggestHours(c.id);
      await api.applySuggestion(suggestionId);
      toast.success(`${recTitle(d.platform, r!)}: done on Meta. You can undo it for 7 days.`);
      await q.refetch();
    } catch (err) {
      if (err instanceof ApprovalPendingError) setWaiting(true);
      else toast.error(err instanceof Error ? err.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };
  const undo = async () => {
    if (!applied) return;
    setBusy("undo");
    try {
      await api.undoSuggestion(applied.id);
      toast.success("Back to the hours it ran before");
      await q.refetch();
    } catch (err) {
      if (!(err instanceof ApprovalPendingError)) toast.error(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setBusy(null);
    }
  };
  const toggle = async (on: boolean) => {
    setBusy("toggle");
    try {
      await api.setSmartHours(c.id, on);
      toast.success(on ? "Smart hours is on for this campaign" : "Smart hours is off");
      await q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change it");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-5">
        <CardHeader
          title="When does it convert cheaply?"
          sub={
            hasData
              ? `Cost per ${word} by hour and weekday · last ${d.windowDays} days · ${Math.round(d.metric === "click" ? d.total.clicks : d.total.conversions).toLocaleString()} ${word}s · ${zone}${d.syncedAt ? ` · updated ${timeAgo(d.syncedAt)}` : ""}`
              : undefined
          }
        />
        {!hasData ? (
          <EmptyState
            icon={<Clock size={20} />}
            title={d.platform === "LINKEDIN" || d.platform === "SNAPCHAT" ? "This platform only takes dates" : d.eligible.days === 0 ? "Nothing to read yet" : "No hour-by-hour data yet"}
            body={
              d.platform === "LINKEDIN" || d.platform === "SNAPCHAT"
                ? "There's no hourly report to read here."
                : d.eligible.days === 0
                  ? "This campaign hasn't spent in the last 45 days, so there are no hours to compare. Once it runs, Advertix pulls its hourly report once a day."
                  : "Advertix pulls each ad account's hourly report once a day. The first one arrives within a day of the campaign spending."
            }
          />
        ) : (
          <>
            {!d.eligible.ok && (
              <div className="flex flex-col gap-3 rounded-xl bg-surface-2 px-4 py-3.5">
                <span className="text-[13px] text-ink-2">
                  Advertix suggests hour changes once it has <strong className="text-ink">{d.eligible.needDays} days</strong> with spend and <strong className="text-ink">{d.eligible.needConversions} {word === "click" ? "conversion" : word}s</strong>, so the pattern is real and not noise. Until then the heatmap is for reading.
                </span>
                <div className="flex flex-wrap gap-4">
                  <Progress label="Days with spend" value={d.eligible.days} need={d.eligible.needDays} />
                  <Progress label={`${word === "click" ? "Conversion" : word[0].toUpperCase() + word.slice(1)}s`} value={d.eligible.conversions} need={d.eligible.needConversions} />
                </div>
              </div>
            )}
            <HoursHeatmap cells={d.cells} hours={d.hours} metric={d.metric} currency={d.currency} resultWord={word} highlight={r} />
          </>
        )}
      </Card>

      {hasData && d.eligible.ok && (
        <div className="flex flex-wrap gap-4">
          <Card className="flex min-w-0 flex-[1.4_1_360px] flex-col gap-2.5 border-brand/20 bg-brand-soft">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
              <Sparkles size={13} aria-hidden="true" /> Advertix suggests
            </span>
            {r ? (
              <>
                <span className="text-base font-semibold leading-snug">{recTitle(d.platform, r)}</span>
                <span className="text-[13px] text-ink-2 [text-wrap:pretty]">{recWhy(r, word)}</span>
                {applied ? (
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="text-[13px] font-semibold text-pos">Applied {applied.appliedAt ? timeAgo(applied.appliedAt) : ""} · {applied.title}</span>
                    {canEdit && (
                      <Button variant="ghost" size="sm" icon={<Undo2 size={14} />} loading={busy === "undo"} onClick={() => void undo()}>
                        Undo
                      </Button>
                    )}
                  </div>
                ) : waiting ? (
                  <span className="mt-1 text-[13px] font-semibold text-brand-ink">⏳ Sent to Approvals · it goes live once an owner approves (Activity).</span>
                ) : d.apply.mode === "one-click" ? (
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    {canEdit && (
                      <Button variant="primary" size="sm" loading={busy === "apply"} onClick={() => void apply()}>
                        {d.apply.label}
                      </Button>
                    )}
                    <span className="flex-1" />
                    {r.savedPerWeek >= 1 && <span className="text-[13px] font-semibold text-pos">≈ {fmtMoney(r.savedPerWeek, d.currency, { whole: true })} / week saved</span>}
                  </div>
                ) : d.apply.mode === "manual" ? (
                  <div className="mt-1 flex flex-col gap-2">
                    <span className="text-[13px] text-ink-2">{d.apply.reason} Here&apos;s how to do it yourself:</span>
                    <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-[13px]">
                      {d.apply.steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                    {r.savedPerWeek >= 1 && <span className="text-[13px] font-semibold text-pos">≈ {fmtMoney(r.savedPerWeek, d.currency, { whole: true })} / week saved</span>}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <span className="text-base font-semibold leading-snug">Keep it running around the clock</span>
                <span className="text-[13px] text-ink-2 [text-wrap:pretty]">
                  No run of hours costs 40%+ more per {word} than average with enough spend to be sure. Cutting hours would shrink how much the platform can learn from, for little saving.
                </span>
              </>
            )}
          </Card>
          <PlatformCaps className="flex-[1_1_260px]" />
        </div>
      )}

      <Card className="flex items-start gap-4">
        <Toggle checked={d.smartHours} onChange={(v) => void toggle(v)} disabled={!canEdit || busy === "toggle"} label="Smart hours" className="mt-0.5" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold">Smart hours</span>
          <span className="text-[13px] text-ink-2 [text-wrap:pretty]">
            Advertix checks this campaign&apos;s hours every day. Once it has 14 days and 300 {word === "click" ? "conversion" : word}s, it suggests switching off hours that cost 40%+ more than average, in your suggestions and the morning briefing. Each change goes to Approvals first and can be undone.
          </span>
          {c.platform === "META" && c.budgetType !== "LIFETIME" && (
            <span className="text-xs font-medium text-warn">Meta allows hour schedules only on a total (lifetime) budget. With this daily budget you&apos;ll get the steps to do it in Ads Manager instead of one click.</span>
          )}
        </div>
      </Card>
    </div>
  );
}
