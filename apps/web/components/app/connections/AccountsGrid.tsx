"use client";

import type { ConnectionAccount } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { CellText, DataGrid, type GridColumn } from "@/components/app/grid";
import { Button, Menu, MenuItem, Pill, PlatformBadge, Segmented, type PlatformKey } from "@/components/app/ui";
import { NEEDS_ATTENTION, PLATFORM_NAME, STATUS_LABEL, STATUS_TONE } from "./useConnectPlatform";

/**
 * Ad accounts (plan A13): every connected account with its client, 30-day
 * spend, status and last sync, filtered by All / Needs attention /
 * Unassigned / Archived, with the action each status needs.
 */

export type GridFilter = "all" | "attention" | "unassigned" | "archived";

export function AccountsGrid({
  accounts,
  loading,
  hasClients,
  clients,
  filter,
  setFilter,
  canConnect,
  canAssign,
  busy,
  onOpen,
  onRenew,
  onAssign,
  onArchive,
  onRestore,
}: {
  accounts: ConnectionAccount[];
  loading: boolean;
  hasClients: boolean;
  clients: { id: string; name: string }[];
  filter: GridFilter;
  setFilter: (f: GridFilter) => void;
  canConnect: boolean;
  canAssign: boolean;
  busy: string | null;
  onOpen: (a: ConnectionAccount, pixel?: boolean) => void;
  onRenew: (a: ConnectionAccount) => void;
  onAssign: (a: ConnectionAccount, clientId: string) => void;
  onArchive: (a: ConnectionAccount) => void;
  onRestore: (a: ConnectionAccount) => void;
}) {
  const live = accounts.filter((a) => a.status !== "ARCHIVED");
  // Any account without a client, even when another issue (pixel, token) is its main status.
  const unassigned = hasClients ? live.filter((a) => !a.clientId) : [];
  const counts = {
    all: live.length,
    attention: live.filter((a) => NEEDS_ATTENTION.includes(a.status)).length,
    unassigned: unassigned.length,
    archived: accounts.length - live.length,
  };
  const rows =
    filter === "attention" ? live.filter((a) => NEEDS_ATTENTION.includes(a.status)) : filter === "unassigned" ? unassigned : filter === "archived" ? accounts.filter((a) => a.status === "ARCHIVED") : live;

  const columns: GridColumn<ConnectionAccount>[] = [
    {
      id: "account",
      label: "Account",
      width: 260,
      grow: 2,
      sortValue: (a) => a.accountName.toLowerCase(),
      render: (a) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <PlatformBadge platform={a.platform as PlatformKey} size={26} />
          <CellText strong sub={<span className="font-mono">{a.accountId}</span>}>
            {a.accountName}
          </CellText>
        </span>
      ),
    },
    { id: "platform", label: "Platform", width: 110, sortValue: (a) => a.platform, render: (a) => PLATFORM_NAME[a.platform] ?? a.platform },
    ...(hasClients ? [{ id: "client", label: "Client", width: 170, sortValue: (a: ConnectionAccount) => a.clientName ?? "~", render: (a: ConnectionAccount) => (a.clientName ? a.clientName : <span className="text-ink-3">Not assigned</span>) }] : []),
    { id: "currency", label: "Currency", width: 84, defaultHidden: false, sortValue: (a) => a.currency ?? "", render: (a) => a.currency ?? "—" },
    { id: "spend", label: "Spend · 30d", width: 120, align: "right", sortValue: (a) => a.spend30d, render: (a) => (a.spend30d ? fmtMoney(a.spend30d, a.currency, { whole: true }) : "—") },
    {
      id: "status",
      label: "Status",
      width: 150,
      sortValue: (a) => STATUS_LABEL[a.status] ?? a.status,
      render: (a) => (
        <span title={a.statusDetail ?? undefined}>
          <Pill tone={STATUS_TONE[a.status] ?? "neutral"}>{STATUS_LABEL[a.status] ?? "Updating…"}</Pill>
        </span>
      ),
    },
    {
      id: "sync",
      label: "Last sync",
      width: 120,
      sortValue: (a) => (a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0),
      render: (a) => (a.status === "ARCHIVED" && a.archivedAt ? `Archived ${timeAgo(a.archivedAt)}` : a.lastSyncedAt ? timeAgo(a.lastSyncedAt) : a.isActive ? "Not yet" : "—"),
    },
  ];

  const action = (a: ConnectionAccount) => {
    const disabled = !canConnect || busy === a.id;
    switch (a.status) {
      case "TOKEN_EXPIRING":
      case "TOKEN_EXPIRED":
        return (
          <Button variant="soft" size="sm" disabled={disabled} onClick={() => onRenew(a)}>
            Renew
          </Button>
        );
      case "PIXEL_ISSUE":
        return (
          <Button variant="soft" size="sm" onClick={() => onOpen(a, true)}>
            Fix pixel
          </Button>
        );
      case "BLOCKED":
        return (
          <Button variant="soft" size="sm" onClick={() => onOpen(a)}>
            Review
          </Button>
        );
      case "UNASSIGNED":
        return canAssign ? (
          <Menu
            align="end"
            width={220}
            trigger={(p) => (
              <Button {...p} variant="soft" size="sm" disabled={busy === a.id}>
                Assign client
              </Button>
            )}
          >
            {(close) =>
              clients.map((c) => (
                <MenuItem key={c.id} onSelect={() => (close(), onAssign(a, c.id))}>
                  {c.name}
                </MenuItem>
              ))
            }
          </Menu>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => onOpen(a)}>
            Open
          </Button>
        );
      case "INACTIVE":
        return (
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onArchive(a)}>
            Archive
          </Button>
        );
      case "ARCHIVED":
        return (
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onRestore(a)}>
            Restore
          </Button>
        );
      default:
        return (
          <Button variant="secondary" size="sm" onClick={() => onOpen(a)}>
            Open
          </Button>
        );
    }
  };

  const tabs = [
    { value: "all" as const, label: "All", count: counts.all },
    { value: "attention" as const, label: "Needs attention", count: counts.attention },
    ...(hasClients ? [{ value: "unassigned" as const, label: "Unassigned", count: counts.unassigned }] : []),
    ...(counts.archived ? [{ value: "archived" as const, label: "Archived", count: counts.archived }] : []),
  ];

  return (
    <DataGrid
      tableId="connections-accounts"
      label="Ad accounts"
      rows={rows}
      getRowId={(a) => a.id}
      columns={columns}
      loading={loading}
      defaultSort={{ id: "spend", dir: "desc" }}
      rowLabel={(a) => a.accountName}
      filters={
        <div className="mr-auto flex min-w-0 max-w-full flex-wrap items-center gap-3">
          <span className="text-base font-semibold">Ad accounts</span>
          <div className="max-w-full overflow-x-auto">
            <Segmented label="Filter accounts" size="sm" value={filter} onChange={setFilter} options={tabs} />
          </div>
        </div>
      }
      empty={
        <div className="px-5 py-10 text-center text-sm text-ink-2">
          {filter === "attention" ? "Nothing needs attention." : filter === "unassigned" ? "Every account is assigned to a client." : filter === "archived" ? "No archived accounts." : "No ad accounts yet. Connect one to start syncing spend and results."}
        </div>
      }
      action={{ width: 150, render: action }}
    />
  );
}
