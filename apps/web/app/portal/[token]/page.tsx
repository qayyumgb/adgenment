"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { fetchPortal, type PortalKpis, type PortalReport } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { Card, KpiCard, PlatformBadge, Segmented, Skeleton, StatusPill, type PlatformKey } from "@/components/app/ui";

/**
 * Client portal (plan C4): the read-only report behind a share link. No login;
 * the agency chose what it shows (numbers it hides aren't even sent). Ranges
 * 7 / 30 / 90 days vs the days before.
 */

type Metric = "spend" | "revenue" | "conversions" | "clicks";
const STATUS: Record<string, string> = { ACTIVE: "Active", PAUSED: "Paused", DRAFT: "Draft", ENDED: "Ended" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const pct = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null && b > 0 ? ((a - b) / b) * 100 : null);
const num = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

function Chart({ r }: { r: PortalReport }) {
  const options = useMemo(
    () =>
      [
        ...(r.shows.spend ? [{ value: "spend" as Metric, label: "Spend" }] : []),
        ...(r.shows.revenue ? [{ value: "revenue" as Metric, label: "Revenue" }] : []),
        { value: "conversions" as Metric, label: "Results" },
        { value: "clicks" as Metric, label: "Clicks" },
      ],
    [r.shows]
  );
  const [metric, setMetric] = useState<Metric>(options[0].value);
  const [hover, setHover] = useState<number | null>(null);
  const values = r.series.map((d) => Number(d[metric] ?? 0));
  const top = Math.max(1, ...values);
  const money = metric === "spend" || metric === "revenue";
  const fmt = (n: number) => (money ? fmtMoney(n, r.currency, { whole: true }) : num(n));
  const total = values.reduce((a, b) => a + b, 0);
  const h = hover !== null ? r.series[hover] : null;
  const step = Math.max(1, Math.ceil(r.series.length / 7));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Day by day</div>
          <div className="mt-0.5 text-[13px] tabular-nums text-ink-2" aria-live="polite">
            <span className="font-semibold text-ink">{h ? day(h.date) : `Last ${r.days} days`}</span> · {options.find((o) => o.value === metric)?.label} {fmt(h ? values[hover!] : total)}
          </div>
        </div>
        <Segmented label="Chart metric" size="sm" value={metric} onChange={(m) => (setMetric(m), setHover(null))} options={options} />
      </div>
      {total === 0 ? (
        <div className="flex h-[200px] items-center justify-center rounded-ctl bg-surface-2 text-sm text-ink-2">No {options.find((o) => o.value === metric)?.label.toLowerCase()} in this period.</div>
      ) : (
      <div role="img" aria-label={`Daily ${metric}, last ${r.days} days, total ${fmt(total)}`} className={cn("flex h-[200px] items-end", r.days === 90 ? "gap-px" : r.days === 30 ? "gap-[3px]" : "gap-3")} onMouseLeave={() => setHover(null)}>
        {values.map((v, i) => (
          <div key={r.series[i].date} onMouseEnter={() => setHover(i)} className={cn("relative h-full flex-1", hover !== null && hover !== i && "opacity-40")}>
            <div className="absolute inset-x-0 bottom-0 rounded-t bg-brand" style={{ height: `${(v / top) * 100}%`, minHeight: v > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      )}
      <div className="flex justify-between text-xs text-ink-3" aria-hidden="true">
        {r.series.filter((_, i) => i % step === 0).map((d) => (
          <span key={d.date}>{day(d.date)}</span>
        ))}
      </div>
    </Card>
  );
}

function Kpis({ r }: { r: PortalReport }) {
  const k = r.kpis;
  const p = r.previous;
  const money = (n: number | null | undefined) => (n == null ? "—" : fmtMoney(n, r.currency, { whole: n === 0 || n >= 100 }));
  const cards: { label: string; value: string; delta: number | null; higherIsBetter?: boolean }[] = [
    ...(r.shows.spend ? [{ label: "Spend", value: money(k.spend), delta: pct(k.spend, p.spend), higherIsBetter: true }] : []),
    ...(r.shows.revenue ? [{ label: "Revenue", value: money(k.revenue), delta: pct(k.revenue, p.revenue) }] : []),
    ...(r.shows.spend && r.shows.revenue ? [{ label: "ROAS", value: k.roas == null ? "—" : `${k.roas.toFixed(2)}x`, delta: pct(k.roas, p.roas) }] : []),
    { label: "Results", value: num(k.conversions), delta: pct(k.conversions, p.conversions) },
    ...(r.shows.spend ? [{ label: "Cost per result", value: money(k.cpa), delta: pct(k.cpa, p.cpa), higherIsBetter: false }] : []),
    { label: "Clicks", value: num(k.clicks), delta: pct(k.clicks, p.clicks) },
    { label: "CTR", value: k.ctr == null ? "—" : `${k.ctr.toFixed(2)}%`, delta: pct(k.ctr, p.ctr) },
  ];
  return (
    // Two a row on phones; on wider screens up to four a row (7 cards → 4 + 3).
    <div className="grid grid-cols-2 gap-3 min-[720px]:[grid-template-columns:repeat(var(--kpi-cols),minmax(0,1fr))]" style={{ ["--kpi-cols" as string]: Math.min(4, cards.length) }}>
      {cards.map((c) => (
        // No pill when there's nothing to compare with.
        <KpiCard key={c.label} label={c.label} value={c.value} delta={c.delta ?? undefined} higherIsBetter={c.higherIsBetter ?? true} />
      ))}
    </div>
  );
}

function Campaigns({ r }: { r: PortalReport }) {
  const rows = r.campaigns ?? [];
  const money = (n: number | null | undefined) => (n == null ? "—" : fmtMoney(n, r.currency, { whole: n >= 100 }));
  const cols: { label: string; cell: (c: (typeof rows)[number]) => string }[] = [
    ...(r.shows.spend ? [{ label: "Spend", cell: (c: PortalKpis) => money(c.spend) }] : []),
    { label: "Results", cell: (c: PortalKpis) => num(c.conversions) },
    ...(r.shows.spend ? [{ label: "Cost / result", cell: (c: PortalKpis) => money(c.cpa) }] : []),
    ...(r.shows.spend && r.shows.revenue ? [{ label: "ROAS", cell: (c: PortalKpis) => (c.roas == null ? "—" : `${c.roas.toFixed(2)}x`) }] : []),
    { label: "CTR", cell: (c: PortalKpis) => (c.ctr == null ? "—" : `${c.ctr.toFixed(2)}%`) },
  ];
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="px-5 py-4 text-base font-semibold">Campaigns</div>
      {rows.length === 0 ? (
        <p className="m-0 border-t border-line px-5 py-4 text-sm text-ink-2">No campaign activity in this period.</p>
      ) : (
        <>
          {/* Phones: one block per campaign with its numbers underneath. */}
          <ul className="m-0 list-none p-0 min-[720px]:hidden">
            {rows.map((c, i) => (
              <li key={i} className="flex flex-col gap-2.5 border-t border-line px-5 py-3.5">
                <span className="flex items-center gap-2.5">
                  <PlatformBadge platform={c.platform as PlatformKey} size={22} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                  <StatusPill status={STATUS[c.status] ?? c.status} />
                </span>
                <dl className="m-0 grid grid-cols-3 gap-x-3 gap-y-2">
                  {cols.map((col) => (
                    <div key={col.label} className="flex flex-col">
                      <dt className="text-xs text-ink-3">{col.label}</dt>
                      <dd className="m-0 text-sm tabular-nums">{col.cell(c)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto min-[720px]:block">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-t border-line bg-surface-2 text-left text-xs font-medium text-ink-2">
                  <th className="px-5 py-2.5 font-medium">Campaign</th>
                  {cols.map((c) => (
                    <th key={c.label} className="px-3 py-2.5 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2.5">
                        <PlatformBadge platform={c.platform as PlatformKey} size={22} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.name}</span>
                          <StatusPill status={STATUS[c.status] ?? c.status} className="mt-1" />
                        </span>
                      </span>
                    </td>
                    {cols.map((col) => (
                      <td key={col.label} className="px-3 py-3 text-right tabular-nums">
                        {col.cell(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

export default function PortalPage({ params }: { params: { token: string } }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [r, setR] = useState<PortalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    fetchPortal(params.token, days)
      .then((x) => live && (setR(x), setError(null)))
      .catch((e) => live && setError(e instanceof Error ? e.message : "This report couldn't load."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [params.token, days]);

  useEffect(() => {
    if (r) document.title = `${r.client} · performance report`;
  }, [r]);

  if (error && !r) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <span className="text-lg font-semibold">This report isn’t available</span>
        <span className="text-sm text-ink-2">{error}</span>
      </main>
    );
  }

  const p = r?.pacing;
  // Single-brand workspaces name their only client after themselves: don't say it twice.
  const kicker = r ? (r.agency.trim().toLowerCase() === r.client.trim().toLowerCase() ? "Performance report" : `${r.agency} · performance report`) : null;
  const quiet = r ? r.kpis.impressions === 0 && r.kpis.clicks === 0 && r.kpis.conversions === 0 && !r.kpis.spend : false;
  return (
    <main className="mx-auto flex max-w-[1080px] flex-col gap-5 px-4 pb-12 pt-6 min-[720px]:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] text-ink-2">{kicker ?? <Skeleton className="h-4 w-48" />}</div>
          <h1 className="m-0 mt-1 text-[26px] font-semibold tracking-[-.01em]">{r ? r.client : <Skeleton className="h-8 w-56" />}</h1>
          {r && (
            <div className="mt-1 text-[13px] text-ink-2">
              {day(r.from)} – {day(r.to)}, compared with the {r.days} days before{r.updatedAt ? ` · updated ${timeAgo(r.updatedAt)}` : ""}
            </div>
          )}
        </div>
        <Segmented
          label="Period"
          value={days}
          onChange={setDays}
          options={[
            { value: 7, label: "7 days" },
            { value: 30, label: "30 days" },
            { value: 90, label: "90 days" },
          ]}
        />
      </header>

      {!r || loading ? (
        <>
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </>
      ) : (
        <>
          {quiet && (
            <div role="status" className="rounded-card border border-line bg-surface px-5 py-4 text-sm">
              <span className="font-semibold">No ad activity in this period.</span>{" "}
              <span className="text-ink-2">
                Nothing ran between {day(r.from)} and {day(r.to)}{r.days < 90 ? ". Try a longer period above." : "."}
              </span>
            </div>
          )}
          <Kpis r={r} />
          {p && (
            <Card className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-base font-semibold">This month’s budget</span>
                <span className="text-[13px] text-ink-2">
                  {fmtMoney(p.spent, r.currency, { whole: true })} of {fmtMoney(p.monthlyBudget, r.currency, { whole: true })} · on pace for {fmtMoney(p.projected, r.currency, { whole: true })}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, (p.spent / p.monthlyBudget) * 100))} aria-label="Budget spent this month">
                <div className={cn("h-full rounded-full", p.status === "AHEAD" ? "bg-warn" : "bg-brand")} style={{ width: `${Math.min(100, (p.spent / p.monthlyBudget) * 100)}%` }} />
              </div>
            </Card>
          )}
          <Chart key={`${r.days}-${r.shows.spend}-${r.shows.revenue}`} r={r} />
          {r.shows.campaigns && <Campaigns r={r} />}
        </>
      )}

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-ink-3">
        <span>Read-only report{r ? ` shared by ${r.agency}` : ""}. Numbers come from the ad platforms and can change for a few days as they finalise.</span>
        <a href="https://advertix.io" className="inline-flex items-center gap-1.5 text-ink-3 no-underline hover:text-ink-2">
          <Image src="/brand/advertix-icon.png" alt="" width={14} height={14} className="rounded-sm" /> Powered by Advertix
        </a>
      </footer>
    </main>
  );
}
