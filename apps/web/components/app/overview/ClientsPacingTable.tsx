"use client";

import { useApi } from "@/hooks/useApi";
import type { ClientPacing, Platform } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { CellText, DataGrid, GridEmpty, type GridColumn } from "@/components/app/grid";
import { Button, PlatformBadge, type PlatformKey } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Row = {
  id: string;
  /** Null for spend on ad accounts not assigned to a client. */
  clientId: string | null;
  name: string;
  short: string;
  vertical: string | null;
  platforms: Platform[];
  spend: number;
  revenue: number;
  roas: number;
  currency: string | null;
  pacing: ClientPacing | null;
};

const STATUS_LABEL: Record<ClientPacing["status"], string> = {
  ON_TRACK: "On track",
  AHEAD: "Ahead",
  BEHIND: "Behind",
  NO_BUDGET: "No monthly budget",
  NO_SPEND: "No spend yet",
};

function note(p: ClientPacing | null, monthShort: string, currency: string | null): { text: string; dot: string } {
  if (!p) return { text: "Assign these ad accounts to a client", dot: "bg-warn" };
  const mixed = p.mixedCurrency ? " · mixed currencies" : "";
  switch (p.status) {
    case "AHEAD":
      return { text: `Budget runs out ${p.runOutDay ?? "early"} ${monthShort}${mixed}`, dot: "bg-neg" };
    case "BEHIND":
      return { text: `Underspending by ${fmtMoney(p.unspentProjected ?? 0, p.currency ?? currency, { whole: true })} this month${mixed}`, dot: "bg-warn" };
    case "ON_TRACK":
      return { text: `On pace for the month${mixed}`, dot: "bg-pos" };
    case "NO_SPEND":
      return { text: "No spend this month", dot: "bg-ink-3" };
    default:
      return { text: "Set a monthly budget to track pacing", dot: "bg-ink-3" };
  }
}

function PacingCell({ p, expectedPct }: { p: ClientPacing | null; expectedPct: number }) {
  if (!p || p.status === "NO_BUDGET" || p.spentPct === null) {
    return <span className="text-xs text-ink-3">{p ? STATUS_LABEL[p.status] : "—"}</span>;
  }
  const off = p.status === "AHEAD" || p.status === "BEHIND";
  return (
    <span className="flex w-full flex-col gap-1.5">
      <span className="relative h-1.5 rounded-full bg-surface-3">
        <span className={cn("absolute inset-y-0 left-0 rounded-full", off ? "bg-warn" : "bg-brand")} style={{ width: `${Math.min(100, p.spentPct)}%` }} />
        <span
          title={`Today: ${Math.round(expectedPct)}% of the month`}
          className="absolute -bottom-[3px] -top-[3px] w-0.5 rounded-sm bg-ink"
          style={{ left: `${Math.min(100, expectedPct)}%` }}
        />
      </span>
      <span className="text-xs text-ink-2">
        <span className={cn("font-semibold", off ? "text-warn" : "text-pos")}>{STATUS_LABEL[p.status]}</span> · {Math.round(p.spentPct)}% spent
      </span>
    </span>
  );
}

/** Client table with this month's pacing (Overview, guide §5.1). Shown when the workspace has more than one client. */
export function ClientsPacingTable({ currency }: { currency: string | null }) {
  const { clients, setClient } = useClientScope();
  const byClient = useApi((c) => c.getAnalyticsByClient(30), [], { key: "analytics-by-client" });
  const pacing = useApi((c) => c.getPacing(), [], { key: "pacing" });

  const pace = pacing.data;
  const [, monthNum] = (pace?.month ?? "").split("-").map(Number);
  const monthName = monthNum ? MONTHS[monthNum - 1] : "";
  const monthShort = monthName.slice(0, 3);

  const rows: Row[] = (byClient.data ?? [])
    .filter((b) => b.clientId !== null || b.spend > 0)
    .map((b) => {
      const p = pace?.clients.find((c) => c.clientId === b.clientId) ?? null;
      const meta = clients.find((c) => c.id === b.clientId);
      return {
        id: b.clientId ?? "unassigned",
        clientId: b.clientId,
        name: b.clientId ? b.name : "Not assigned",
        short: b.clientId ? b.short : "—",
        vertical: meta?.vertical ?? null,
        platforms: b.platforms,
        spend: b.spend,
        revenue: b.revenue,
        roas: b.roas,
        currency: p?.currency ?? meta?.currency ?? currency,
        pacing: p,
      };
    });

  const money = (r: Row, n: number) => fmtMoney(n, r.currency, { whole: true });
  const columns: GridColumn<Row>[] = [
    {
      id: "client",
      label: "Client",
      width: 190,
      grow: 2,
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-ctl bg-surface-3 text-xs font-semibold">{r.short}</span>
          <CellText strong sub={r.vertical ?? undefined}>
            {r.name}
          </CellText>
        </span>
      ),
    },
    {
      id: "platforms",
      label: "Platforms",
      width: 100,
      render: (r) => (
        <span className="flex gap-1">
          {r.platforms.map((p) => (
            <span key={p} title={p}>
              <PlatformBadge platform={p as PlatformKey} size={22} />
            </span>
          ))}
        </span>
      ),
    },
    { id: "spend", label: "Spend", width: 88, align: "right", sortValue: (r) => r.spend, render: (r) => money(r, r.spend) },
    { id: "revenue", label: "Revenue", width: 88, align: "right", sortValue: (r) => r.revenue, render: (r) => money(r, r.revenue) },
    {
      id: "roas",
      label: "ROAS",
      width: 64,
      align: "right",
      sortValue: (r) => (r.spend > 0 ? r.roas : null),
      render: (r) => (r.spend > 0 ? <span className="text-[15px] font-semibold">{r.roas.toFixed(2)}x</span> : <span className="text-ink-3">—</span>),
    },
    {
      id: "budget",
      label: "Monthly budget",
      width: 150,
      grow: 1.3,
      sortValue: (r) => r.pacing?.spentPct ?? null,
      render: (r) => <PacingCell p={r.pacing} expectedPct={pace?.expectedPct ?? 0} />,
    },
    {
      id: "note",
      label: "Advertix note",
      width: 180,
      grow: 1.8,
      render: (r) => {
        const n = note(r.pacing, monthShort, r.currency);
        return (
          <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
            <span className={cn("h-[7px] w-[7px] flex-none rounded-full", n.dot)} aria-hidden="true" />
            <CellText>{n.text}</CellText>
          </span>
        );
      },
    },
  ];

  return (
    <DataGrid
      tableId="overview-clients"
      label="Clients"
      rows={rows}
      getRowId={(r) => r.id}
      columns={columns}
      defaultSort={{ id: "spend", dir: "desc" }}
      loading={byClient.loading || pacing.loading}
      filters={
        <div className="mr-auto flex flex-col leading-tight">
          <span className="text-base font-semibold">Clients</span>
          <span className="text-[13px] text-ink-2">
            Last 30 days{pace ? ` · ${monthName} pacing · day ${pace.dayOfMonth} of ${pace.daysInMonth}` : ""}
          </span>
        </div>
      }
      empty={
        byClient.error ? (
          <GridEmpty title="Couldn’t load clients" body="Check your connection and try again." action={<Button variant="secondary" size="toolbar" onClick={() => void byClient.refetch()}>Try again</Button>} />
        ) : (
          <GridEmpty title="No client spend yet" body="Spend shows here once your clients’ ad accounts sync." />
        )
      }
      action={{
        width: 96,
        render: (r) =>
          r.clientId ? (
            <Button variant="secondary" size="sm" className="font-medium" onClick={() => setClient(r.clientId)}>
              View
            </Button>
          ) : null,
      }}
    />
  );
}
