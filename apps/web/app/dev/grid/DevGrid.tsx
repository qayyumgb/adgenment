"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/shell/AppShell";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { Button, PlatformBadge, Segmented, StatusPill, Toggle, type PlatformKey } from "@/components/app/ui";
import {
  BulkButton,
  CellText,
  DataGrid,
  FilterMultiSelect,
  GridEmpty,
  GridSearch,
  type GridColumn,
} from "@/components/app/grid";

type Row = {
  id: string;
  name: string;
  client: string;
  objective: string;
  platform: PlatformKey;
  status: "Active" | "Learning" | "Paused" | "Draft";
  budget: number;
  spend: number;
  roas: number | null;
  conv: number;
  suggestion: string | null;
};

// Demo data for the dev preview only.
const SEED: Row[] = [
  { id: "c1", name: "Autumn sale — prospecting broad", client: "Northwind", objective: "Sales", platform: "META", status: "Active", budget: 1200, spend: 18420, roas: 4.21, conv: 812, suggestion: "Raise budget 20% — ROAS 4.2x is 38% above target and spend is capped by 11am" },
  { id: "c2", name: "Brand search — exact", client: "Northwind", objective: "Sales", platform: "GOOGLE", status: "Active", budget: 400, spend: 9310, roas: 6.02, conv: 604, suggestion: null },
  { id: "c3", name: "UGC hooks test v3", client: "Lumen Skin", objective: "Traffic", platform: "TIKTOK", status: "Learning", budget: 250, spend: 2140, roas: 1.84, conv: 96, suggestion: "Creative fatigue: CTR down 31% in 5 days on 2 of 4 ads" },
  { id: "c4", name: "Retargeting — 30 day site visitors with a very long name that should truncate", client: "Lumen Skin", objective: "Sales", platform: "META", status: "Paused", budget: 300, spend: 6020, roas: 3.12, conv: 288, suggestion: null },
  { id: "c5", name: "B2B lead gen — decision makers", client: "Atlas Freight", objective: "Leads", platform: "LINKEDIN", status: "Active", budget: 500, spend: 7450, roas: null, conv: 141, suggestion: "Narrow targeting: 62% of spend reaches seniority below Manager" },
  { id: "c6", name: "Holiday teaser", client: "Atlas Freight", objective: "Awareness", platform: "GOOGLE", status: "Draft", budget: 800, spend: 0, roas: null, conv: 0, suggestion: null },
];

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function DevGrid() {
  const [rows, setRows] = useState(SEED);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const view = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (platforms.length === 0 || platforms.includes(r.platform)) &&
      r.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const setStatusOf = (ids: string[], next: Row["status"]) =>
    setRows((rs) => rs.map((r) => (ids.includes(r.id) && r.status !== "Draft" ? { ...r, status: next } : r)));

  const totalSpend = view.reduce((n, r) => n + r.spend, 0);
  const columns: GridColumn<Row>[] = [
    {
      id: "name",
      label: "Campaign",
      width: 240,
      grow: 1.6,
      sortValue: (r) => r.name,
      render: (r) => (
        <CellText strong sub={`${r.client} · ${r.objective}`}>
          {r.name}
        </CellText>
      ),
    },
    { id: "platform", label: "Platform", width: 110, render: (r) => <PlatformBadge platform={r.platform} size={22} withName /> },
    {
      id: "status",
      label: "Status",
      width: 150,
      sortValue: (r) => r.status,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          {r.status !== "Draft" && (
            <Toggle
              checked={r.status !== "Paused"}
              onChange={(on) => setStatusOf([r.id], on ? "Active" : "Paused")}
              label={r.status === "Paused" ? `Resume ${r.name}` : `Pause ${r.name}`}
            />
          )}
          <StatusPill status={r.status} />
        </span>
      ),
    },
    { id: "budget", label: "Budget / day", width: 100, align: "right", sortValue: (r) => r.budget, render: (r) => money(r.budget), footer: money(view.reduce((n, r) => n + r.budget, 0)) },
    { id: "spend", label: "Spend", width: 100, align: "right", sortValue: (r) => r.spend, render: (r) => money(r.spend), footer: money(totalSpend) },
    {
      id: "roas",
      label: "ROAS",
      width: 80,
      align: "right",
      sortValue: (r) => r.roas,
      render: (r) => (r.roas === null ? <span className="text-ink-3">—</span> : <span className="text-[15px] font-semibold">{r.roas.toFixed(2)}x</span>),
    },
    { id: "conv", label: "Conversions", width: 100, align: "right", sortValue: (r) => r.conv, render: (r) => r.conv.toLocaleString("en-US"), footer: view.reduce((n, r) => n + r.conv, 0).toLocaleString("en-US") },
    {
      id: "sugg",
      label: "Advertix suggests",
      width: 220,
      grow: 1.4,
      render: (r) => (r.suggestion ? <CellText className="text-[13px]">{r.suggestion}</CellText> : <span className="text-[13px] text-ink-3">No suggestion</span>),
    },
    { id: "cpa", label: "Cost / conversion", width: 120, align: "right", defaultHidden: true, sortValue: (r) => (r.conv ? r.spend / r.conv : null), render: (r) => (r.conv ? `$${(r.spend / r.conv).toFixed(2)}` : "—") },
  ];

  return (
    <AppShell>
      <PageHeader
        kicker="Development preview"
        title="DataGrid"
        summary="Sort, Columns, Row height, sticky Action, selection + bulk bar, footer totals. Preferences persist per table."
        actions={
          <Button variant="secondary" onClick={() => setLoading((l) => !l)}>
            {loading ? "Show rows" : "Show loading"}
          </Button>
        }
      />
      <PageBody>
        <DataGrid
          tableId="dev-campaigns"
          label="Campaigns"
          rows={view}
          getRowId={(r) => r.id}
          columns={columns}
          defaultSort={{ id: "spend", dir: "desc" }}
          loading={loading}
          selectable
          rowLabel={(r) => `Select ${r.name}`}
          footerLabel={`Total · ${view.length} of ${rows.length}`}
          filters={
            <>
              <GridSearch value={query} onChange={setQuery} />
              <Segmented
                label="Status"
                value={status}
                onChange={setStatus}
                className="max-w-full overflow-x-auto"
                options={[
                  { value: "all", label: "All", count: counts.all },
                  ...(["Active", "Learning", "Paused", "Draft"] as const).map((s) => ({ value: s, label: s, count: counts[s] ?? 0 })),
                ]}
              />
              <FilterMultiSelect
                label="Platform"
                value={platforms}
                onChange={setPlatforms}
                options={(["META", "GOOGLE", "TIKTOK", "LINKEDIN"] as const).map((p) => ({
                  value: p,
                  label: p === "META" ? "Meta" : p === "GOOGLE" ? "Google" : p === "TIKTOK" ? "TikTok" : "LinkedIn",
                  icon: <PlatformBadge platform={p} size={20} />,
                  count: rows.filter((r) => r.platform === p).length,
                }))}
              />
            </>
          }
          empty={
            <GridEmpty
              title="No campaigns match these filters"
              body={`Try another status or platform, or clear filters to see all ${rows.length} campaigns.`}
              action={
                <Button
                  variant="secondary"
                  size="toolbar"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                    setPlatforms([]);
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          }
          action={{
            width: 156,
            render: (r, d) =>
              r.suggestion ? (
                <Button variant="soft" className={d.density === "compact" ? "h-7" : undefined}>
                  Review
                </Button>
              ) : (
                <Button variant="secondary" size="sm" className={d.density === "compact" ? "h-7 font-medium" : "font-medium"}>
                  Open
                </Button>
              ),
          }}
          bulkActions={({ ids, clear }) => (
            <>
              <BulkButton onClick={() => (setStatusOf(ids, "Paused"), clear())}>Pause</BulkButton>
              <BulkButton onClick={() => (setStatusOf(ids, "Active"), clear())}>Resume</BulkButton>
              <BulkButton disabled title="Coming soon">
                Edit budgets
              </BulkButton>
              <BulkButton disabled title="Coming soon">
                Duplicate
              </BulkButton>
            </>
          )}
        />
      </PageBody>
    </AppShell>
  );
}
