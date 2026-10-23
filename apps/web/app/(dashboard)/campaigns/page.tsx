"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppRouter } from "@/hooks/useAppRouter";
import { useAccess } from "@/components/app/team/access";
import toast from "react-hot-toast";
import { Download, Plus, RefreshCw } from "lucide-react";
import { ConnectDialog } from "@/components/app/connections/ConnectDialog";
import MetaErrorCard from "@/components/ui/MetaErrorCard";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type Campaign, type CampaignStatus, type Platform } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { AiMark, Button, PlatformBadge, Segmented, Toggle, type PlatformKey } from "@/components/app/ui";
import { FilterMultiSelect, GridEmpty, GridSearch } from "@/components/app/grid";
import { useSuggestions } from "@/components/app/suggestions/useSuggestions";
import { CampaignsGrid, type CampaignRow } from "@/components/app/campaigns/CampaignsGrid";
import { BulkBudgetDialog } from "@/components/app/campaigns/BulkBudgetDialog";
import { useCampaignMutations } from "@/components/app/campaigns/useCampaignMutations";
import { downloadCsv } from "@/components/app/campaigns/csv";
import { objectiveLabel } from "@/components/app/campaigns/CampaignsGrid";

/**
 * Campaigns (guide §5.2, plan A5): KPI strip, AI banner with "Only show
 * these", DataGrid with status / platform filters, toggles, suggestion column,
 * sticky Action, bulk bar, footer totals, CSV export. Metrics cover the last
 * 30 days. Loads up to 500 campaigns at once and filters in the browser.
 */

const DAYS = 30;
const LIMIT = 500;
type StatusTab = "ALL" | CampaignStatus;
const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "DRAFT", label: "Draft" },
  { value: "ENDED", label: "Ended" },
];
const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "META", label: "Meta" },
  { value: "GOOGLE", label: "Google" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "LINKEDIN", label: "LinkedIn" },
];

function Kpi({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line bg-surface px-[18px] py-4 shadow-card">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {loading ? (
        <span className="h-[30px] w-24 animate-pulse rounded-lg bg-surface-2" />
      ) : (
        <span className="text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] tabular-nums">{value}</span>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  const router = useAppRouter();
  const access = useAccess();
  const searchParams = useSearchParams();
  const api = useApiClient();
  const { clientId, client, clients, hasMultiple } = useClientScope();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusTab>("ALL");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [onlySuggested, setOnlySuggested] = useState(false);
  const [budgetsFor, setBudgetsFor] = useState<Campaign[] | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  const q = useApi((c) => c.getCampaigns({ limit: LIMIT, days: DAYS, clientId: clientId ?? undefined }), [clientId], { key: "campaigns-grid" });
  const refetch = useCallback(() => void q.refetch(), [q]);
  const suggestions = useSuggestions({ clientId, onChanged: refetch });
  const mutations = useCampaignMutations(refetch);

  // ?new=1 (old links, AI Planner) → the New campaign wizard, which picks up
  // the planner's sessionStorage prefill itself.
  useEffect(() => {
    if (searchParams.get("new") === "1") router.replace("/campaigns/new");
  }, [searchParams, router]);

  // Pull fresh data from Meta (imports new campaigns, refreshes spend). The
  // label names the step so the wait has something to read.
  const [syncStage, setSyncStage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const handleSync = useCallback(async () => {
    if (syncStage !== null) return;
    setSyncError(null);
    setSyncStage("Syncing campaigns…");
    const toMetrics = setTimeout(() => setSyncStage("Syncing metrics…"), 1200);
    try {
      const r = await api.syncMeta();
      clearTimeout(toMetrics);
      setSyncStage("Refreshing…");
      await q.refetch();
      const base = `Sync complete — ${r.campaignsSynced} campaign${r.campaignsSynced === 1 ? "" : "s"} updated`;
      if (r.errors?.length) {
        setSyncError(`${r.errors[0].accountName}: ${r.errors[0].message}`);
        toast.success(`${base} (${r.errors.length} account had a problem)`);
      } else {
        toast.success(base);
      }
    } catch (e) {
      clearTimeout(toMetrics);
      const msg = e instanceof Error ? e.message : "Sync failed. Try again in a minute.";
      setSyncError(msg);
      toast.error(msg);
    } finally {
      setSyncStage(null);
    }
  }, [api, q, syncStage]);

  const campaigns = useMemo(() => q.data?.campaigns ?? [], [q.data]);
  const clientName = useCallback((id: string | null | undefined) => (id ? clients.find((c) => c.id === id)?.name ?? null : null), [clients]);

  // One suggestion per campaign: the highest priority one touched or open.
  const suggestionList = suggestions.list;
  const suggestionByCampaign = useMemo(() => {
    const m = new Map<string, (typeof suggestionList)[number]>();
    for (const s of suggestionList) if (s.campaignId && !m.has(s.campaignId)) m.set(s.campaignId, s);
    return m;
  }, [suggestionList]);

  const all: CampaignRow[] = useMemo(
    () =>
      campaigns.map((c) => ({
        c,
        clientName: hasMultiple && !clientId ? clientName(c.adAccount?.clientId) : null,
        currency: c.adAccount?.currency ?? null,
        spend: c.totals?.spend ?? 0,
        revenue: c.totals?.revenue ?? 0,
        conversions: c.totals?.conversions ?? 0,
        impressions: c.totals?.impressions ?? 0,
        clicks: c.totals?.clicks ?? 0,
        suggestion: suggestionByCampaign.get(c.id) ?? null,
      })),
    [campaigns, suggestionByCampaign, hasMultiple, clientId, clientName]
  );

  const counts = useMemo(() => {
    const n: Record<StatusTab, number> = { ALL: all.length, ACTIVE: 0, PAUSED: 0, DRAFT: 0, ENDED: 0 };
    for (const r of all) n[r.c.status]++;
    return n;
  }, [all]);

  const needle = query.trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      (status === "ALL" || r.c.status === status) &&
      (platforms.length === 0 || platforms.includes(r.c.platform)) &&
      (!needle || r.c.name.toLowerCase().includes(needle)) &&
      (!onlySuggested || r.suggestion?.status === "OPEN")
  );
  const filtersActive = needle !== "" || status !== "ALL" || platforms.length > 0 || onlySuggested;
  const clearFilters = () => {
    setQuery("");
    setStatus("ALL");
    setPlatforms([]);
    setOnlySuggested(false);
  };

  // KPI strip (last 30 days, campaigns in scope).
  const running = all.filter((r) => r.c.status === "ACTIVE");
  const spend = all.reduce((n, r) => n + r.spend, 0);
  const revenue = all.reduce((n, r) => n + r.revenue, 0);
  const dailyLive = running.reduce((n, r) => n + (r.c.budgetType === "DAILY" ? Number(r.c.budget) || 0 : 0), 0);
  const currencies = Array.from(new Set(all.map((r) => r.currency).filter((x): x is string => !!x)));
  const currency = currencies[0] ?? null;
  const openSuggested = all.filter((r) => r.suggestion?.status === "OPEN").length;
  const loading = q.loading;

  const scopeTitle = client ? client.name : hasMultiple ? "All clients" : "All campaigns";
  const summary = loading
    ? undefined
    : [
        `${all.length} campaign${all.length === 1 ? "" : "s"}`,
        `${running.length} running`,
        openSuggested ? `${openSuggested} could do better` : null,
        currencies.length > 1 ? `totals mix ${currencies.join(", ")}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  const exportCsv = () => {
    const header = ["Campaign", "Client", "Platform", "Status", "Objective", "Budget", "Budget type", "Currency", `Spend (${DAYS}d)`, `Revenue (${DAYS}d)`, "ROAS", "Conversions", "Clicks", "Impressions", "CTR %", "Reach", "Advertix suggests"];
    const data = [...rows]
      .sort((a, b) => b.spend - a.spend)
      .map((r) => [
        r.c.name,
        clientName(r.c.adAccount?.clientId) ?? "",
        r.c.platform,
        r.c.status,
        objectiveLabel(r.c.objective),
        Number(r.c.budget) || 0,
        r.c.budgetType,
        r.currency ?? "",
        r.spend.toFixed(2),
        r.revenue.toFixed(2),
        r.spend > 0 && r.revenue > 0 ? (r.revenue / r.spend).toFixed(2) : "",
        r.conversions,
        r.clicks,
        r.impressions,
        r.impressions > 0 ? ((r.clicks / r.impressions) * 100).toFixed(2) : "",
        r.c.reach ?? 0,
        r.suggestion?.status === "OPEN" ? r.suggestion.title : "",
      ]);
    downloadCsv(`advertix-campaigns-${new Date().toISOString().slice(0, 10)}.csv`, header, data);
  };

  return (
    <>
      <PageHeader
        kicker={`${scopeTitle} · last ${DAYS} days`}
        title="Campaigns"
        summary={summary}
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw size={16} className={syncStage ? "animate-spin motion-reduce:animate-none" : undefined} />} onClick={handleSync} disabled={!!syncStage || !access.can("connect")} title={access.can("connect") ? "Pull the latest campaigns and metrics from Meta" : access.why("connect")}>
              {syncStage ?? "Sync now"}
            </Button>
            <Button variant="secondary" icon={<Download size={16} />} onClick={exportCsv} disabled={loading || rows.length === 0} title="Download the rows below as CSV">
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus size={16} strokeWidth={2.5} />} onClick={() => router.push("/campaigns/new")} disabled={!access.can("edit")} title={access.can("edit") ? undefined : access.why("edit")}>
              New campaign
            </Button>
          </>
        }
      />
      <PageBody className="gap-5">
        {syncError && (
          <MetaErrorCard
            message={syncError}
            onRetry={() => {
              setSyncError(null);
              void handleSync();
            }}
          />
        )}

        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
          <Kpi label="Running now" value={String(running.length)} loading={loading} />
          <Kpi label="Spend" value={fmtMoney(spend, currency, { whole: true })} loading={loading} />
          <Kpi label="Blended ROAS" value={spend > 0 && revenue > 0 ? `${(revenue / spend).toFixed(2)}x` : "—"} loading={loading} />
          <Kpi label="Daily budget live" value={fmtMoney(dailyLive, currency, { whole: true })} loading={loading} />
        </div>

        {!loading && all.length > 0 && (
          <div className="flex flex-wrap items-center gap-3.5 rounded-menu bg-brand-soft px-4 py-3.5">
            <AiMark size={32} />
            <span className="min-w-[240px] flex-1">
              <span className="font-semibold text-brand-ink">
                {openSuggested === 0
                  ? "No open suggestions."
                  : `${openSuggested} campaign${openSuggested === 1 ? "" : "s"} could do better.`}
              </span>{" "}
              <span className="text-ink-2">Suggestions sit in the last column. Nothing changes until you apply one.</span>
            </span>
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
              <Toggle checked={onlySuggested} onChange={setOnlySuggested} label="Only show campaigns with suggestions" disabled={openSuggested === 0 && !onlySuggested} />
              <span className="whitespace-nowrap">Only show these</span>
            </label>
          </div>
        )}

        {(q.data?.total ?? 0) > LIMIT && (
          <p className="-mb-2 text-[13px] text-ink-2">
            Showing the {LIMIT} most recent of {q.data?.total} campaigns. Use the client switcher to narrow it down.
          </p>
        )}

        <CampaignsGrid
          rows={rows}
          loading={loading}
          mutations={mutations}
          suggestions={suggestions}
          onEditBudgets={setBudgetsFor}
          footerLabel={`Total · ${rows.length} of ${all.length}`}
          filters={
            <>
              <GridSearch value={query} onChange={setQuery} />
              <Segmented
                label="Status"
                value={status}
                onChange={setStatus}
                className="max-w-full overflow-x-auto [scrollbar-width:none]"
                options={STATUS_TABS.map((t) => ({ ...t, count: counts[t.value] }))}
              />
              <FilterMultiSelect
                label="Platform"
                value={platforms}
                onChange={setPlatforms}
                options={PLATFORMS.map((p) => ({
                  value: p.value,
                  label: p.label,
                  icon: <PlatformBadge platform={p.value as PlatformKey} size={20} />,
                  count: all.filter((r) => r.c.platform === p.value).length,
                }))}
              />
              {filtersActive && (
                <Button variant="ghost" className="font-semibold text-brand hover:bg-brand-soft hover:text-brand" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </>
          }
          empty={
            q.error ? (
              <GridEmpty title="Couldn’t load campaigns" body={q.error} action={<Button variant="secondary" size="toolbar" onClick={refetch}>Try again</Button>} />
            ) : all.length === 0 ? (
              <GridEmpty
                title="No campaigns yet"
                body="Connect an ad account and sync to pull in your existing campaigns, or create a new one."
                action={
                  <span className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="toolbar" onClick={() => setConnectOpen(true)}>
                      Connect an ad account
                    </Button>
                    <Button variant="secondary" size="toolbar" onClick={handleSync} disabled={!!syncStage}>
                      Sync now
                    </Button>
                  </span>
                }
              />
            ) : (
              <GridEmpty
                title="No campaigns match these filters"
                body={`Try another status or platform, or clear filters to see all ${all.length} campaigns.`}
                action={<Button variant="secondary" size="toolbar" onClick={clearFilters}>Clear filters</Button>}
              />
            )
          }
        />
      </PageBody>

      <BulkBudgetDialog open={budgetsFor !== null} campaigns={budgetsFor ?? []} onClose={() => setBudgetsFor(null)} onSave={mutations.setBudgets} />
      <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </>
  );
}
