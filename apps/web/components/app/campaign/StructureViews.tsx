"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { ImageIcon, Layers, Pencil, RefreshCw } from "lucide-react";
import { useApiClient, type Campaign, type CampaignAdSet } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { CellText, DataGrid, type GridColumn } from "@/components/app/grid";
import { Button, Card, EmptyState, IconButton, Pill, PLATFORM_META, Skeleton, Toggle, type PlatformKey } from "@/components/app/ui";
import { AdSetBudgetDialog } from "./AdSetBudgetDialog";
import { AdTile } from "./AdTile";
import { DELIVERY_TONE, adSetRead, cpaOf, ctrOf, deliveryLabel, roasOf, type CampaignStructureState } from "./structure";

/**
 * Campaign detail ad sets and ads (plan B4, guide §5.3): the ad-set grid and
 * ad tiles on Overview, one card per ad set on the Ad sets tab, and every ad
 * on the Ads tab. Meta only; other platforms and unpublished campaigns get
 * an honest empty state.
 */

const roasText = (v: number | null) => (v === null ? "—" : `${v.toFixed(2)}x`);

function budgetText(s: CampaignAdSet, currency: string | null, campaignBudget: boolean) {
  if (s.dailyBudget !== null) return `${fmtMoney(s.dailyBudget, currency, { whole: Number.isInteger(s.dailyBudget) || s.dailyBudget >= 1000 })}/day`;
  if (s.lifetimeBudget !== null) return `${fmtMoney(s.lifetimeBudget, currency, { whole: true })} lifetime`;
  return campaignBudget ? "Campaign budget" : "—";
}

/** Why there's nothing to show, with the one action that helps. */
export function StructureEmpty({ campaign: c, kind, onSynced }: { campaign: Campaign; kind: "adsets" | "ads"; onSynced: () => void }) {
  const api = useApiClient();
  const [syncing, setSyncing] = useState(false);
  const icon = kind === "adsets" ? <Layers size={22} /> : <ImageIcon size={22} />;
  const what = kind === "adsets" ? "Ad sets" : "Ads";
  if (c.platform !== "META") {
    const name = PLATFORM_META[c.platform as PlatformKey]?.name ?? c.platform;
    return <EmptyState icon={icon} title={`${what} for ${name} aren’t synced yet`} body={`Advertix syncs Meta ad sets and ads first. ${name} campaigns show their campaign-level results for now.`} />;
  }
  if (!c.externalId) {
    return <EmptyState icon={icon} title="Publish to see ad sets and ads" body="Once this campaign is on Meta, its ad sets and ads show up here with their results." />;
  }
  const sync = async () => {
    setSyncing(true);
    try {
      await api.syncMeta();
      toast.success("Synced with Meta");
      onSynced();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };
  return (
    <EmptyState
      icon={icon}
      title={`${what} show up after the next sync`}
      body="Advertix pulls ad sets, ads and their daily results with every Meta sync. Run one now to bring this campaign’s in."
      action={
        <Button variant="secondary" icon={<RefreshCw size={16} className={syncing ? "animate-spin motion-reduce:animate-none" : undefined} />} onClick={sync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
      }
    />
  );
}

/** Ad-set grid (Overview). */
export function AdSetsGrid({ campaign: c, st, onBudget }: { campaign: Campaign; st: CampaignStructureState; onBudget: (s: CampaignAdSet) => void }) {
  const data = st.data;
  const currency = c.adAccount?.currency ?? null;
  const sets = data?.adSets ?? [];
  const totalDaily = sets.reduce((a, s) => a + (s.status !== "ENDED" ? s.dailyBudget ?? 0 : 0), 0);
  const t = sets.reduce(
    (a, s) => ({ ...a, spend: a.spend + s.totals.spend, revenue: a.revenue + s.totals.revenue, conversions: a.conversions + s.totals.conversions, impressions: a.impressions + s.totals.impressions, clicks: a.clicks + s.totals.clicks }),
    { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0, landingPageViews: 0, addToCart: 0 }
  );
  const columns: GridColumn<CampaignAdSet>[] = [
    { id: "name", label: "Ad set", width: 220, grow: 2, sortValue: (s) => s.name, render: (s) => <CellText strong sub={s.audience || undefined}>{s.name}</CellText> },
    {
      id: "status",
      label: "Status",
      width: 140,
      render: (s) => {
        const l = deliveryLabel(s);
        return <Pill tone={DELIVERY_TONE[l] ?? "neutral"}>{l}</Pill>;
      },
    },
    {
      id: "budget",
      label: "Budget",
      width: 170,
      grow: 1,
      sortValue: (s) => s.dailyBudget ?? s.lifetimeBudget ?? 0,
      render: (s) => (
        <span className="flex w-full items-center gap-2.5">
          {s.dailyBudget !== null && totalDaily > 0 && (
            <span className="relative h-1.5 flex-1 rounded-full bg-surface-3">
              <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${Math.round(((s.dailyBudget ?? 0) / totalDaily) * 100)}%` }} />
            </span>
          )}
          <span className="flex-none text-right tabular-nums">{budgetText(s, currency, Boolean(data?.campaignBudget))}</span>
        </span>
      ),
    },
    { id: "spend", label: "Spend", width: 96, align: "right", sortValue: (s) => s.totals.spend, render: (s) => (s.totals.spend > 0 ? fmtMoney(s.totals.spend, currency) : "—"), footer: fmtMoney(t.spend, currency) },
    { id: "roas", label: "ROAS", width: 80, align: "right", sortValue: (s) => roasOf(s.totals), render: (s) => <span className="font-semibold">{roasText(roasOf(s.totals))}</span>, footer: roasText(roasOf({ ...t })) },
    { id: "cpa", label: "Cost / conv.", width: 100, align: "right", sortValue: (s) => cpaOf(s.totals), render: (s) => (cpaOf(s.totals) === null ? "—" : fmtMoney(cpaOf(s.totals)!, currency)), footer: cpaOf({ ...t }) === null ? "—" : fmtMoney(cpaOf({ ...t })!, currency) },
    { id: "conv", label: "Conversions", width: 100, align: "right", defaultHidden: true, sortValue: (s) => s.totals.conversions, render: (s) => s.totals.conversions.toLocaleString("en-US"), footer: t.conversions.toLocaleString("en-US") },
    { id: "ctr", label: "CTR", width: 72, align: "right", defaultHidden: true, sortValue: (s) => ctrOf(s.totals), render: (s) => (ctrOf(s.totals) === null ? "—" : `${ctrOf(s.totals)!.toFixed(2)}%`) },
    { id: "freq", label: "Frequency", width: 92, align: "right", sortValue: (s) => s.frequency30d, render: (s) => (s.frequency30d > 0 ? s.frequency30d.toFixed(1) : "—") },
  ];
  return (
    <DataGrid
      tableId="campaign-adsets"
      label="Ad sets"
      rows={sets}
      getRowId={(s) => s.id}
      columns={columns}
      defaultSort={{ id: "spend", dir: "desc" }}
      footerLabel="Total"
      loading={st.loading}
      action={{
        width: 104,
        render: (s) => (
          <span className="flex items-center gap-1.5">
            <span title={s.statusBlocker ?? (s.switchOn ? "Pause on Meta" : "Resume on Meta")}>
              <Toggle checked={s.switchOn} onChange={() => void st.toggleAdSet(s)} label={`${s.switchOn ? "Pause" : "Resume"} ${s.name}`} disabled={st.busy(s.id) || Boolean(s.statusBlocker)} />
            </span>
            <IconButton label={s.budgetBlocker ?? "Change daily budget"} size={32} title={s.budgetBlocker ?? "Change daily budget"} disabled={Boolean(s.budgetBlocker)} onClick={() => onBudget(s)}>
              <Pencil size={15} />
            </IconButton>
          </span>
        ),
      }}
      filters={
        <div className="mr-auto flex flex-col leading-tight">
          <span className="text-base font-semibold">Ad sets</span>
          <span className="text-[13px] text-ink-2">Last {data?.days ?? 30} days</span>
        </div>
      }
    />
  );
}

/** Overview: ad-set grid + the top ads, when the campaign has synced ad sets. */
export function OverviewStructure({ campaign: c, st }: { campaign: Campaign; st: CampaignStructureState }) {
  const [budgetFor, setBudgetFor] = useState<CampaignAdSet | null>(null);
  const data = st.data;
  if (!data || data.adSets.length === 0) return null;
  const currency = c.adAccount?.currency ?? null;
  const names = new Map(data.adSets.map((s) => [s.id, s.name]));
  const ads = [...data.ads].filter((a) => a.status !== "ENDED").sort((a, b) => b.totals.spend - a.totals.spend);
  return (
    <>
      <AdSetsGrid campaign={c} st={st} onBudget={setBudgetFor} />
      {ads.length > 0 && (
        <section className="flex flex-col gap-3" aria-label="Ads">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-base font-semibold">Ads</span>
            <span className="text-[13px] text-ink-2">
              The bar under each ad shows frequency against 5.0, where most audiences tune out.{" "}
              {ads.length > 4 && (
                <Link href={`/campaigns/${c.id}?tab=ads`} scroll={false} className="font-semibold text-brand no-underline hover:text-brand-hover">
                  All {ads.length} ads
                </Link>
              )}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {ads.slice(0, 4).map((a) => (
              <AdTile key={a.id} ad={a} currency={currency} adSetName={data.adSets.length > 1 ? names.get(a.adSetId) : undefined} />
            ))}
          </div>
        </section>
      )}
      <AdSetBudgetDialog adSet={budgetFor} currency={currency} minDailyBudget={c.adAccount?.minDailyBudget ?? null} onClose={() => setBudgetFor(null)} onSave={st.setAdSetBudget} />
    </>
  );
}

/** Ad sets tab: one card per ad set with a plain read, results and controls. */
export function AdSetsTab({ campaign: c, st, onSynced }: { campaign: Campaign; st: CampaignStructureState; onSynced: () => void }) {
  const [budgetFor, setBudgetFor] = useState<CampaignAdSet | null>(null);
  const data = st.data;
  const currency = c.adAccount?.currency ?? null;
  if (st.loading) return <Skeleton className="h-48 rounded-card" />;
  if (!data || data.adSets.length === 0) return <StructureEmpty campaign={c} kind="adsets" onSynced={onSynced} />;
  const sets = [...data.adSets].sort((a, b) => Number(a.status === "ENDED") - Number(b.status === "ENDED") || b.totals.spend - a.totals.spend);
  return (
    <div className="flex flex-col gap-4">
      {data.campaignBudget && (
        <p className="text-[13px] text-ink-2">This campaign shares one budget across its ad sets (campaign budget). Change it in Settings; Meta spreads it to the ad sets doing best.</p>
      )}
      {sets.map((s) => {
        const l = deliveryLabel(s);
        const r = roasOf(s.totals);
        return (
          <Card key={s.id} className={cn("flex flex-wrap gap-6 p-[22px]", s.status === "ENDED" && "opacity-70")}>
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
              <span className="text-lg font-semibold leading-tight tracking-[-0.015em]">{s.name}</span>
              <span className="flex flex-wrap items-center gap-2">
                <Pill tone={DELIVERY_TONE[l] ?? "neutral"}>{l}</Pill>
                {s.audience && <span className="text-[13px] text-ink-2">{s.audience}</span>}
              </span>
              <span className="text-sm text-ink-2 [text-wrap:pretty]">{adSetRead(s, data.adSets, currency)}</span>
              <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-[13px]">
                <span className="flex items-center gap-2" title={s.statusBlocker ?? undefined}>
                  <Toggle checked={s.switchOn} onChange={() => void st.toggleAdSet(s)} label={`${s.switchOn ? "Pause" : "Resume"} ${s.name}`} disabled={st.busy(s.id) || Boolean(s.statusBlocker)} />
                  <span className="text-ink-2">{s.switchOn ? "On" : "Off"} on Meta</span>
                </span>
                {s.adCount > 0 && (
                  <Link href={`/campaigns/${c.id}?tab=ads&adset=${s.id}`} scroll={false} className="font-semibold text-brand no-underline hover:text-brand-hover">
                    {s.adCount} ad{s.adCount === 1 ? "" : "s"}
                  </Link>
                )}
              </span>
            </div>
            <div className="grid min-w-0 flex-[2_1_420px] grid-cols-2 gap-2 self-start tabular-nums min-[560px]:grid-cols-4">
              <span className="flex flex-col rounded-xl bg-surface-2 px-3.5 py-3">
                <span className="flex items-center justify-between gap-1 text-xs text-ink-2">
                  {s.dailyBudget !== null ? "Budget / day" : "Budget"}
                  {!s.budgetBlocker && (
                    <button type="button" onClick={() => setBudgetFor(s)} className="font-semibold text-brand hover:text-brand-hover">
                      Edit
                    </button>
                  )}
                </span>
                <span className="text-xl font-semibold" title={s.budgetBlocker ?? undefined}>
                  {budgetText(s, currency, data.campaignBudget).replace("/day", "")}
                </span>
              </span>
              <span className="flex flex-col rounded-xl bg-surface-2 px-3.5 py-3">
                <span className="text-xs text-ink-2">Spend</span>
                <span className="text-xl font-semibold">{s.totals.spend > 0 ? fmtMoney(s.totals.spend, currency, { whole: s.totals.spend >= 1000 }) : "—"}</span>
              </span>
              <span className="flex flex-col rounded-xl bg-surface-2 px-3.5 py-3">
                <span className="text-xs text-ink-2">ROAS</span>
                <span className="text-xl font-semibold">{roasText(r)}</span>
              </span>
              <span className="flex flex-col rounded-xl bg-surface-2 px-3.5 py-3">
                <span className="text-xs text-ink-2">Conversions</span>
                <span className="text-xl font-semibold">{s.totals.conversions > 0 ? s.totals.conversions.toLocaleString("en-US") : "—"}</span>
              </span>
            </div>
          </Card>
        );
      })}
      <p className="text-xs text-ink-3">Results cover the last {data.days} days. Pausing or changing a budget here changes it on Meta; Undo is in the Change log for 7 days.</p>
      <AdSetBudgetDialog adSet={budgetFor} currency={currency} minDailyBudget={c.adAccount?.minDailyBudget ?? null} onClose={() => setBudgetFor(null)} onSave={st.setAdSetBudget} />
    </div>
  );
}

/** Ads tab: every ad, filterable by ad set, fatigued ones flagged. */
export function AdsTab({ campaign: c, st, adSetFilter, onSynced }: { campaign: Campaign; st: CampaignStructureState; adSetFilter: string | null; onSynced: () => void }) {
  const [filter, setFilter] = useState<string | null>(adSetFilter);
  const data = st.data;
  const currency = c.adAccount?.currency ?? null;
  if (st.loading) return <Skeleton className="h-72 rounded-card" />;
  if (!data || data.ads.length === 0) return <StructureEmpty campaign={c} kind="ads" onSynced={onSynced} />;
  const names = new Map(data.adSets.map((s) => [s.id, s.name]));
  const shown = data.ads
    .filter((a) => !filter || a.adSetId === filter)
    .sort((a, b) => Number(a.status === "ENDED") - Number(b.status === "ENDED") || b.totals.spend - a.totals.spend);
  const fatigued = data.ads.filter((a) => a.fatigue.level === "fatigued" && a.status !== "ENDED").length;
  const withAds = data.adSets.filter((s) => s.adCount > 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {withAds.length > 1 &&
          [{ id: null as string | null, name: "All ad sets" }, ...withAds.map((s) => ({ id: s.id as string | null, name: s.name }))].map((o) => (
            <button
              key={o.id ?? "all"}
              type="button"
              aria-pressed={filter === o.id}
              onClick={() => setFilter(o.id)}
              className={cn(
                "max-w-[240px] truncate rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors",
                filter === o.id ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:text-ink"
              )}
            >
              {o.name}
            </button>
          ))}
        <span className="ml-auto text-[13px] text-ink-2">
          {fatigued > 0 ? `${fatigued} fatigued · ` : ""}Last {data.days} days
        </span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {shown.map((a) => (
          <AdTile key={a.id} ad={a} currency={currency} adSetName={withAds.length > 1 ? names.get(a.adSetId) : undefined} full busy={st.busy(a.id)} onToggle={() => void st.toggleAd(a)} />
        ))}
      </div>
    </div>
  );
}
