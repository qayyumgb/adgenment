"use client";

import { useAppRouter } from "@/hooks/useAppRouter";
import { useApi } from "@/hooks/useApi";
import type { Campaign } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { DataGrid, type GridColumn } from "@/components/app/grid";
import { AiMark, AiNote, AiSuggestion, Card, EmptyState, KpiCard, Skeleton } from "@/components/app/ui";
import { suggestionState, useSuggestions } from "@/components/app/suggestions/useSuggestions";
import { AskCampaign } from "./AskCampaign";
import { DailyMetricChart, type ChartMarker } from "./DailyMetricChart";
import { cpa, ctr, dayLabel, pct, roas, sum, type Day, type Totals } from "./metrics";

/**
 * Plain observations from the campaign's own numbers (carried over from the
 * old detail page). No AI call; they only say what the data shows.
 */
function observations(c: Campaign, t: Totals, days: Day[], currency: string | null): string[] {
  const out: string[] = [];
  const money = (n: number) => fmtMoney(n, currency);
  const withData = days.filter((d) => d.spend > 0).length;
  if (t.spend > 0 && t.conversions === 0) {
    out.push(
      `${money(t.spend)} spent with no conversions recorded over ${withData} day${withData === 1 ? "" : "s"}. Either the offer isn't landing or the pixel isn't recording the conversion event — check Events Manager before changing the budget.`
    );
  }
  const r = ctr(t);
  if (r !== null && r > 0 && r < 1) {
    out.push(
      `CTR is ${r.toFixed(2)}% (${t.clicks.toLocaleString("en-US")} clicks from ${t.impressions.toLocaleString("en-US")} impressions), under 1% for feed ads. The creative is usually the lever here: try a new opening line or image.`
    );
  }
  const budget = Number(c.budget) || 0;
  const latest = [...days].reverse().find((d) => d.spend > 0);
  if (budget > 0 && c.budgetType === "DAILY" && latest && latest.spend / budget > 0.9) {
    out.push(`${dayLabel(latest.date)} used ${money(latest.spend)} of the ${money(budget)} daily budget, so delivery is being capped — there may be more demand than the budget allows.`);
  }
  if (budget > 0 && c.budgetType === "LIFETIME" && t.spend / budget > 0.9) {
    out.push(`${money(t.spend)} of the ${money(budget)} lifetime budget is used. Delivery stops when it runs out.`);
  }
  return out.slice(0, 3);
}

function CampaignSuggestions({ campaignId, onChanged }: { campaignId: string; onChanged: () => void }) {
  const router = useAppRouter();
  const sg = useSuggestions({ clientId: null, campaignId, onChanged });
  const open = sg.list.filter((s) => s.status === "OPEN").length;
  return (
    <Card padded={false} className="flex flex-col gap-2.5 px-5 pb-2 pt-5">
      <div className="flex items-center gap-2.5">
        <AiMark size={32} />
        <span className="flex flex-1 flex-col leading-tight">
          <span className="text-base font-semibold">Advertix suggests</span>
          <span className="text-xs text-ink-2">{sg.loading ? "Loading…" : `${open} open`}</span>
        </span>
      </div>
      {sg.loading ? (
        <Skeleton className="mb-3 h-24" />
      ) : sg.list.length === 0 ? (
        <div className="mb-3 rounded-xl bg-surface-2 p-4 text-sm text-ink-2">Nothing to change on this campaign right now.</div>
      ) : (
        <div className="pb-1">
          {sg.list.map((s) => (
            <AiSuggestion
              key={s.id}
              kind={s.kind}
              title={s.title}
              reason={s.reason}
              impact={s.impact ?? undefined}
              actionLabel={s.actionLabel}
              doneLabel={s.doneLabel ?? undefined}
              mode={s.executable ? "apply" : "review"}
              state={suggestionState(s)}
              busy={sg.busy === s.id}
              onApply={() => void sg.apply(s)}
              // Review on this campaign means "change it yourself": open Settings.
              onReview={() =>
                router.push(!s.reviewHref || s.reviewHref.startsWith(`/campaigns/${campaignId}`) ? `/campaigns/${campaignId}?tab=settings` : s.reviewHref)
              }
              onSnooze={() => void sg.snooze(s)}
              onUndo={sg.canUndo(s) ? () => void sg.undo(s) : undefined}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

export function OverviewTab({
  campaign: c,
  current,
  previous,
  loading,
  onChanged,
}: {
  campaign: Campaign;
  /** Last 30 days, oldest first. */
  current: Day[];
  /** The 30 days before that. */
  previous: Day[];
  loading: boolean;
  onChanged: () => void;
}) {
  const currency = c.adAccount?.currency ?? null;
  const t = sum(current);
  const p = sum(previous);
  const hasData = current.some((d) => d.spend > 0 || d.impressions > 0);
  const hadData = previous.some((d) => d.spend > 0 || d.impressions > 0);
  const money = (n: number) => fmtMoney(n, currency, { whole: n >= 1000 });
  const d = (cur: number | null, prev: number | null) => (hadData ? pct(cur, prev) : undefined);
  const notes = hasData ? observations(c, t, current, currency) : [];
  // Budget / status / publish events from the change log, as chart markers.
  const log = useApi((a) => a.getChangeLog({ campaignId: c.id, limit: 30 }), [c.id], { key: "change-log" });
  const markers: ChartMarker[] = (log.data?.entries ?? [])
    .filter((e) => !e.revertOfId && !e.undoneAt)
    .flatMap((e): ChartMarker[] => {
      const date = e.createdAt.slice(0, 10);
      if (e.action === "campaign.budget") {
        const b = Number(e.after?.budget);
        return Number.isFinite(b) ? [{ date, label: `Budget → ${fmtMoney(b, currency, { whole: true })}${e.after?.budgetType === "LIFETIME" ? "" : "/day"}` }] : [];
      }
      if (e.action === "campaign.status" && (e.after?.status === "PAUSED" || e.after?.status === "ACTIVE")) {
        return [{ date, label: e.after.status === "PAUSED" ? "Paused" : "Resumed" }];
      }
      if (e.action === "campaign.publish") return [{ date, label: "Published" }];
      return [];
    });

  const rows = [...current].reverse().filter((x) => x.spend > 0 || x.impressions > 0);
  const columns: GridColumn<Day>[] = [
    { id: "date", label: "Date", width: 110, grow: 1, sortValue: (x) => x.date, render: (x) => dayLabel(x.date) },
    { id: "spend", label: "Spend", width: 100, align: "right", sortValue: (x) => x.spend, render: (x) => fmtMoney(x.spend, currency), footer: fmtMoney(t.spend, currency) },
    { id: "revenue", label: "Revenue", width: 100, align: "right", sortValue: (x) => x.revenue, render: (x) => (x.revenue ? fmtMoney(x.revenue, currency) : "—"), footer: t.revenue ? fmtMoney(t.revenue, currency) : "—" },
    { id: "roas", label: "ROAS", width: 76, align: "right", sortValue: (x) => roas(x), render: (x) => (roas(x) === null ? "—" : `${roas(x)!.toFixed(2)}x`), footer: roas(t) === null ? "—" : `${roas(t)!.toFixed(2)}x` },
    { id: "conv", label: "Conversions", width: 96, align: "right", sortValue: (x) => x.conversions, render: (x) => x.conversions.toLocaleString("en-US"), footer: t.conversions.toLocaleString("en-US") },
    { id: "cpa", label: "Cost / conv.", width: 100, align: "right", sortValue: (x) => cpa(x), render: (x) => (cpa(x) === null ? "—" : fmtMoney(cpa(x)!, currency)), footer: cpa(t) === null ? "—" : fmtMoney(cpa(t)!, currency) },
    { id: "ctr", label: "CTR", width: 72, align: "right", sortValue: (x) => ctr(x), render: (x) => (ctr(x) === null ? "—" : `${ctr(x)!.toFixed(2)}%`), footer: ctr(t) === null ? "—" : `${ctr(t)!.toFixed(2)}%` },
    { id: "clicks", label: "Clicks", width: 80, align: "right", defaultHidden: true, sortValue: (x) => x.clicks, render: (x) => x.clicks.toLocaleString("en-US"), footer: t.clicks.toLocaleString("en-US") },
    { id: "impr", label: "Impressions", width: 104, align: "right", defaultHidden: true, sortValue: (x) => x.impressions, render: (x) => x.impressions.toLocaleString("en-US"), footer: t.impressions.toLocaleString("en-US") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <KpiCard label="Spend" loading={loading} value={hasData ? money(t.spend) : "—"} delta={d(t.spend, p.spend)} />
        <KpiCard label="Revenue" loading={loading} value={t.revenue ? money(t.revenue) : "—"} delta={d(t.revenue || null, p.revenue || null)} />
        <KpiCard
          label="ROAS"
          loading={loading}
          value={roas(t) === null ? "—" : `${roas(t)!.toFixed(2)}x`}
          delta={!hadData ? undefined : roas(t) !== null && roas(p) !== null ? roas(t)! - roas(p)! : null}
          deltaFormat={(v) => Math.abs(v).toFixed(2)}
        />
        <KpiCard label="Conversions" loading={loading} value={hasData ? t.conversions.toLocaleString("en-US") : "—"} delta={d(t.conversions, p.conversions)} />
        <KpiCard label="Cost / conversion" loading={loading} value={cpa(t) === null ? "—" : fmtMoney(cpa(t)!, currency)} delta={d(cpa(t), cpa(p))} higherIsBetter={false} />
        <KpiCard
          label="CTR"
          loading={loading}
          value={ctr(t) === null ? "—" : `${ctr(t)!.toFixed(2)}%`}
          delta={!hadData ? undefined : ctr(t) !== null && ctr(p) !== null ? ctr(t)! - ctr(p)! : null}
          deltaFormat={(v) => `${Math.abs(v).toFixed(2)} pts`}
        />
      </div>

      {!loading && !hasData && (
        <EmptyState
          title={c.externalId ? "No performance data yet" : "This campaign hasn’t run yet"}
          body={
            c.externalId
              ? "Platforms report results a few hours after delivery starts. Sync from the Campaigns page once it has been live for a day."
              : "Publish it and let it deliver. Spend, clicks and conversions show up here once the platform starts reporting."
          }
        />
      )}

      {notes.length > 0 && (
        <AiNote>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </AiNote>
      )}

      <div className="flex flex-wrap items-start gap-4">
        {(loading || hasData) && <DailyMetricChart days={current} currency={currency} markers={markers} loading={loading} className="min-w-0 flex-[1.6_1_520px]" />}
        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <CampaignSuggestions campaignId={c.id} onChanged={onChanged} />
          <AskCampaign campaignId={c.id} campaignName={c.name} />
        </aside>
      </div>

      {hasData && (
        <DataGrid
          tableId="campaign-daily"
          label="Daily breakdown"
          rows={rows}
          getRowId={(x) => x.date}
          columns={columns}
          defaultSort={{ id: "date", dir: "desc" }}
          defaultDensity="compact"
          footerLabel="Total"
          filters={
            <div className="mr-auto flex flex-col leading-tight">
              <span className="text-base font-semibold">Daily breakdown</span>
              <span className="text-[13px] text-ink-2">
                {rows.length} day{rows.length === 1 ? "" : "s"} with delivery in the last 30 days
              </span>
            </div>
          }
        />
      )}
    </div>
  );
}
