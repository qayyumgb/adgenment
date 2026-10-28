"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type Client } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { CellText, DataGrid, type GridColumn } from "@/components/app/grid";
import { Button, ButtonLink, Card, Dialog, IconButton, Menu, MenuItem, MenuSeparator, PlatformBadge, Skeleton, type PlatformKey } from "@/components/app/ui";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { useAccess } from "@/components/app/team/access";
import { ClientDialog } from "./ClientDialog";

/**
 * Settings › Clients: the brands this workspace runs ads for. Owners add,
 * edit and delete them (delete moves everything to another client); others
 * see the list. Ad accounts are assigned in Connections.
 */

function DeleteClientDialog({ client, clients, onClose, onDone }: { client: Client | null; clients: Client[]; onClose: () => void; onDone: () => void }) {
  const api = useApiClient();
  const others = clients.filter((c) => c.id !== client?.id);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setMoveTo(others[0]?.id ?? ""), [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = others.find((c) => c.id === moveTo);

  const remove = async () => {
    if (!client || !moveTo) return;
    setBusy(true);
    try {
      await api.deleteClient(client.id, moveTo);
      toast.success(`${client.name} deleted. Everything moved to ${target?.name ?? "the other client"}.`);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the client.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={client !== null}
      onClose={onClose}
      title={client ? `Delete ${client.name}?` : ""}
      width={500}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} disabled={!moveTo} onClick={() => void remove()}>
            Delete and move
          </Button>
        </>
      }
    >
      {client && (
        <div className="flex flex-col gap-3.5 text-sm">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
            Move its ad accounts and history to
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="h-10 rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft">
              {others.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <ul className="m-0 flex flex-col gap-1.5 pl-5 text-[13px] text-ink-2">
            <li>
              {client.adAccountCount} ad account{client.adAccountCount === 1 ? "" : "s"} and {client.campaignCount} campaign{client.campaignCount === 1 ? "" : "s"}, its creatives, audiences, plans, suggestions and change history move to {target?.name ?? "that client"}.
            </li>
            <li>Teammates limited to {client.name} get {target?.name ?? "that client"} instead.</li>
            <li>Its portal link and scheduled report stop, and its approval and automation settings go.</li>
            <li>Nothing changes on the ad platforms.</li>
          </ul>
        </div>
      )}
    </Dialog>
  );
}

/** `adding`: the page header's "Add client" button opens the dialog here. */
export function ClientsTab({ adding, onAddingChange }: { adding: boolean; onAddingChange: (v: boolean) => void }) {
  const access = useAccess();
  const manage = access.can("clients");
  const { refreshClients } = useClientScope();
  const q = useApi((c) => c.getClients(), [], { key: "clients" });
  const clients = q.data?.clients ?? [];
  const unassigned = q.data?.unassignedAdAccounts ?? 0;
  const [editing, setEditing] = useState<{ client: Client | null } | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const done = () => void (refreshClients(), q.refetch());

  const columns: GridColumn<Client>[] = [
    {
      id: "name",
      label: "Client",
      width: 220,
      grow: 2,
      sortValue: (c) => c.name,
      render: (c) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-3 text-[11px] font-semibold">{c.short}</span>
          <CellText strong sub={c.vertical ?? (c.isDefault ? "Created with the workspace" : undefined)}>
            {c.name}
          </CellText>
        </span>
      ),
    },
    {
      id: "accounts",
      label: "Ad accounts",
      width: 150,
      sortValue: (c) => c.adAccountCount,
      render: (c) =>
        c.adAccountCount ? (
          <span className="flex items-center gap-1.5">
            <span className="tabular-nums">{c.adAccountCount}</span>
            {c.platforms.map((p) => (
              <PlatformBadge key={p} platform={p as PlatformKey} size={20} />
            ))}
          </span>
        ) : (
          <span className="text-ink-3">None yet</span>
        ),
    },
    { id: "campaigns", label: "Campaigns", width: 110, align: "right", sortValue: (c) => c.campaignCount, render: (c) => <span className="tabular-nums">{c.campaignCount}</span> },
    {
      id: "budget",
      label: "Monthly budget",
      width: 150,
      align: "right",
      sortValue: (c) => c.monthlyBudget ?? -1,
      render: (c) => (c.monthlyBudget == null ? <span className="text-ink-3">Not set</span> : <span className="tabular-nums">{fmtMoney(c.monthlyBudget, c.currency, { whole: true })}</span>),
    },
  ];

  if (q.error) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load clients: {q.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!q.data) return <Skeleton className="h-[320px] rounded-card" />;

  return (
    <div className="flex flex-col gap-5">
      {unassigned > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-card border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
          <span className="min-w-0 flex-1">
            <strong>
              {unassigned} ad account{unassigned === 1 ? " isn't" : "s aren't"} assigned to a client.
            </strong>{" "}
            Their campaigns don’t show when you pick a client.
          </span>
          <ButtonLink href="/connections?filter=unassigned" variant="secondary" size="sm">
            Assign in Connections
          </ButtonLink>
        </div>
      )}
      <DataGrid
        tableId="clients"
        label="Clients"
        rows={clients}
        getRowId={(c) => c.id}
        columns={columns}
        filters={
          <div className="mr-auto flex flex-col leading-tight">
            <span className="text-base font-semibold">Clients</span>
            <span className="text-[13px] text-ink-2">
              {clients.length === 1 ? "One client. Add another to switch between them." : `${clients.length} clients`}
              {!manage && ` · ${access.why("clients")}`}
            </span>
          </div>
        }
        action={
          manage
            ? {
                width: 64,
                render: (c) => (
                  <Menu
                    align="end"
                    width={200}
                    trigger={(p) => (
                      <IconButton {...p} label={`Manage ${c.name}`} size={32}>
                        <MoreHorizontal size={16} />
                      </IconButton>
                    )}
                  >
                    {(close) => (
                      <>
                        <MenuItem icon={<Pencil size={15} />} onSelect={() => (close(), setEditing({ client: c }))}>
                          Edit name and budget
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={<Trash2 size={15} />} disabled={clients.length <= 1} onSelect={() => (close(), setDeleting(c))}>
                          <span className={clients.length <= 1 ? "" : "text-neg"}>{clients.length <= 1 ? "Delete (needs another client)" : "Delete client"}</span>
                        </MenuItem>
                      </>
                    )}
                  </Menu>
                ),
              }
            : undefined
        }
      />
      <p className="m-0 text-[13px] text-ink-2">
        Assign ad accounts to clients in{" "}
        <Link href="/connections" className="font-medium text-brand no-underline hover:text-brand-hover">
          Connections
        </Link>
        , and limit teammates to some clients in Team.
      </p>
      <ClientDialog open={editing !== null || adding} editing={editing?.client ?? null} onClose={() => (setEditing(null), onAddingChange(false))} onSaved={done} />
      <DeleteClientDialog client={deleting} clients={clients} onClose={() => setDeleting(null)} onDone={done} />
    </div>
  );
}
