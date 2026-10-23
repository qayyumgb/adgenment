"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pencil } from "lucide-react";
import { useApiClient, type ClientPacing, type PacingResponse, type PacingStatus } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { CellText, DataGrid, type GridColumn } from "@/components/app/grid";
import { Button, Dialog, IconButton, Pill, type PillTone } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";

/**
 * Monthly pacing (guide §5.6, plan A11): each client's month-to-date spend
 * against its monthly budget, a bar with today's marker, a straight-line
 * projection and a plain note. Owners set the budget inline; the action opens
 * the allocator for that client (fitted to what's left of the month).
 */

const STATUS: Record<PacingStatus, { label: string; tone: PillTone }> = {
  ON_TRACK: { label: "On track", tone: "pos" },
  AHEAD: { label: "Ahead", tone: "warn" },
  BEHIND: { label: "Behind", tone: "warn" },
  NO_BUDGET: { label: "No budget", tone: "neutral" },
  NO_SPEND: { label: "No spend", tone: "neutral" },
};

function BudgetDialog({ row, onClose, onSaved }: { row: ClientPacing | null; onClose: () => void; onSaved: () => void }) {
  const api = useApiClient();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(row?.monthlyBudget ? String(row.monthlyBudget) : ""), [row]);
  const n = Number(value);
  const save = async (clear = false) => {
    if (!row) return;
    setBusy(true);
    try {
      await api.updateClient(row.clientId, { monthlyBudget: clear ? null : Math.round(n * 100) / 100 });
      toast.success(clear ? "Monthly budget removed" : "Monthly budget saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Didn't save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      title="Monthly budget"
      sub={row?.name}
      width={420}
      footer={
        <>
          {row?.monthlyBudget != null && (
            <Button variant="ghost" onClick={() => void save(true)} disabled={busy} className="mr-auto">
              Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={() => void save()} disabled={!(n > 0)}>
            Save
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Spend cap for each calendar month
        <span className="flex h-10 items-center gap-2 rounded-ctl border border-line-2 bg-surface px-3 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
          <input type="number" inputMode="decimal" min={1} value={value} onChange={(e) => setValue(e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent tabular-nums outline-none" autoFocus />
          <span className="text-ink-3">{row?.currency ?? ""} / month</span>
        </span>
        <span className="text-xs font-normal text-ink-2">Used for pacing and “fit to the monthly budget”. It doesn’t change anything on the platforms by itself.</span>
      </label>
    </Dialog>
  );
}

export function PacingGrid({ data, loading, onPlan, onChanged }: { data: PacingResponse | null; loading: boolean; onPlan: (clientId: string, fit: boolean) => void; onChanged: () => void }) {
  const access = useAccess();
  const [editing, setEditing] = useState<ClientPacing | null>(null);
  const canSetBudget = access.can("clients");
  const monthName = data ? new Date(`${data.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }) : "";
  const money = (n: number, c: string | null) => fmtMoney(n, c, { whole: true });
  const note = (r: ClientPacing) =>
    r.status === "AHEAD" && r.runOutDay
      ? `Runs out ${r.runOutDay} ${monthName.slice(0, 3)} at today’s rate`
      : r.status === "BEHIND" && r.unspentProjected
        ? `${money(r.unspentProjected, r.currency)} would go unspent`
        : r.status === "ON_TRACK"
          ? "Spending to plan"
          : r.status === "NO_BUDGET"
            ? "No monthly budget set"
            : "No spend yet this month";

  const columns: GridColumn<ClientPacing>[] = [
    { id: "name", label: "Client", width: 200, grow: 1, sortValue: (r) => r.name, render: (r) => <CellText strong sub={r.mixedCurrency ? "Accounts in different currencies (raw sum)" : undefined}>{r.name}</CellText> },
    {
      id: "budget",
      label: `${monthName} budget`,
      width: 150,
      align: "right",
      sortValue: (r) => r.monthlyBudget ?? -1,
      render: (r) => (
        <span className="flex items-center justify-end gap-1">
          {r.monthlyBudget != null ? money(r.monthlyBudget, r.currency) : <span className="text-ink-3">—</span>}
          {canSetBudget && (
            <IconButton label={`Set ${r.name}'s monthly budget`} size={32} onClick={() => setEditing(r)}>
              <Pencil size={13} />
            </IconButton>
          )}
        </span>
      ),
    },
    { id: "spent", label: "Spent so far", width: 140, align: "right", sortValue: (r) => r.spent, render: (r) => `${money(r.spent, r.currency)}${r.spentPct != null ? ` · ${Math.round(r.spentPct)}%` : ""}` },
    {
      id: "bar",
      label: "Pacing",
      width: 170,
      grow: 1,
      sortValue: (r) => r.spentPct ?? -1,
      render: (r) => (
        <span className="relative block h-2 w-full rounded-full bg-surface-3" title={r.monthlyBudget ? `${Math.round(r.spentPct ?? 0)}% spent, ${data?.expectedPct}% of the month gone` : undefined}>
          {r.spentPct != null && <span className={cn("absolute inset-y-0 left-0 rounded-full", r.status === "ON_TRACK" ? "bg-brand" : "bg-warn")} style={{ width: `${Math.min(100, r.spentPct)}%` }} />}
          {data && r.monthlyBudget != null && <span className="absolute -top-1 h-4 w-[2px] rounded-full bg-ink" style={{ left: `${data.expectedPct}%` }} />}
        </span>
      ),
    },
    { id: "proj", label: "Projected", width: 110, align: "right", sortValue: (r) => r.projected, render: (r) => money(r.projected, r.currency) },
    { id: "status", label: "Status", width: 110, sortValue: (r) => r.status, render: (r) => <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill> },
    { id: "note", label: "Advertix note", width: 220, grow: 1, render: (r) => <CellText>{note(r)}</CellText> },
  ];

  return (
    <>
      <DataGrid
        tableId="budget-pacing"
        label="Monthly pacing"
        rows={data?.clients ?? []}
        getRowId={(r) => r.clientId}
        columns={columns}
        loading={loading}
        defaultSort={{ id: "bar", dir: "desc" }}
        filters={
          <div className="mr-auto flex flex-col leading-tight">
            <span className="text-base font-semibold">{monthName} pacing</span>
            <span className="text-[13px] text-ink-2">{data ? `Day ${data.dayOfMonth} of ${data.daysInMonth} · the line on each bar marks today` : "Loading…"}</span>
          </div>
        }
        action={{
          width: 150,
          render: (r) =>
            r.status === "NO_BUDGET" ? (
              canSetBudget ? (
                <Button variant="soft" size="sm" onClick={() => setEditing(r)}>
                  Set budget
                </Button>
              ) : null
            ) : r.status === "AHEAD" || r.status === "BEHIND" ? (
              <Button variant="soft" size="sm" onClick={() => onPlan(r.clientId, true)}>
                {r.status === "AHEAD" ? "Lower budgets" : "Raise budgets"}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => onPlan(r.clientId, false)}>
                Plan
              </Button>
            ),
        }}
      />
      <BudgetDialog row={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
    </>
  );
}
