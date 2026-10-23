"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Copy, X } from "lucide-react";
import { useApiClient, type InviteResult, type Team, type TeamMember, type WorkspaceRole } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, Dialog } from "@/components/app/ui";
import { ROLE_LABEL, ROLE_SUB } from "./access";

/**
 * D4 Invite teammate (plan B6), also used to change a member's role and
 * client access. Invites are stored and emailed; when email isn't set up on
 * the server the dialog shows the links to share instead.
 */

const ROLES: WorkspaceRole[] = ["MEDIA_BUYER", "ANALYST", "CLIENT_VIEWER"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied");
  } catch {
    toast.error("Couldn't copy. Select the link and copy it.");
  }
}

function RoleCards({ value, onChange }: { value: WorkspaceRole; onChange: (r: WorkspaceRole) => void }) {
  return (
    <div className="grid gap-2 min-[560px]:grid-cols-3" role="radiogroup" aria-label="Role">
      {ROLES.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "flex flex-col gap-0.5 rounded-xl border px-3.5 py-3 text-left transition-colors",
            value === r ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-2"
          )}
        >
          <span className={cn("text-sm font-semibold", value === r && "text-brand-ink")}>{ROLE_LABEL[r]}</span>
          <span className="text-xs text-ink-2">{ROLE_SUB[r]}</span>
        </button>
      ))}
    </div>
  );
}

function ClientChips({ team, value, onChange, required }: { team: Team; value: string[]; onChange: (v: string[]) => void; required: boolean }) {
  if (team.clients.length === 0) return null;
  const all = value.length === 0;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        Client access <span className="font-normal text-ink-3">{required ? "· pick at least one" : "· leave on All for every client"}</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        {!required && (
          <button
            type="button"
            aria-pressed={all}
            onClick={() => onChange([])}
            className={cn("rounded-full border px-3 py-1.5 text-[13px] font-semibold", all ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:text-ink")}
          >
            All clients
          </button>
        )}
        {team.clients.map((c) => {
          const on = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])}
              className={cn("rounded-full border px-3 py-1.5 text-[13px] font-semibold", on ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:text-ink")}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function InviteDialog({ open, team, editing, onClose, onDone }: { open: boolean; team: Team; editing: TeamMember | null; onClose: () => void; onDone: () => void }) {
  const api = useApiClient();
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [role, setRole] = useState<WorkspaceRole>("MEDIA_BUYER");
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmails([]);
    setDraft("");
    setRole(editing?.role && editing.role !== "OWNER" ? editing.role : "MEDIA_BUYER");
    setClientIds(editing?.clientIds ?? []);
    setResults(null);
  }, [open, editing]);

  const addDraft = () => {
    const parts = draft.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const bad = parts.find((e) => !EMAIL_RE.test(e));
    if (bad) return void toast.error(`“${bad}” isn't a valid email.`);
    setEmails((x) => [...new Set([...x, ...parts])].slice(0, 10));
    setDraft("");
  };
  const all = draft.trim() ? [...emails, ...draft.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)] : emails;
  const needsClient = role === "CLIENT_VIEWER" && clientIds.length === 0;
  const seats = team.seats;
  const freeViewers = role === "CLIENT_VIEWER" && seats.clientViewersFree;
  const left = seats.limit === null ? null : Math.max(0, seats.limit - seats.used);
  const overSeats = !editing && !freeViewers && left !== null && all.length > left;

  const submit = async () => {
    if (editing) {
      setBusy(true);
      try {
        await api.updateMember(editing.id, { role, clientIds });
        toast.success(`${editing.name ?? editing.email} is now ${ROLE_LABEL[role].toLowerCase()}`);
        onDone();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That didn't save.");
      } finally {
        setBusy(false);
      }
      return;
    }
    const list = [...new Set(all)];
    const bad = list.find((e) => !EMAIL_RE.test(e));
    if (bad) return void toast.error(`“${bad}” isn't a valid email.`);
    setBusy(true);
    try {
      const r = await api.createInvites({ emails: list, role, clientIds });
      onDone();
      const sent = r.results.filter((x) => x.ok);
      if (sent.length && sent.every((x) => x.emailSent) && sent.length === r.results.length) {
        toast.success(sent.length === 1 ? `Invite sent to ${sent[0].email}` : `${sent.length} invites sent`);
        onClose();
      } else {
        setResults(r.results); // show what failed, and links to share where email didn't go out
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invites didn't go out.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title={editing ? `Change access · ${editing.name ?? editing.email}` : "Invite teammates"}
      sub={editing ? editing.email : seats.limit === null ? "Unlimited seats on your plan" : `${left} of ${seats.limit} seats left${seats.clientViewersFree ? " · client viewers are free" : ""}`}
      width={620}
      footer={
        results ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void submit()} disabled={(!editing && all.length === 0) || needsClient || overSeats}>
              {editing ? "Save access" : all.length > 1 ? `Send ${all.length} invites` : "Send invite"}
            </Button>
          </>
        )
      }
    >
      {results ? (
        <div className="flex flex-col gap-2">
          {results.map((r) => (
            <div key={r.email} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{r.email}</span>
              {!r.ok ? (
                <span className="text-neg">{r.error}</span>
              ) : r.emailSent ? (
                <span className="text-pos">Email sent</span>
              ) : (
                <>
                  <span className="text-ink-2">Email not sent · share the link</span>
                  <Button variant="soft" size="sm" icon={<Copy size={14} />} onClick={() => void copy(r.url!)}>
                    Copy link
                  </Button>
                </>
              )}
            </div>
          ))}
          <p className="text-xs text-ink-3">Links work for 7 days and only for the invited email. Pending invites are listed under Team.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {!editing && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Emails
              <span className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-ctl border border-line-2 bg-surface px-2 py-1.5 focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
                {emails.map((e) => (
                  <span key={e} className="flex items-center gap-1 rounded-full bg-surface-3 py-0.5 pl-2.5 pr-1 text-[13px]">
                    {e}
                    <button type="button" aria-label={`Remove ${e}`} onClick={() => setEmails((x) => x.filter((y) => y !== e))} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-surface">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "," || e.key === " ") {
                      if (draft.trim()) {
                        e.preventDefault();
                        addDraft();
                      }
                    } else if (e.key === "Backspace" && !draft && emails.length) setEmails((x) => x.slice(0, -1));
                  }}
                  onBlur={() => draft.trim() && addDraft()}
                  placeholder={emails.length ? "Add another…" : "name@agency.com, then Enter"}
                  aria-label="Email addresses"
                  className="min-w-[160px] flex-1 border-0 bg-transparent px-1 text-sm font-normal outline-none"
                  autoFocus
                />
              </span>
              <span className="text-xs font-normal text-ink-3">Up to 10 at a time. Each gets a link that works for 7 days.</span>
            </label>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Role</span>
            <RoleCards value={role} onChange={setRole} />
          </div>
          <ClientChips team={team} value={clientIds} onChange={setClientIds} required={role === "CLIENT_VIEWER"} />
          {overSeats && <p className="text-sm text-neg">Your plan has {left} seat{left === 1 ? "" : "s"} left. Remove someone, or upgrade on the pricing page.</p>}
        </div>
      )}
    </Dialog>
  );
}
