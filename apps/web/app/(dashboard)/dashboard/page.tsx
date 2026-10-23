"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Download, Plus, Sparkles } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { AnalyticsOverview, TimeseriesPoint } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import ConnectModal from "@/components/connect/ConnectModal";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { Button, ButtonLink, Card, KpiCard } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { SpendRevenueChart, type DayPoint } from "@/components/app/overview/SpendRevenueChart";
import { OverviewSuggestions } from "@/components/app/overview/OverviewSuggestions";
import { ClientsPacingTable } from "@/components/app/overview/ClientsPacingTable";

/**
 * Overview (guide §5.1, plan A4): greeting, 5 KPI cards (last 30 days vs the
 * 30 before), spend & revenue chart, Advertix suggests, client pacing table.
 * Everything follows the client switcher.
 */

const DAYS = 30;
const SPARK_DAYS = 14;

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Working late";
}

/** Last `n` UTC calendar days, oldest first, as YYYY-MM-DD. */
function lastDays(n: number) {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - i));
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

const pct = (c: number, p: number) => (p > 0 ? ((c - p) / p) * 100 : null);

/** KPI deltas from the previous-period totals; falls back to the API's % changes on older API builds. */
function kpiDeltas(o: AnalyticsOverview) {
  const p = o.previous;
  if (!p) {
    return { spend: o.changes.spend, revenue: o.changes.revenue, roas: null, conversions: o.changes.conversions, cpa: null };
  }
  const prevRoas = p.spend > 0 ? p.revenue / p.spend : null;
  const cpa = o.conversions > 0 ? o.spend / o.conversions : null;
  const prevCpa = p.conversions > 0 ? p.spend / p.conversions : null;
  return {
    spend: pct(o.spend, p.spend),
    revenue: pct(o.revenue, p.revenue),
    roas: prevRoas !== null && o.spend > 0 ? o.roas - prevRoas : null,
    conversions: pct(o.conversions, p.conversions),
    cpa: cpa !== null && prevCpa !== null ? pct(cpa, prevCpa) : null,
  };
}

export default function OverviewPage() {
  const { user } = useUser();
  const { clientId, client, clients, hasMultiple } = useClientScope();
  const [connectOpen, setConnectOpen] = useState(false);
  const access = useAccess();

  const me = useApi((c) => c.getMe(), [], { key: "me" });
  const accounts = useApi((c) => c.getAdAccounts(), [], { key: "ad-accounts" });
  const overview = useApi((c) => c.getAnalyticsOverview(DAYS, undefined, clientId), [clientId], { key: "overview" });
  const spendTs = useApi((c) => c.getTimeseries(DAYS, "spend", undefined, clientId), [clientId], { key: "ts-spend" });
  const revenueTs = useApi((c) => c.getTimeseries(DAYS, "revenue", undefined, clientId), [clientId], { key: "ts-revenue" });
  const convTs = useApi((c) => c.getTimeseries(DAYS, "conversions", undefined, clientId), [clientId], { key: "ts-conversions" });
  const live = useApi((c) => c.getCampaigns({ status: "ACTIVE", limit: 1, clientId: clientId ?? undefined }), [clientId], {
    key: "campaigns-live-count",
  });

  // Accounts in scope decide the display currency.
  const scopedAccounts = (accounts.data ?? []).filter((a) => a.isActive && (!clientId || a.clientId === clientId));
  const currencies = Array.from(new Set(scopedAccounts.map((a) => a.currency).filter((c): c is string => !!c)));
  const currency = currencies[0] ?? null;
  const lastSync = scopedAccounts
    .map((a) => a.lastSyncedAt)
    .filter((t): t is string => !!t)
    .sort()
    .pop();

  const days = useMemo<DayPoint[]>(() => {
    const index = (pts: TimeseriesPoint[] | null) => new Map((pts ?? []).map((p) => [p.date, p.value]));
    const s = index(spendTs.data);
    const r = index(revenueTs.data);
    return lastDays(DAYS).map((date) => ({ date, spend: s.get(date) ?? 0, revenue: r.get(date) ?? 0 }));
  }, [spendTs.data, revenueTs.data]);

  const sparks = useMemo(() => {
    const conv = new Map((convTs.data ?? []).map((p) => [p.date, p.value]));
    const recent = days.slice(-SPARK_DAYS).map((d) => ({ ...d, conv: conv.get(d.date) ?? 0 }));
    return {
      spend: recent.map((d) => d.spend),
      revenue: recent.map((d) => d.revenue),
      roas: recent.map((d) => (d.spend > 0 ? d.revenue / d.spend : 0)),
      conversions: recent.map((d) => d.conv),
      cpa: recent.map((d) => (d.conv > 0 ? d.spend / d.conv : 0)),
    };
  }, [days, convTs.data]);

  const o = overview.data;
  const deltas = o ? kpiDeltas(o) : null;
  const money = (n: number) => fmtMoney(n, currency, { whole: true });
  const kpiLoading = overview.loading;
  const seriesLoading = spendTs.loading || revenueTs.loading;

  const noAccounts = !accounts.loading && !accounts.error && (accounts.data ?? []).filter((a) => a.isActive).length === 0;
  const firstName = user?.firstName ?? me.data?.user?.name?.split(" ")[0];
  const now = new Date();
  const scopeTitle = client ? client.name : hasMultiple ? "All clients" : me.data?.workspace?.name ?? "Your workspace";
  const liveCount = live.data?.total;
  const summary = [
    client?.vertical,
    !client && hasMultiple ? `${clients.length} clients` : null,
    liveCount !== undefined ? `${liveCount} campaign${liveCount === 1 ? "" : "s"} live` : null,
    client
      ? `${client.platforms.length} platform${client.platforms.length === 1 ? "" : "s"}`
      : scopedAccounts.length
        ? `${scopedAccounts.length} ad account${scopedAccounts.length === 1 ? "" : "s"}${lastSync ? ` synced ${timeAgo(lastSync)}` : ""}`
        : null,
    currencies.length > 1 ? `totals mix ${currencies.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        kicker={
          <span suppressHydrationWarning>
            {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} · {scopeTitle}
          </span>
        }
        title={
          <span suppressHydrationWarning>
            {greeting(now)}
            {firstName ? `, ${firstName}` : ""}
          </span>
        }
        summary={summary || undefined}
        actions={
          <>
            {/* TODO(D6): report export. Visibly unavailable until then. */}
            <Button variant="secondary" icon={<Download size={16} />} disabled title="Report export is coming soon">
              Export report
            </Button>
            {access.can("edit") ? (
              <ButtonLink href="/campaigns/new" variant="primary" icon={<Plus size={16} strokeWidth={2.5} />}>
                New campaign
              </ButtonLink>
            ) : (
              <Button variant="primary" icon={<Plus size={16} strokeWidth={2.5} />} disabled title={access.why("edit")}>
                New campaign
              </Button>
            )}
          </>
        }
      />
      <PageBody>
        {noAccounts ? (
          <Card className="flex flex-col items-start gap-3 p-8">
            <span className="text-lg font-semibold">Welcome to Advertix{firstName ? `, ${firstName}` : ""}</span>
            <span className="max-w-xl text-ink-2">
              Connect your first ad account to sync campaigns. Spend, revenue and Advertix suggestions show up here after the first sync.
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setConnectOpen(true)}>
                Connect an ad account
              </Button>
              <ButtonLink href="/ai-planner" variant="secondary" icon={<Sparkles size={16} />}>
                Plan a campaign with AI
              </ButtonLink>
            </div>
            <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
              <KpiCard label="Spend" loading={kpiLoading} value={o ? money(o.spend) : "—"} delta={deltas?.spend} spark={sparks.spend} />
              <KpiCard label="Revenue" loading={kpiLoading} value={o ? money(o.revenue) : "—"} delta={deltas?.revenue} spark={sparks.revenue} />
              <KpiCard
                label="ROAS"
                loading={kpiLoading}
                value={o && o.spend > 0 ? `${o.roas.toFixed(2)}x` : "—"}
                delta={deltas?.roas}
                deltaFormat={(v) => Math.abs(v).toFixed(2)}
                spark={sparks.roas}
              />
              <KpiCard
                label="Conversions"
                loading={kpiLoading}
                value={o ? o.conversions.toLocaleString("en-US") : "—"}
                delta={deltas?.conversions}
                spark={sparks.conversions}
              />
              <KpiCard
                label="Cost / conversion"
                loading={kpiLoading}
                value={o && o.conversions > 0 ? fmtMoney(o.spend / o.conversions, currency) : "—"}
                delta={deltas?.cpa}
                higherIsBetter={false}
                spark={sparks.cpa}
              />
            </div>
            {overview.error && (
              <p role="alert" className="-mt-2 text-sm text-neg">
                Couldn’t load the last 30 days.{" "}
                <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void overview.refetch()}>
                  Try again
                </button>
              </p>
            )}

            <div className="flex flex-wrap items-start gap-4">
              <SpendRevenueChart days={days} currency={currency} loading={seriesLoading} className="min-w-0 flex-[1.7_1_520px]" />
              <div className="min-w-0 flex-[1_1_300px]">
                <OverviewSuggestions />
              </div>
            </div>

            {hasMultiple && !clientId && <ClientsPacingTable currency={currency} />}
          </>
        )}
      </PageBody>
    </>
  );
}
