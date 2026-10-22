"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { fmtMoney } from "@/lib/money";
import { CellText, DataGrid, GridEmpty, type GridColumn } from "@/components/app/grid";
import { Segmented } from "@/components/app/ui";

export type BreakdownRow = {
  id: string;
  name: string;
  sub?: string;
  icon?: ReactNode;
  href?: string;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
};

export type BreakdownBy = "platform" | "client" | "campaign";

const roas = (r: Pick<BreakdownRow, "spend" | "revenue">) => (r.spend > 0 && r.revenue > 0 ? r.revenue / r.spend : null);
const cpa = (r: Pick<BreakdownRow, "spend" | "conversions">) => (r.conversions > 0 ? r.spend / r.conversions : null);
const ctr = (r: Pick<BreakdownRow, "clicks" | "impressions">) => (r.impressions > 0 ? (r.clicks / r.impressions) * 100 : null);
const cpm = (r: Pick<BreakdownRow, "spend" | "impressions">) => (r.impressions > 0 ? (r.spend / r.impressions) * 1000 : null);

/** Breakdown grid by platform / client / campaign (Analytics, guide §5.7). */
export function BreakdownGrid({
  by,
  byOptions,
  onByChange,
  rows,
  currency,
  loading,
  note,
}: {
  by: BreakdownBy;
  byOptions: { value: BreakdownBy; label: string }[];
  onByChange: (b: BreakdownBy) => void;
  rows: BreakdownRow[];
  currency: string | null;
  loading: boolean;
  note?: string;
}) {
  const t = rows.reduce(
    (a, r) => ({ spend: a.spend + r.spend, revenue: a.revenue + r.revenue, conversions: a.conversions + r.conversions, impressions: a.impressions + r.impressions, clicks: a.clicks + r.clicks }),
    { spend: 0, revenue: 0, conversions: 0, impressions: 0, clicks: 0 }
  );
  const money = (n: number | null, whole = true) => (n === null ? "—" : fmtMoney(n, currency, { whole }));
  const num = (n: number) => n.toLocaleString("en-US");
  const label = by === "platform" ? "Platform" : by === "client" ? "Client" : "Campaign";

  const columns: GridColumn<BreakdownRow>[] = [
    {
      id: "name",
      label,
      width: 200,
      grow: 1.6,
      sortValue: (r) => r.name,
      render: (r) => {
        const body = (
          <span className="flex min-w-0 items-center gap-2.5">
            {r.icon}
            <CellText strong sub={r.sub}>
              {r.name}
            </CellText>
          </span>
        );
        return r.href ? (
          <Link href={r.href} className="block min-w-0 text-ink no-underline hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
            {body}
          </Link>
        ) : (
          body
        );
      },
    },
    { id: "spend", label: "Spend", width: 100, align: "right", sortValue: (r) => r.spend, render: (r) => money(r.spend), footer: money(t.spend) },
    { id: "revenue", label: "Revenue", width: 104, align: "right", sortValue: (r) => r.revenue, render: (r) => (r.revenue ? money(r.revenue) : "—"), footer: t.revenue ? money(t.revenue) : "—" },
    {
      id: "roas",
      label: "ROAS",
      width: 72,
      align: "right",
      sortValue: roas,
      render: (r) => (roas(r) === null ? <span className="text-ink-3">—</span> : <span className="text-[15px] font-semibold">{roas(r)!.toFixed(2)}x</span>),
      footer: roas(t) === null ? "—" : `${roas(t)!.toFixed(2)}x`,
    },
    { id: "conv", label: "Conv.", width: 80, align: "right", sortValue: (r) => r.conversions, render: (r) => num(r.conversions), footer: num(t.conversions) },
    { id: "cpa", label: "CPA", width: 84, align: "right", sortValue: cpa, render: (r) => money(cpa(r), false), footer: money(cpa(t), false) },
    { id: "ctr", label: "CTR", width: 72, align: "right", sortValue: ctr, render: (r) => (ctr(r) === null ? "—" : `${ctr(r)!.toFixed(2)}%`), footer: ctr(t) === null ? "—" : `${ctr(t)!.toFixed(2)}%` },
    { id: "cpm", label: "CPM", width: 80, align: "right", sortValue: cpm, render: (r) => money(cpm(r), false), footer: money(cpm(t), false) },
    { id: "impr", label: "Impressions", width: 104, align: "right", defaultHidden: true, sortValue: (r) => r.impressions, render: (r) => num(r.impressions), footer: num(t.impressions) },
    { id: "clicks", label: "Clicks", width: 84, align: "right", defaultHidden: true, sortValue: (r) => r.clicks, render: (r) => num(r.clicks), footer: num(t.clicks) },
  ];

  return (
    <DataGrid
      key={by}
      tableId={`analytics-${by}`}
      label={`Breakdown by ${label.toLowerCase()}`}
      rows={rows}
      getRowId={(r) => r.id}
      columns={columns}
      defaultSort={{ id: "spend", dir: "desc" }}
      loading={loading}
      footerLabel={`Total · ${rows.length}`}
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base font-semibold">Breakdown</span>
          <Segmented label="Break down by" value={by} onChange={onByChange} options={byOptions.map((o) => ({ ...o, label: `By ${o.label.toLowerCase()}` }))} />
          {note && <span className="text-xs text-ink-3">{note}</span>}
        </div>
      }
      empty={<GridEmpty title="No results in this period" body="Pick a longer range, or sync your accounts to pull the latest numbers." />}
    />
  );
}
