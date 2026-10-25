"use client";

import Link from "next/link";
import { useAppRouter } from "@/hooks/useAppRouter";
import { useAccess } from "@/components/app/team/access";
import type { ReactNode } from "react";
import { Check, Copy, ExternalLink, MoreHorizontal, Pause, Play, Rocket, Sparkles, Trash2, Clock } from "lucide-react";
import type { Campaign, Suggestion } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { BulkButton, CellText, DataGrid, type GridColumn, type GridDisplay } from "@/components/app/grid";
import { Button, IconButton, Menu, MenuItem, MenuSeparator, PlatformBadge, StatusPill, Toggle, type PlatformKey } from "@/components/app/ui";
import { canToggle, isReadOnlySync, needsPublish, type useCampaignMutations } from "./useCampaignMutations";
import type { useSuggestions } from "@/components/app/suggestions/useSuggestions";

export type CampaignRow = {
  c: Campaign;
  clientName: string | null;
  currency: string | null;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  suggestion: Suggestion | null;
};

const STATUS_LABEL: Record<Campaign["status"], string> = { ACTIVE: "Active", PAUSED: "Paused", DRAFT: "Draft", ENDED: "Ended" };

/** Active Meta campaigns show their ad sets' learning phase (B4). */
const statusLabel = (c: Campaign) =>
  c.status === "ACTIVE" && c.learning === "LEARNING" ? "Learning" : c.status === "ACTIVE" && c.learning === "LIMITED" ? "Learning limited" : STATUS_LABEL[c.status];
const roasOf = (r: CampaignRow) => (r.spend > 0 ? r.revenue / r.spend : null);
const PLATFORM_NAME: Record<string, string> = { GOOGLE: "Google Ads", TIKTOK: "TikTok Ads Manager", LINKEDIN: "LinkedIn Campaign Manager" };

/** "OUTCOME_SALES" → "Sales", "LINK_CLICKS" → "Link clicks". */
export function objectiveLabel(o: string) {
  const s = o.replace(/^OUTCOME_/, "").replace(/_/g, " ").toLowerCase().trim();
  return s && s !== "unknown" ? s[0].toUpperCase() + s.slice(1) : "";
}

function SuggestionCell({ s }: { s: Suggestion | null }) {
  if (!s) return <span className="text-[13px] text-ink-3">—</span>;
  if (s.status === "APPLIED") {
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-pos">
        <Check size={14} strokeWidth={2.5} className="flex-none" aria-hidden="true" />
        <CellText>{s.doneLabel ?? "Applied"}</CellText>
      </span>
    );
  }
  if (s.status === "SNOOZED") return <span className="text-[13px] text-ink-3">Snoozed 7 days</span>;
  return (
    <span className="min-w-0 text-[13px] text-ink-2">
      <CellText title={`${s.title} — ${s.reason}`}>{s.title}</CellText>
    </span>
  );
}

/**
 * Campaigns DataGrid (plan A5): status toggles, suggestion column, sticky
 * Action column with the suggestion's Apply / Review (or Open / Publish) and
 * a row menu, selection with the bulk bar, footer totals.
 */
export function CampaignsGrid({
  rows,
  loading,
  filters,
  empty,
  footerLabel,
  mutations,
  suggestions,
  onEditBudgets,
  onDuplicate,
}: {
  rows: CampaignRow[];
  loading: boolean;
  filters: ReactNode;
  empty: ReactNode;
  footerLabel: string;
  mutations: ReturnType<typeof useCampaignMutations>;
  suggestions: ReturnType<typeof useSuggestions>;
  onEditBudgets: (campaigns: Campaign[]) => void;
  /** One campaign: the D7 dialog (name and budget for the copy). */
  onDuplicate: (campaign: Campaign) => void;
}) {
  const router = useAppRouter();
  // Read-only roles (B6): no toggles, Apply, menus or selection.
  const canEdit = useAccess().can("edit");
  const sum = (pick: (r: CampaignRow) => number) => rows.reduce((n, r) => n + pick(r), 0);
  // Footer money uses the first row's currency; the page warns when currencies mix.
  const cur = rows[0]?.currency ?? null;
  const totalSpend = sum((r) => r.spend);
  const totalRevenue = sum((r) => r.revenue);
  const dailyLive = sum((r) => (r.c.status === "ACTIVE" && r.c.budgetType === "DAILY" ? Number(r.c.budget) || 0 : 0));

  const columns: GridColumn<CampaignRow>[] = [
    {
      id: "name",
      label: "Campaign",
      width: 240,
      grow: 1.6,
      sortValue: (r) => r.c.name,
      render: (r) => (
        <Link href={`/campaigns/${r.c.id}`} className="block min-w-0 text-ink no-underline hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
          <CellText strong sub={[r.clientName, objectiveLabel(r.c.objective)].filter(Boolean).join(" · ")}>
            {r.c.name}
          </CellText>
        </Link>
      ),
    },
    {
      id: "platform",
      label: "Platform",
      width: 110,
      sortValue: (r) => r.c.platform,
      render: (r) => <PlatformBadge platform={r.c.platform as PlatformKey} size={22} withName />,
    },
    {
      id: "status",
      label: "Status",
      width: 176,
      sortValue: (r) => statusLabel(r.c),
      render: (r) => (
        <span className="flex items-center gap-2.5">
          {canToggle(r.c) && canEdit && (
            <Toggle
              checked={r.c.status === "ACTIVE"}
              disabled={mutations.busy(r.c.id)}
              onChange={() => void mutations.toggle(r.c)}
              label={`${r.c.status === "ACTIVE" ? "Pause" : "Resume"} ${r.c.name}`}
            />
          )}
          <span title={isReadOnlySync(r.c) ? `Change the status in ${PLATFORM_NAME[r.c.platform] ?? "the platform"}` : undefined}>
            <StatusPill status={statusLabel(r.c)} />
          </span>
        </span>
      ),
    },
    {
      id: "budget",
      label: "Budget / day",
      width: 104,
      align: "right",
      sortValue: (r) => Number(r.c.budget) || 0,
      render: (r) =>
        Number(r.c.budget) > 0 ? (
          <CellText sub={r.c.budgetType === "LIFETIME" ? "lifetime" : undefined}>{fmtMoney(Number(r.c.budget), r.currency, { whole: true })}</CellText>
        ) : (
          <span className="text-ink-3" title="Set on the ad sets">—</span>
        ),
      footer: dailyLive > 0 ? `${fmtMoney(dailyLive, cur, { whole: true })} live` : undefined,
    },
    {
      id: "spend",
      label: "Spend",
      width: 100,
      align: "right",
      sortValue: (r) => r.spend,
      render: (r) => (r.spend > 0 ? fmtMoney(r.spend, r.currency, { whole: true }) : <span className="text-ink-3">—</span>),
      footer: fmtMoney(totalSpend, cur, { whole: true }),
    },
    {
      id: "roas",
      label: "ROAS",
      width: 76,
      align: "right",
      sortValue: roasOf,
      render: (r) => {
        const v = roasOf(r);
        return v === null || r.revenue === 0 ? <span className="text-ink-3">—</span> : <span className="text-[15px] font-semibold">{v.toFixed(2)}x</span>;
      },
      footer: totalSpend > 0 && totalRevenue > 0 ? <span className="text-[15px]">{(totalRevenue / totalSpend).toFixed(2)}x</span> : undefined,
    },
    {
      id: "conv",
      label: "Conversions",
      width: 96,
      align: "right",
      sortValue: (r) => r.conversions,
      render: (r) => r.conversions.toLocaleString("en-US"),
      footer: sum((r) => r.conversions).toLocaleString("en-US"),
    },
    {
      id: "ctr",
      label: "CTR",
      width: 72,
      align: "right",
      defaultHidden: true,
      sortValue: (r) => (r.impressions > 0 ? r.clicks / r.impressions : null),
      render: (r) => (r.impressions > 0 ? `${((r.clicks / r.impressions) * 100).toFixed(2)}%` : <span className="text-ink-3">—</span>),
    },
    {
      id: "reach",
      label: "Reach",
      width: 90,
      align: "right",
      defaultHidden: true,
      sortValue: (r) => r.c.reach ?? 0,
      render: (r) => ((r.c.reach ?? 0) > 0 ? (r.c.reach ?? 0).toLocaleString("en-US") : <span className="text-ink-3">—</span>),
    },
    {
      id: "sugg",
      label: "Advertix suggests",
      header: (
        <span className="flex items-center gap-1.5 font-semibold text-brand-ink">
          <Sparkles size={13} strokeWidth={2.25} aria-hidden="true" />
          Advertix suggests
        </span>
      ),
      width: 240,
      grow: 2,
      render: (r) => <SuggestionCell s={r.suggestion} />,
    },
  ];

  /** The row's main button: suggestion Apply / Review, then Undo; else Publish or Open. */
  const primaryAction = (r: CampaignRow, h: string): ReactNode => {
    const s = r.suggestion;
    let primary: ReactNode;
    if (!canEdit) {
      primary = (
        <Button variant="secondary" size="sm" className={cn(h, "font-medium")} onClick={() => router.push(`/campaigns/${r.c.id}`)}>
          Open
        </Button>
      );
    } else if (s?.status === "OPEN") {
      primary = s.executable ? (
        <Button variant="soft" className={h} loading={suggestions.busy === s.id} onClick={() => void suggestions.apply(s)}>
          {s.actionLabel}
        </Button>
      ) : (
        <Button variant="soft" className={h} onClick={() => router.push(s.reviewHref ?? `/campaigns/${r.c.id}`)}>
          Review
        </Button>
      );
    } else if (s && (s.status === "APPLIED" || s.status === "SNOOZED") && suggestions.canUndo(s)) {
      primary = (
        <Button variant="ghost" className={cn(h, "font-semibold text-brand hover:bg-brand-soft hover:text-brand")} loading={suggestions.busy === s.id} onClick={() => void suggestions.undo(s)}>
          Undo
        </Button>
      );
    } else if (needsPublish(r.c)) {
      primary = (
        <Button variant="secondary" size="sm" className={cn(h, "font-medium")} icon={<Rocket size={14} />} onClick={() => router.push(`/campaigns/new?from=${r.c.id}`)}>
          Publish
        </Button>
      );
    } else {
      primary = (
        <Button variant="secondary" size="sm" className={cn(h, "font-medium")} onClick={() => router.push(`/campaigns/${r.c.id}`)}>
          Open
        </Button>
      );
    }

    return primary;
  };

  const rowMenu = (r: CampaignRow) => {
    if (!canEdit) return null;
    const s = r.suggestion;
    return (
        <Menu
          align="end"
          width={220}
          trigger={(p) => (
            <IconButton {...p} label={`More actions for ${r.c.name}`} size={32} disabled={mutations.busy(r.c.id)}>
              <MoreHorizontal size={17} />
            </IconButton>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<ExternalLink size={15} />} onSelect={() => (close(), router.push(`/campaigns/${r.c.id}`))}>
                Open
              </MenuItem>
              {needsPublish(r.c) && (
                <MenuItem icon={<Rocket size={15} />} onSelect={() => (close(), router.push(`/campaigns/new?from=${r.c.id}`))}>
                  Publish to Meta
                </MenuItem>
              )}
              {canToggle(r.c) && canEdit && (
                <MenuItem icon={r.c.status === "ACTIVE" ? <Pause size={15} /> : <Play size={15} />} onSelect={() => (close(), void mutations.toggle(r.c))}>
                  {r.c.status === "ACTIVE" ? "Pause" : "Resume"}
                </MenuItem>
              )}
              {s?.status === "OPEN" && (
                <MenuItem icon={<Clock size={15} />} onSelect={() => (close(), void suggestions.snooze(s))}>
                  Not now (7 days)
                </MenuItem>
              )}
              <MenuItem icon={<Copy size={15} />} onSelect={() => (close(), onDuplicate(r.c))}>
                Duplicate…
              </MenuItem>
              <MenuSeparator />
              <button
                type="button"
                role="menuitem"
                onClick={() => (close(), void mutations.remove(r.c))}
                className="flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-[9px] text-left text-sm text-neg transition-colors hover:bg-neg-soft focus-visible:bg-neg-soft focus-visible:outline-none"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </>
          )}
        </Menu>
    );
  };

  const actionCell = (r: CampaignRow, d: GridDisplay) => (
    <span className="flex w-full items-center justify-between gap-1.5">
      {primaryAction(r, d.density === "compact" ? "h-7" : "h-8")}
      {rowMenu(r)}
    </span>
  );

  const card = (r: CampaignRow) => {
    const s = r.suggestion;
    const roas = roasOf(r);
    const metric = (label: string, value: ReactNode) => (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-medium text-ink-3">{label}</span>
        <span className="truncate text-[15px] font-semibold tabular-nums" title={typeof value === "string" ? value : undefined}>
          {value}
        </span>
      </span>
    );
    return (
      <div key={r.c.id} role="listitem" className="flex min-w-0 flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <PlatformBadge platform={r.c.platform as PlatformKey} size={22} withName />
          <span className="flex items-center gap-2">
            {canToggle(r.c) && canEdit && (
              <Toggle
                checked={r.c.status === "ACTIVE"}
                disabled={mutations.busy(r.c.id)}
                onChange={() => void mutations.toggle(r.c)}
                label={`${r.c.status === "ACTIVE" ? "Pause" : "Resume"} ${r.c.name}`}
              />
            )}
            <span title={isReadOnlySync(r.c) ? `Change the status in ${PLATFORM_NAME[r.c.platform] ?? "the platform"}` : undefined}>
              <StatusPill status={statusLabel(r.c)} />
            </span>
          </span>
        </div>
        <Link href={`/campaigns/${r.c.id}`} className="min-w-0 text-ink no-underline hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
          <div className="truncate font-semibold" title={r.c.name}>
            {r.c.name}
          </div>
          <div className="truncate text-xs text-ink-2">{[r.clientName, objectiveLabel(r.c.objective)].filter(Boolean).join(" · ") || " "}</div>
        </Link>
        <div className="grid grid-cols-3 gap-2 rounded-ctl bg-surface-2 px-3 py-2.5">
          {metric("Spend", r.spend > 0 ? fmtMoney(r.spend, r.currency, { whole: true }) : "—")}
          {metric("ROAS", roas === null || r.revenue === 0 ? "—" : `${roas.toFixed(2)}x`)}
          {metric("Conversions", r.conversions.toLocaleString("en-US"))}
        </div>
        <div className="text-xs text-ink-2">
          {Number(r.c.budget) > 0
            ? `${fmtMoney(Number(r.c.budget), r.currency, { whole: true })}${r.c.budgetType === "DAILY" ? " / day" : " lifetime"}`
            : "Budget set on the ad sets"}
          {(r.c.reach ?? 0) > 0 && ` · ${(r.c.reach ?? 0).toLocaleString("en-US")} reached`}
        </div>
        {s && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-ctl px-3 py-2 text-[13px]",
              s.status === "APPLIED" ? "bg-pos-soft text-pos" : s.status === "SNOOZED" ? "bg-surface-2 text-ink-3" : "bg-brand-soft text-brand-ink"
            )}
          >
            {s.status === "APPLIED" ? (
              <Check size={14} strokeWidth={2.5} className="mt-0.5 flex-none" aria-hidden="true" />
            ) : (
              <Sparkles size={14} strokeWidth={2.25} className="mt-0.5 flex-none" aria-hidden="true" />
            )}
            <span className="line-clamp-2 min-w-0">
              {s.status === "APPLIED" ? s.doneLabel ?? "Applied" : s.status === "SNOOZED" ? "Snoozed 7 days" : s.title}
            </span>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
          {primaryAction(r, "h-8")}
          {rowMenu(r)}
        </div>
      </div>
    );
  };

  return (
    <DataGrid
      tableId="campaigns"
      label="Campaigns"
      rows={rows}
      getRowId={(r) => r.c.id}
      columns={columns}
      defaultSort={{ id: "spend", dir: "desc" }}
      loading={loading}
      selectable={canEdit}
      rowLabel={(r) => `Select ${r.c.name}`}
      filters={filters}
      empty={empty}
      footerLabel={footerLabel}
      action={{ width: 200, render: actionCell }}
      renderCards={(rs) => rs.map(card)}
      bulkActions={({ rows: sel, clear }) => {
        const cs = sel.map((r) => r.c);
        const pausable = cs.filter((c) => canToggle(c) && c.status === "ACTIVE").length;
        const resumable = cs.filter((c) => canToggle(c) && c.status === "PAUSED").length;
        return (
          <>
            <BulkButton disabled={!pausable} title={pausable ? undefined : "None of these can be paused"} onClick={() => void mutations.pauseMany(cs).then(clear)}>
              Pause{pausable && pausable !== cs.length ? ` ${pausable}` : ""}
            </BulkButton>
            <BulkButton disabled={!resumable} title={resumable ? undefined : "None of these are paused"} onClick={() => void mutations.resumeMany(cs).then(clear)}>
              Resume{resumable && resumable !== cs.length ? ` ${resumable}` : ""}
            </BulkButton>
            <BulkButton onClick={() => onEditBudgets(cs)}>Edit budgets</BulkButton>
            <BulkButton onClick={() => (cs.length === 1 ? (onDuplicate(cs[0]), clear()) : void mutations.duplicateMany(cs).then(clear))}>Duplicate</BulkButton>
          </>
        );
      }}
    />
  );
}
