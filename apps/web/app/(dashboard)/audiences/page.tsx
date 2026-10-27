"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Copy, ExternalLink, MoreHorizontal, Pencil, Plus, Rocket, Sparkles, Trash2, Users } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAppRouter } from "@/hooks/useAppRouter";
import { useAccess } from "@/components/app/team/access";
import { useApiClient, type AudienceBoardItem, type AudienceBoardTip } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { CellText, DataGrid, FilterMultiSelect, GridEmpty, GridSearch, type GridColumn } from "@/components/app/grid";
import { AiMark, Button, Card, IconButton, Menu, MenuItem, MenuSeparator, Pill, Skeleton, useConfirm } from "@/components/app/ui";
import { AudienceDialog, type DialogTab } from "@/components/app/audiences/AudienceDialog";
import { SOURCE_LABEL, STATUS_TONE, cpaOf, roasOf, sizeHint, sizeText } from "@/components/app/audiences/board";

/**
 * Audiences (guide §5.5, plan A9): stats, verified warnings and lookalike
 * ideas, then one grid of saved audiences (Advertix) and the custom,
 * lookalike and saved audiences on the client's Meta account — size, where
 * each is used, results and status. D2 creates them: describe (AI), build,
 * or lookalike. Overlap is shown only where Advertix can verify it (decision
 * on open question 1): a lookalike next to its unexcluded seed, one audience
 * in several ad sets of a campaign, near-duplicate saved audiences.
 */

const DISMISS_KEY = "advertix.audiences.dismissed";

function useDismissed() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[]);
    } catch {
      /* private mode */
    }
  }, []);
  const dismiss = (key: string) =>
    setDismissed((d) => {
      const next = [...d, key].slice(-100);
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
  return [dismissed, dismiss] as const;
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="flex min-w-0 flex-col gap-1 px-[18px] py-4">
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <span className="truncate text-[26px] font-semibold leading-tight tracking-[-0.03em] tabular-nums">{value}</span>
      <span className="truncate text-xs text-ink-3">{sub}</span>
    </Card>
  );
}

export default function AudiencesPage() {
  const api = useApiClient();
  const router = useAppRouter();
  const { clientId, client, clients, hasMultiple } = useClientScope();
  const board = useApi((c) => c.getAudienceBoard(30, clientId), [clientId], { key: "audience-board" });
  const [dismissed, dismiss] = useDismissed();
  const access = useAccess();
  const canEdit = access.can("edit");
  const [q, setQ] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [types, setTypes] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{ tab: DialogTab; editing: AudienceBoardItem | null; seedKey: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = useMemo(() => board.data?.items ?? [], [board.data]);
  const scopeName = client?.name ?? (hasMultiple ? "All clients" : "Workspace");
  const clientName = (id: string | null) => (!clientId && hasMultiple && id ? clients.find((c) => c.id === id)?.name ?? null : null);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) => (!types.length || types.includes(i.typeLabel)) && (!sources.length || sources.includes(i.source)) && (!needle || `${i.name} ${i.summary}`.toLowerCase().includes(needle))
    );
  }, [items, q, types, sources]);

  const inUse = items.filter((i) => (i.usedIn ?? 0) > 0);
  const checks = items.reduce((n, i) => n + (i.warnings.length ? 1 : 0), 0);
  const best = [...items].filter((i) => roasOf(i) !== null && i.totals.spend > 0).sort((a, b) => roasOf(b)! - roasOf(a)!)[0];
  const tips = (board.data?.tips ?? []).filter((t) => !dismissed.includes(t.key)).slice(0, 4);
  const currency = client?.currency ?? null;

  const refetch = () => void board.refetch();
  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };
  const openInWizard = (i: AudienceBoardItem) => router.push(`/campaigns/new?audience=${i.id}`);
  const remove = async (i: AudienceBoardItem) => {
    if (!(await confirm({ title: `Delete “${i.name}”?`, body: "It's removed from your saved audiences. Campaigns made from it keep their targeting.", confirmLabel: "Delete", danger: true }))) return;
    void run(i.key, () => api.deleteAudience(i.id), "Audience deleted");
  };

  const typeOptions = [...new Set(items.map((i) => i.typeLabel))].sort().map((t) => ({ value: t, label: t, count: items.filter((i) => i.typeLabel === t).length }));
  const sourceOptions = (Object.keys(SOURCE_LABEL) as AudienceBoardItem["source"][])
    .filter((s) => items.some((i) => i.source === s))
    .map((s) => ({ value: s, label: SOURCE_LABEL[s], count: items.filter((i) => i.source === s).length }));

  const columns: GridColumn<AudienceBoardItem>[] = [
    {
      id: "name",
      label: "Audience",
      width: 240,
      grow: 2,
      sortValue: (i) => i.name,
      render: (i) => (
        <CellText strong sub={[clientName(i.clientId), i.summary].filter(Boolean).join(" · ")}>
          <span className="inline-flex items-center gap-1.5">
            {i.aiGenerated && <Sparkles size={13} className="flex-none text-brand" aria-label="Built with Advertix AI" />}
            {i.name}
          </span>
        </CellText>
      ),
    },
    { id: "type", label: "Type", width: 130, sortValue: (i) => i.typeLabel, render: (i) => <span className="text-ink-2">{i.typeLabel}</span> },
    { id: "source", label: "Source", width: 150, defaultHidden: true, sortValue: (i) => i.source, render: (i) => <span className="text-ink-2">{SOURCE_LABEL[i.source]}</span> },
    { id: "size", label: "Size", width: 96, align: "right", sortValue: (i) => i.sizeUpper ?? -1, render: (i) => <span title={sizeHint(i)}>{sizeText(i)}</span> },
    {
      id: "used",
      label: "Used in",
      width: 96,
      align: "right",
      sortValue: (i) => i.usedIn ?? -1,
      render: (i) =>
        i.usedIn === null ? (
          <span className="text-ink-3" title="Meta copies saved audiences into ad sets, so it doesn't report where they're used.">—</span>
        ) : i.usedIn === 0 ? (
          <span className="text-ink-3">None</span>
        ) : (
          <span title={i.campaigns.map((c) => c.name).join("\n")}>{i.usedIn === 1 ? "1 campaign" : `${i.usedIn} campaigns`}</span>
        ),
    },
    { id: "roas", label: "ROAS", width: 80, align: "right", sortValue: (i) => roasOf(i), render: (i) => <span className="font-semibold">{roasOf(i) === null ? "—" : `${roasOf(i)!.toFixed(2)}x`}</span> },
    { id: "cpa", label: "CPA", width: 88, align: "right", sortValue: (i) => cpaOf(i), render: (i) => (cpaOf(i) === null ? "—" : fmtMoney(cpaOf(i)!, currency)) },
    {
      id: "status",
      label: "Status",
      width: 240,
      sortValue: (i) => i.status,
      render: (i) => (
        <span className="flex items-center gap-2">
          <Pill tone={STATUS_TONE[i.status]}>{i.status}</Pill>
          {i.warnings.length > 0 && (
            <span title={i.warnings.map((w) => w.text).join("\n\n")} className="inline-flex items-center gap-1 text-xs font-semibold text-warn">
              <AlertTriangle size={13} aria-hidden="true" />
              {i.warnings.length === 1 ? "1 check" : `${i.warnings.length} checks`}
            </span>
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        kicker={`${scopeName} · audiences`}
        title="Audiences"
        summary={board.loading && !board.data ? "Loading…" : `${items.length} audience${items.length === 1 ? "" : "s"} · ${inUse.length} in use · ${checks} to check`}
        actions={
          <>
            <Button variant="secondary" icon={<Sparkles size={16} />} onClick={() => setDialog({ tab: "describe", editing: null, seedKey: null })} disabled={!canEdit} title={canEdit ? undefined : access.why("edit")}>
              Build with AI
            </Button>
            <Button variant="primary" icon={<Plus size={16} strokeWidth={2.5} />} onClick={() => setDialog({ tab: "build", editing: null, seedKey: null })} disabled={!canEdit} title={canEdit ? undefined : access.why("edit")}>
              Create audience
            </Button>
          </>
        }
      />
      <PageBody className="gap-5">
        {board.loading && !board.data ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[98px] rounded-card" />
              ))}
            </div>
            <Skeleton className="h-[420px] rounded-card" />
          </>
        ) : board.error ? (
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-neg">Couldn’t load audiences: {board.error}</span>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Try again
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
              <Stat label="Audiences" value={String(items.length)} sub={`${items.filter((i) => i.source === "library").length} saved · ${items.filter((i) => i.source !== "library").length} on Meta`} />
              <Stat label="In use" value={String(inUse.length)} sub={inUse.length ? `across ${new Set(inUse.flatMap((i) => i.campaigns.map((c) => c.id))).size} campaigns` : "Not in any campaign yet"} />
              <Stat label="To check" value={String(checks)} sub={checks ? "Verified overlaps or duplicates" : "Nothing to check"} />
              <Stat label="Best ROAS" value={best ? `${roasOf(best)!.toFixed(2)}x` : "—"} sub={best ? best.name : "No results in the last 30 days"} />
            </div>

            {board.data?.metaError && (
              <Card className="flex flex-wrap items-center gap-3 border-warn/40 bg-warn-soft">
                <AlertTriangle size={18} className="flex-none text-warn" aria-hidden="true" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">Meta audiences didn’t load.</span> {board.data.metaError}
                </span>
                <Button variant="secondary" size="sm" onClick={refetch}>
                  Try again
                </Button>
              </Card>
            )}
            {board.data && board.data.metaAccounts.length === 0 && (
              <p className="text-[13px] text-ink-2">
                Custom and lookalike audiences from Meta show here once {client ? `${client.name} has` : "you have"} a Meta ad account.{" "}
                <Link href="/connections" className="font-semibold text-brand no-underline hover:text-brand-hover">
                  Connect one
                </Link>
              </p>
            )}

            {tips.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
                {tips.map((t: AudienceBoardTip) => (
                  <Card key={t.key} className="flex gap-3.5 px-5 py-[18px]">
                    <AiMark size={32} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="flex items-center gap-2 text-xs">
                        <Pill tone={t.kind === "warning" ? "warn" : "brand"}>{t.kind === "warning" ? "Overlap" : "New audience"}</Pill>
                      </span>
                      <span className="font-semibold leading-snug [text-wrap:pretty]">{t.title}</span>
                      <span className="text-[13px] text-ink-2 [text-wrap:pretty]">{t.detail}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {t.kind === "lookalike" && canEdit ? (
                          <Button variant="soft" size="sm" onClick={() => setDialog({ tab: "lookalike", editing: null, seedKey: t.audienceKey })}>
                            Build lookalike
                          </Button>
                        ) : t.campaignId ? (
                          <Button variant="soft" size="sm" icon={<ExternalLink size={14} />} onClick={() => router.push(`/campaigns/${t.campaignId}?tab=adsets`)}>
                            Open ad sets
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => dismiss(t.key)}>
                          Not now
                        </Button>
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <DataGrid
              tableId="audiences"
              label="Audiences"
              rows={filtered}
              getRowId={(i) => i.key}
              columns={columns}
              defaultSort={{ id: "size", dir: "desc" }}
              filters={
                <>
                  <GridSearch value={q} onChange={setQ} placeholder="Filter by name" label="Filter audiences" />
                  {typeOptions.length > 1 && <FilterMultiSelect label="Type" options={typeOptions} value={types} onChange={setTypes} width={220} />}
                  {sourceOptions.length > 1 && <FilterMultiSelect label="Source" options={sourceOptions} value={sources} onChange={setSources} width={260} />}
                </>
              }
              empty={
                items.length === 0 ? (
                  <GridEmpty
                    title="No audiences yet"
                    body="Describe your customer and Advertix drafts real Meta targeting, or build one by hand. Custom and lookalike audiences from Meta appear here too."
                    action={
                      <Button variant="primary" icon={<Sparkles size={16} />} onClick={() => setDialog({ tab: "describe", editing: null, seedKey: null })}>
                        Build with AI
                      </Button>
                    }
                  />
                ) : (
                  <GridEmpty title="No audiences match" body="Try another filter." />
                )
              }
              action={canEdit ? {
                width: 156,
                // One action → its button; saved audiences have several → only the ⋯ menu.
                render: (i) => (
                  <span className="flex items-center justify-end gap-1.5">
                    {i.source === "library" ? null : i.canSeedLookalike ? (
                      <Button variant="soft" size="sm" onClick={() => setDialog({ tab: "lookalike", editing: null, seedKey: i.key })}>
                        Build lookalike
                      </Button>
                    ) : i.warnings[0]?.campaignId ? (
                      <Button variant="soft" size="sm" onClick={() => router.push(`/campaigns/${i.warnings[0].campaignId}?tab=adsets`)}>
                        Open ad sets
                      </Button>
                    ) : null}
                    {i.source === "library" && (
                      <Menu
                        align="end"
                        width={200}
                        trigger={(p) => (
                          <IconButton {...p} label={`Actions for ${i.name}`} size={32} disabled={busy === i.key}>
                            <MoreHorizontal size={16} />
                          </IconButton>
                        )}
                      >
                        {(close) => (
                          <>
                            <MenuItem icon={<Rocket size={15} />} onSelect={() => (close(), openInWizard(i))}>
                              Use in campaign
                            </MenuItem>
                            <MenuItem icon={<Pencil size={15} />} onSelect={() => (close(), setDialog({ tab: "build", editing: i, seedKey: null }))}>
                              Edit
                            </MenuItem>
                            <MenuItem icon={<Copy size={15} />} onSelect={() => (close(), void run(i.key, () => api.duplicateAudience(i.id), "Audience duplicated"))}>
                              Duplicate
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem icon={<Trash2 size={15} />} onSelect={() => (close(), remove(i))}>
                              <span className="text-neg">Delete</span>
                            </MenuItem>
                          </>
                        )}
                      </Menu>
                    )}
                  </span>
                ),
              } : undefined}
            />
            <p className="flex items-start gap-1.5 text-xs text-ink-3">
              <Users size={13} className="mt-px flex-none" aria-hidden="true" />
              Results cover the last 30 days. Saved audiences count the campaigns made from them; Meta custom audiences count the synced ad sets that target them.
            </p>
          </>
        )}
      </PageBody>

      <AudienceDialog
        open={dialog !== null}
        initialTab={dialog?.tab ?? "build"}
        editing={dialog?.editing ?? null}
        seedKey={dialog?.seedKey ?? null}
        board={board.data}
        clientId={clientId}
        onClose={() => setDialog(null)}
        onSaved={refetch}
      />
      {confirmDialog}
    </>
  );
}
