import { ratio, r2, type ExportColumn, type ExportRow, type ExportSheet } from "@/components/app/export/formats";
import type { AnalyticsOverview } from "@/lib/api";

/**
 * D6 export of the Overview: one row per day (spend, revenue, ROAS,
 * conversions). Excel adds a Summary sheet with the KPI cards against the
 * previous period.
 */
export function overviewExport({ days, overview, period }: { days: { date: string; spend: number; revenue: number; conversions: number }[]; overview: AnalyticsOverview | null; period: string }) {
  // Indexes: 1 spend, 2 revenue, 4 conversions.
  const columns: ExportColumn[] = [
    { label: "Date", width: 12 },
    { label: "Spend", kind: "money", total: "sum" },
    { label: "Revenue", kind: "money", total: "sum" },
    { label: "ROAS", kind: "decimal", total: (s) => (s(2) > 0 ? ratio(s(2), s(1)) : null), money: true },
    { label: "Conversions", kind: "int", total: "sum" },
    { label: "CPA", kind: "money", total: (s) => ratio(s(1), s(4)) },
  ];
  const rows: ExportRow[] = days.map((d) => [d.date, r2(d.spend), r2(d.revenue), d.spend > 0 && d.revenue > 0 ? ratio(d.revenue, d.spend) : null, d.conversions, ratio(d.spend, d.conversions)]);

  const sheets: ExportSheet[] = [{ name: "Daily", rows }];
  if (overview) {
    const cur = overview;
    const prev = overview.previous ?? null;
    const kpis: [string, number | null, number | null][] = [
      ["Spend", r2(cur.spend), prev ? r2(prev.spend) : null],
      ["Revenue", r2(cur.revenue), prev ? r2(prev.revenue) : null],
      ["ROAS", cur.revenue > 0 ? ratio(cur.revenue, cur.spend) : null, prev && prev.revenue > 0 ? ratio(prev.revenue, prev.spend) : null],
      ["Conversions", cur.conversions, prev ? prev.conversions : null],
      ["Cost / conversion", ratio(cur.spend, cur.conversions), prev ? ratio(prev.spend, prev.conversions) : null],
      ["Impressions", cur.impressions, prev ? prev.impressions : null],
      ["Clicks", cur.clicks, prev ? prev.clicks : null],
    ];
    sheets.unshift({
      name: "Summary",
      totals: false,
      columns: [{ label: `Metric · ${period}`, width: 30 }, { label: "This period", width: 16 }, { label: "Previous period", width: 16 }, { label: "Change %", kind: "pct" }],
      rows: kpis.map(([label, c, p]) => [label, c, p, c !== null && p ? r2(((c - p) / p) * 100) : null]),
    });
  }
  return { columns, rows, sheets, excelSub: "A KPI summary and the daily numbers, with totals" };
}
