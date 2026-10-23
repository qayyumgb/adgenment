"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";
import { Copy, MoreHorizontal, Pencil, RefreshCw, Trash2, UserPlus, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type TeamMember, type WorkspaceRole } from "@/lib/api";
import { cn } from "@/lib/cn";
import { CellText, DataGrid, type GridColumn } from "@/components/app/grid";
import { Button, Card, IconButton, Menu, MenuItem, MenuSeparator, Pill, Skeleton, type PillTone } from "@/components/app/ui";
import { InviteDialog } from "./InviteDialog";
import { ROLE_LABEL, useAccess } from "./access";

/**
 * Settings › Team (plan B6): members with role and client access, pending
 * invites (copy link, resend, cancel), seats used against the plan, and the
 * D4 invite dialog. Only owners change anything; others see the list.
 */

const ROLE_TONE: Record<WorkspaceRole, PillTone> = { OWNER: "brand", MEDIA_BUYER: "pos", ANALYST: "neutral", CLIENT_VIEWER: "warn" };
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export function TeamPanel() {
  const api = useApiClient();
  const access = useAccess();
  const team = useApi((c) => c.getTeam(), [], { key: "team" });
  const [dialog, setDialog] = useState<{ editing: TeamMember | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const manage = access.can("team");
  const data = team.data;

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      void team.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  };

  if (team.loading && !data) return <Skeleton className="h-[360px] rounded-card" />;
  if (team.error || !data) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load the team: {team.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void team.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? "Removed client";
  const accessText = (ids: string[], role: WorkspaceRole) => (role === "OWNER" || ids.length === 0 ? "All clients" : ids.map(clientName).join(", "));
  const { seats } = data;
  const full = seats.limit !== null && seats.used >= seats.limit;
  const pct = seats.limit ? Math.min(100, (seats.used / seats.limit) * 100) : 0;

  const columns: GridColumn<TeamMember>[] = [
    {
      id: "name",
      label: "Member",
      width: 240,
      grow: 2,
      sortValue: (m) => m.name ?? m.email,
      render: (m) => (
        <CellText strong sub={m.email}>
          {m.name ?? m.email}
          {m.isYou && <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span>}
        </CellText>
      ),
    },
    { id: "role", label: "Role", width: 140, sortValue: (m) => m.role, render: (m) => <Pill tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Pill> },
    { id: "access", label: "Client access", width: 200, grow: 1, render: (m) => <CellText>{accessText(m.clientIds, m.role)}</CellText> },
    { id: "joined", label: "Joined", width: 110, sortValue: (m) => m.joinedAt, render: (m) => new Date(m.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1.5">
          <span className="text-base font-semibold">Seats</span>
          <span className="text-[13px] text-ink-2">
            {seats.limit === null ? `${seats.used} in use, pending invites included · unlimited on your plan` : `${seats.used} of ${seats.limit} in use, pending invites included`}
            {seats.clientViewersFree ? " · client viewers don’t use a seat" : ""}
          </span>
          {seats.limit !== null && (
            <span className="relative h-1.5 max-w-[360px] rounded-full bg-surface-3">
              <span className={cn("absolute inset-y-0 left-0 rounded-full", full ? "bg-warn" : "bg-brand")} style={{ width: `${pct}%` }} />
            </span>
          )}
        </div>
        {full && (
          <Link href="/pricing" className="text-[13px] font-semibold text-brand no-underline hover:text-brand-hover">
            Need more seats?
          </Link>
        )}
        <span title={!manage ? access.why("team") : full ? "Every seat is in use. Client viewers are free on Agency and Enterprise." : undefined}>
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setDialog({ editing: null })} disabled={!manage}>
            Invite teammates
          </Button>
        </span>
      </Card>

      <DataGrid
        tableId="team"
        label="Team members"
        rows={data.members}
        getRowId={(m) => m.id}
        columns={columns}
        filters={
          <div className="mr-auto flex flex-col leading-tight">
            <span className="text-base font-semibold">Members</span>
            <span className="text-[13px] text-ink-2">{data.members.length} people</span>
          </div>
        }
        action={
          manage
            ? {
                width: 64,
                render: (m) =>
                  m.role === "OWNER" || m.isYou ? null : (
                    <Menu
                      align="end"
                      width={200}
                      trigger={(p) => (
                        <IconButton {...p} label={`Manage ${m.name ?? m.email}`} size={32} disabled={busy === m.id}>
                          <MoreHorizontal size={16} />
                        </IconButton>
                      )}
                    >
                      {(close) => (
                        <>
                          <MenuItem icon={<Pencil size={15} />} onSelect={() => (close(), setDialog({ editing: m }))}>
                            Change role or access
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem
                            icon={<Trash2 size={15} />}
                            onSelect={() => {
                              close();
                              if (window.confirm(`Remove ${m.name ?? m.email} from the workspace? They lose access straight away.`)) {
                                void run(m.id, () => api.removeMember(m.id), `${m.name ?? m.email} removed`);
                              }
                            }}
                          >
                            <span className="text-neg">Remove from workspace</span>
                          </MenuItem>
                        </>
                      )}
                    </Menu>
                  ),
              }
            : undefined
        }
      />

      {data.invites.length > 0 && (
        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <span className="text-base font-semibold">Pending invites</span>
          </div>
          <ul>
            {data.invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                <span className="flex min-w-0 flex-[1_1_240px] flex-col leading-snug">
                  <span className="truncate font-medium">{i.email}</span>
                  <span className="truncate text-xs text-ink-2">
                    {ROLE_LABEL[i.role]} · {accessText(i.clientIds, i.role)}
                    {i.invitedBy ? ` · invited by ${i.invitedBy}` : ""}
                  </span>
                </span>
                <span className={cn("text-xs", i.expired ? "text-neg" : "text-ink-2")}>{i.expired ? "Expired" : `Expires in ${daysLeft(i.expiresAt)} day${daysLeft(i.expiresAt) === 1 ? "" : "s"}`}</span>
                <span className={cn("max-w-[260px] text-xs", i.emailSent ? "text-ink-3" : "text-warn")} title={i.emailError ?? undefined}>
                  {i.emailSent ? "Email sent" : "Email not sent · share the link"}
                </span>
                {manage && (
                  <span className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" icon={<Copy size={14} />} onClick={() => void copy(i.url)}>
                      Copy link
                    </Button>
                    <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} loading={busy === i.id} onClick={() => void run(i.id, () => api.resendInvite(i.id), i.expired ? "Invite renewed and resent" : "Invite resent")}>
                      {i.expired ? "Renew" : "Resend"}
                    </Button>
                    <IconButton label={`Cancel invite for ${i.email}`} size={32} onClick={() => void run(i.id, () => api.revokeInvite(i.id), "Invite cancelled")}>
                      <X size={15} />
                    </IconButton>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <InviteDialog open={dialog !== null} team={data} editing={dialog?.editing ?? null} onClose={() => setDialog(null)} onDone={() => void team.refetch()} />
    </div>
  );
}
