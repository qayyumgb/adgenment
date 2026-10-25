import { PLATFORM_META, type PlatformKey } from "@/components/app/ui";
import { ratio, r2, type ExportColumn, type ExportRow, type ExportSheet } from "@/components/app/export/formats";
import type { CampaignRow } from "./CampaignsGrid";
import { objectiveLabel } from "./CampaignsGrid";

/** D6 export of the Campaigns grid: the filtered rows by spend; Excel gets one sheet per platform. */
export function campaignsExport(rows: CampaignRow[], days: number, clientName: (id: string | null | undefined) => string | null) {
  // Indexes below match this order: 8 spend, 9 revenue, 11 conversions, 12 clicks, 13 impressions.
  const columns: ExportColumn[] = [
    { label: "Campaign", width: 36 },
    { label: "Client", width: 22 },
    { label: "Platform", width: 12 },
    { label: "Status", width: 10 },
    { label: "Objective", width: 16 },
    { label: "Budget", kind: "money" },
    { label: "Budget type", width: 12 },
    { label: "Currency", kind: "currency", width: 10 },
    { label: `Spend (${days}d)`, kind: "money", total: "sum" },
    { label: `Revenue (${days}d)`, kind: "money", total: "sum" },
    { label: "ROAS", kind: "decimal", total: (s) => (s(9) > 0 ? ratio(s(9), s(8)) : null), money: true },
    { label: "Conversions", kind: "int", total: "sum" },
    { label: "Clicks", kind: "int", total: "sum" },
    { label: "Impressions", kind: "int", total: "sum" },
    { label: "CTR %", kind: "pct", total: (s) => ratio(s(12), s(13), 100) },
    { label: "Reach", kind: "int" },
    { label: "Advertix suggests", width: 40 },
  ];
  const sorted = [...rows].sort((a, b) => b.spend - a.spend);
  const toRow = (r: CampaignRow): ExportRow => [
    r.c.name,
    clientName(r.c.adAccount?.clientId) ?? "",
    PLATFORM_META[r.c.platform as PlatformKey]?.name ?? r.c.platform,
    r.c.status,
    objectiveLabel(r.c.objective),
    Number(r.c.budget) || 0,
    r.c.budgetType,
    r.currency ?? "",
    r2(r.spend),
    r2(r.revenue),
    r.spend > 0 && r.revenue > 0 ? ratio(r.revenue, r.spend) : null,
    r.conversions,
    r.clicks,
    r.impressions,
    ratio(r.clicks, r.impressions, 100),
    r.c.reach ?? 0,
    r.suggestion?.status === "OPEN" ? r.suggestion.title : "",
  ];
  const out = sorted.map(toRow);
  const platforms = Array.from(new Set(sorted.map((r) => r.c.platform)));
  const sheets: ExportSheet[] =
    platforms.length > 1
      ? [{ name: "All campaigns", rows: out }, ...platforms.map((p) => ({ name: PLATFORM_META[p as PlatformKey]?.name ?? p, rows: sorted.filter((r) => r.c.platform === p).map(toRow) }))]
      : [{ name: "Campaigns", rows: out }];
  return { columns, rows: out, sheets, excelSub: platforms.length > 1 ? "One sheet per platform, with totals" : "With totals and number formats" };
}
