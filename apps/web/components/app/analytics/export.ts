import { ratio, r2, type ExportColumn, type ExportRow, type ExportSheet } from "@/components/app/export/formats";

type Totals = { spend: number; revenue: number; conversions: number; impressions: number; clicks: number };
type Named = Totals & { name: string };

/**
 * D6 export of Analytics: the breakdown as shown (by platform, client or
 * campaign). Excel adds a Summary sheet with the KPIs against the previous
 * period.
 */
export function analyticsExport({ byLabel, rows, period, current, previous }: { byLabel: string; rows: Named[]; period: string; current: Totals | null; previous: Totals | null }) {
  // Indexes: 1 spend, 2 revenue, 4 conversions, 8 impressions, 9 clicks.
  const columns: ExportColumn[] = [
    { label: byLabel, width: 36 },
    { label: "Spend", kind: "money", total: "sum" },
    { label: "Revenue", kind: "money", total: "sum" },
    { label: "ROAS", kind: "decimal", total: (s) => (s(2) > 0 ? ratio(s(2), s(1)) : null), money: true },
    { label: "Conversions", kind: "int", total: "sum" },
    { label: "CPA", kind: "money", total: (s) => ratio(s(1), s(4)) },
    { label: "CTR %", kind: "pct", total: (s) => ratio(s(9), s(8), 100) },
    { label: "CPM", kind: "money", total: (s) => ratio(s(1), s(8), 1000) },
    { label: "Impressions", kind: "int", total: "sum" },
    { label: "Clicks", kind: "int", total: "sum" },
  ];
  const out: ExportRow[] = [...rows]
    .sort((a, b) => b.spend - a.spend)
    .map((r) => [
      r.name,
      r2(r.spend),
      r2(r.revenue),
      r.spend > 0 && r.revenue > 0 ? ratio(r.revenue, r.spend) : null,
      r.conversions,
      ratio(r.spend, r.conversions),
      ratio(r.clicks, r.impressions, 100),
      ratio(r.spend, r.impressions, 1000),
      r.impressions,
      r.clicks,
    ]);

  const sheets: ExportSheet[] = [{ name: `By ${byLabel.toLowerCase()}`, rows: out }];
  if (current) {
    const kpis: [string, (t: Totals) => number | null][] = [
      ["Spend", (t) => r2(t.spend)],
      ["Revenue", (t) => r2(t.revenue)],
      ["ROAS", (t) => (t.revenue > 0 ? ratio(t.revenue, t.spend) : null)],
      ["Conversions", (t) => t.conversions],
      ["Cost / conversion", (t) => ratio(t.spend, t.conversions)],
      ["Impressions", (t) => t.impressions],
      ["Clicks", (t) => t.clicks],
      ["CTR %", (t) => ratio(t.clicks, t.impressions, 100)],
    ];
    sheets.unshift({
      name: "Summary",
      totals: false,
      columns: [{ label: `Metric · ${period}`, width: 30 }, { label: "This period", width: 16 }, { label: "Previous period", width: 16 }, { label: "Change %", kind: "pct" }],
      rows: kpis.map(([label, get]) => {
        const c = get(current);
        const p = previous ? get(previous) : null;
        return [label, c, p, c !== null && p ? r2(((c - p) / p) * 100) : null];
      }),
    });
  }
  return { columns, rows: out, sheets, excelSub: current ? "A KPI summary and the breakdown, with totals" : "With totals and number formats" };
}
