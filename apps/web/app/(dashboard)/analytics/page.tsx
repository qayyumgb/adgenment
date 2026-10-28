"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown, Download, Share2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { Platform } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { Button, ButtonLink, EmptyState, KpiCard, Menu, MenuItem, PlatformBadge, Segmented, PLATFORM_META, type PlatformKey } from "@/components/app/ui";
import { dayLabel } from "@/components/app/campaign/metrics";
import { ExportDialog } from "@/components/app/export/ExportDialog";
import { ShareDialog } from "@/components/app/portal/ShareDialog";
import { ScheduleDialog } from "@/components/app/portal/ScheduleDialog";
import { analyticsExport } from "@/components/app/analytics/export";
import { TrendChart, type TrendPoint } from "@/components/app/analytics/TrendChart";
import { SharePanel, type ShareEntry } from "@/components/app/analytics/SharePanel";
import { Funnel } from "@/components/app/analytics/Funnel";
import { AdvertixRead } from "@/components/app/analytics/AdvertixRead";
import { BreakdownGrid, type BreakdownBy, type BreakdownRow } from "@/components/app/analytics/BreakdownGrid";

/**
 * Analytics (guide §5.7, plan A10; absorbs /insights): 5 clickable KPI cards
 * drive the trend line, previous-period compare, share by platform / client,
 * funnel, Advertix read (insights), breakdown by platform / client /
 * campaign, CSV export. Follows the client switcher.
 */

type Range = 7 | 30 | 90;
type Metric = "spend" | "revenue" | "roas" | "conversions" | "cpa" | "impressions" | "clicks";
type Totals = { spend: number; revenue: number; conversions: number; impressions: number; clicks: number };

const METRIC_LABEL: Record<Metric, string> = {
  spend: "Spend",
  revenue: "Revenue",
  roas: "ROAS",
  conversions: "Conversions",
  cpa: "Cost / conversion",
  impressions: "Impressions",
  clicks: "Clicks",
};
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K` : Math.round(n).toLocaleString("en-US"));

function totalOf(m: Metric, t: Totals): number | null {
  if (m === "roas") return t.spend > 0 && t.revenue > 0 ? t.revenue / t.spend : null;
  if (m === "cpa") return t.conversions > 0 ? t.spend / t.conversions : null;
  return t[m];
}

const pct = (c: number | null, p: number | null) => (c === null || p === null || p === 0 ? null : ((c - p) / p) * 100);

function lastDays(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, k) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (n - 1 - k))).toISOString().slice(0, 10)
  );
}

export default function AnalyticsPage() {
  const { clientId, client, hasMultiple } = useClientScope();
  const [range, setRange] = useState<Range>(30);
  const [metric, setMetric] = useState<Metric>("spend");
  const [compare, setCompare] = useState(true);
  const [shareBy, setShareBy] = useState<"platform" | "client">("platform");
  const [by, setBy] = useState<BreakdownBy>("platform");
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const accounts = useApi((c) => c.getAdAccounts(), [], { key: "ad-accounts" });
  const overview = useApi((c) => c.getAnalyticsOverview(range, undefined, clientId), [range, clientId], { key: "analytics-overview" });
  const ts = useApi((c) => c.getTimeseries(range, metric, undefined, clientId, "previous"), [range, metric, clientId], { key: "analytics-ts" });
  const platforms = useApi((c) => c.getPlatformBreakdown(range, clientId), [range, clientId], { key: "analytics-platforms" });
  const clientsOn = hasMultiple && !clientId;
  const byClient = useApi((c) => (clientsOn ? c.getAnalyticsByClient(range) : Promise.resolve([])), [range, clientsOn], { key: "analytics-by-client" });
  const campaigns = useApi((c) => c.getAnalyticsCampaigns({ days: range, clientId: clientId ?? undefined, limit: 100, sortBy: "spend", sortOrder: "desc" }), [range, clientId], {
    key: "analytics-campaigns",
  });

  const scoped = (accounts.data ?? []).filter((a) => a.isActive && (!clientId || a.clientId === clientId));
  const currencies = Array.from(new Set(scoped.map((a) => a.currency).filter((c): c is string => !!c)));
  const currency = currencies[0] ?? null;

  const fmt = (m: Metric) => (v: number) =>
    m === "roas" ? `${v.toFixed(2)}x` : m === "cpa" ? fmtMoney(v, currency) : m === "spend" || m === "revenue" ? fmtMoney(v, currency, { whole: true }) : compact(v);
  const axisFmt = (m: Metric) => (v: number) => (m === "spend" || m === "revenue" || m === "cpa" ? fmtMoney(v, currency, { compact: v >= 1000, whole: v < 1000 }) : fmt(m)(v));

  const o = overview.data;
  const cur: Totals | null = o ? { spend: o.spend, revenue: o.revenue, conversions: o.conversions, impressions: o.impressions, clicks: o.clicks } : null;
  const prev: Totals | null = o?.previous ?? null;
  const hadPrev = !!prev && (prev.spend > 0 || prev.impressions > 0);
  const delta = (m: Metric) => (!cur || !hadPrev ? undefined : m === "roas" ? (totalOf(m, cur) !== null && totalOf(m, prev!) !== null ? totalOf(m, cur)! - totalOf(m, prev!)! : null) : pct(totalOf(m, cur), totalOf(m, prev!)));

  const points: TrendPoint[] = useMemo(() => {
    const byDate = new Map((ts.data ?? []).map((p) => [p.date, p]));
    return lastDays(range).map((date) => {
      const p = byDate.get(date);
      // No metric row = no delivery that day: 0 for totals, a gap for ratios.
      const ratio = metric === "roas" || metric === "cpa";
      return { date, value: p ? p.value : ratio ? null : 0, previous: p ? p.previous ?? null : null };
    });
  }, [ts.data, range, metric]);

  const shareMetric: "spend" | "revenue" | "conversions" | "impressions" | "clicks" = metric === "roas" || metric === "cpa" ? "spend" : metric;
  const shareEntries: ShareEntry[] =
    shareBy === "client" && clientsOn
      ? (byClient.data ?? []).map((b) => ({ key: b.clientId ?? "none", label: b.clientId ? b.name : "Not assigned", value: b[shareMetric] }))
      : (platforms.data ?? []).map((p) => ({
          key: p.platform,
          label: PLATFORM_META[p.platform as PlatformKey]?.name ?? p.platform,
          icon: <PlatformBadge platform={p.platform as PlatformKey} size={20} />,
          value: p[shareMetric],
        }));

  const rows: BreakdownRow[] =
    by === "client" && clientsOn
      ? (byClient.data ?? []).map((b) => ({ id: b.clientId ?? "none", name: b.clientId ? b.name : "Not assigned", spend: b.spend, revenue: b.revenue, conversions: b.conversions, impressions: b.impressions, clicks: b.clicks }))
      : by === "campaign"
        ? (campaigns.data?.campaigns ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            sub: PLATFORM_META[c.platform as PlatformKey]?.name,
            icon: <PlatformBadge platform={c.platform as PlatformKey} size={20} />,
            href: `/campaigns/${c.id}`,
            spend: c.spend,
            revenue: c.revenue,
            conversions: c.conversions,
            impressions: c.impressions,
            clicks: c.clicks,
          }))
        : (platforms.data ?? []).map((p) => ({
            id: p.platform,
            name: PLATFORM_META[p.platform as PlatformKey]?.name ?? p.platform,
            icon: <PlatformBadge platform={p.platform as Platform as PlatformKey} size={22} />,
            spend: p.spend,
            revenue: p.revenue,
            conversions: p.conversions,
            impressions: p.impressions,
            clicks: p.clicks,
          }));
  const rowsLoading = by === "campaign" ? campaigns.loading : by === "client" ? byClient.loading : platforms.loading;
  const byOptions: { value: BreakdownBy; label: string }[] = [
    { value: "platform", label: "Platform" },
    ...(clientsOn ? [{ value: "client" as const, label: "Client" }] : []),
    { value: "campaign", label: "Campaign" },
  ];
  const effectiveBy: BreakdownBy = by === "client" && !clientsOn ? "platform" : by;

  const days = lastDays(range);
  const period = `${dayLabel(days[0])} – ${dayLabel(days[days.length - 1])}`;
  const scopeTitle = client ? client.name : hasMultiple ? "All clients" : "All accounts";
  const loading = overview.loading;
  const noData = !loading && !overview.error && cur !== null && cur.spend === 0 && cur.impressions === 0;
  const chartTotal = cur ? totalOf(metric, cur) : null;
  const chartPrev = prev && hadPrev ? totalOf(metric, prev) : null;
  const sumWord = metric === "roas" || metric === "cpa" ? "overall" : "total";

  const byLabel = effectiveBy === "platform" ? "Platform" : effectiveBy === "client" ? "Client" : "Campaign";
  const exportData = exportOpen ? analyticsExport({ byLabel, rows, period, current: cur, previous: hadPrev ? prev : null }) : null;

  return (
    <>
      <PageHeader
        kicker={`${scopeTitle} · reporting`}
        title="Analytics"
        summary={`${period}${compare ? `, compared with the ${range} days before` : ""}${currencies.length > 1 ? ` · totals mix ${currencies.join(", ")}` : ""}`}
        actions={
          <>
            <Segmented
              label="Date range"
              value={range}
              onChange={setRange}
              options={[
                { value: 7, label: "7 days" },
                { value: 30, label: "30 days" },
                { value: 90, label: "90 days" },
              ]}
            />
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => setExportOpen(true)} disabled={rowsLoading || rows.length === 0} title="Download the breakdown below as CSV or Excel">
              Export
            </Button>
            <Button variant="secondary" icon={<Share2 size={16} />} onClick={() => setShareOpen(true)} title="A read-only link for your client, no login needed">
              Share report
            </Button>
            <Button variant="secondary" icon={<CalendarClock size={16} />} onClick={() => setScheduleOpen(true)} title="Email your client their numbers every week or month">
              Schedule report
            </Button>
          </>
        }
      />
      <PageBody className="gap-5">
        {noData ? (
          <EmptyState
            title="No analytics data yet"
            body="Connect an ad account and sync your campaigns. Spend, results and trends show up here after the first sync."
            action={<ButtonLink href="/connections" variant="secondary">Connect an ad account</ButtonLink>}
          />
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
              {(["spend", "revenue", "roas", "conversions", "cpa"] as Metric[]).map((m) => (
                <KpiCard
                  key={m}
                  label={METRIC_LABEL[m]}
                  loading={loading}
                  value={cur && totalOf(m, cur) !== null && (m !== "revenue" || cur.revenue > 0) ? fmt(m)(totalOf(m, cur)!) : "—"}
                  delta={delta(m)}
                  deltaFormat={m === "roas" ? (v) => Math.abs(v).toFixed(2) : undefined}
                  higherIsBetter={m !== "cpa"}
                  selected={metric === m}
                  onClick={() => setMetric(m)}
                />
              ))}
            </div>
            {overview.error && (
              <p role="alert" className="-mt-2 text-sm text-neg">
                Couldn’t load totals.{" "}
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void overview.refetch()}>
                  Try again
                </button>
              </p>
            )}

            <div className="flex flex-wrap items-start gap-4">
              <TrendChart
                className="min-w-0 flex-[1.8_1_560px]"
                title={`${METRIC_LABEL[metric]} by day`}
                points={points}
                format={axisFmt(metric)}
                compare={compare}
                onCompareChange={setCompare}
                compareLabel={`Compare to previous ${range} days`}
                loading={ts.loading}
                summary={
                  <>
                    <span className="font-semibold text-ink">Last {range} days</span> · {sumWord} {chartTotal === null ? "—" : fmt(metric)(chartTotal)}
                    {compare && <> · previous {chartPrev === null ? "no data" : fmt(metric)(chartPrev)}</>}
                  </>
                }
                headerExtra={
                  <Menu
                    align="end"
                    width={200}
                    trigger={(p) => (
                      <Button {...p} variant="secondary" size="toolbar" className={`px-3 text-[13px] ${p.className}`}>
                        More metrics <ChevronDown size={14} />
                      </Button>
                    )}
                  >
                    {(close) =>
                      (["impressions", "clicks"] as Metric[]).map((m) => (
                        <MenuItem key={m} selected={metric === m} onSelect={() => (setMetric(m), close())}>
                          {METRIC_LABEL[m]}
                        </MenuItem>
                      ))
                    }
                  </Menu>
                }
              />
              <div className="min-w-0 flex-[1_1_300px]">
                <SharePanel
                  metricLabel={METRIC_LABEL[shareMetric].toLowerCase()}
                  entries={shareEntries}
                  format={fmt(shareMetric)}
                  by={clientsOn ? shareBy : "platform"}
                  byOptions={clientsOn ? [{ value: "platform", label: "Platform" }, { value: "client", label: "Client" }] : [{ value: "platform", label: "Platform" }]}
                  onByChange={setShareBy}
                  loading={platforms.loading || (shareBy === "client" && byClient.loading)}
                />
              </div>
            </div>

            <Funnel impressions={cur?.impressions ?? 0} clicks={cur?.clicks ?? 0} conversions={cur?.conversions ?? 0} adLevel={o?.adLevel ?? null} scopeLabel={scopeTitle} loading={loading} />

            <AdvertixRead />

            <BreakdownGrid
              by={effectiveBy}
              byOptions={byOptions}
              onByChange={setBy}
              rows={rows}
              currency={currency}
              loading={rowsLoading}
              note={effectiveBy === "campaign" && (campaigns.data?.total ?? 0) > 100 ? `Top 100 of ${campaigns.data?.total} by spend` : undefined}
            />
          </>
        )}
      </PageBody>
      {exportData && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          sub={`${rows.length} ${byLabel.toLowerCase()}${rows.length === 1 ? "" : "s"} · ${period}${currencies.length > 1 ? ` · totals mix ${currencies.join(", ")}` : ""}`}
          filename={`advertix-analytics-${effectiveBy}-${range}d-${days[days.length - 1]}`}
          {...exportData}
        />
      )}
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onShare={() => (setScheduleOpen(false), setShareOpen(true))} />
    </>
  );
}
