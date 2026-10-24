"use client";

import { useEffect, useMemo, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient, type UpdateWorkspaceInput } from "@/lib/api";
import { Button, Card, Dialog, Segmented, Skeleton } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import type { SettingsSaver } from "./types";

/**
 * Settings › General (guide §5 Settings, plan A14): agency profile, reporting
 * defaults (time zone and week start, used by weekly summaries and alert
 * timing), your login (Clerk: name, email, password, two-step, sessions) and
 * deleting the workspace (owner only).
 */

// The same lists onboarding offers, so stored values always show.
const INDUSTRIES = ["E-commerce", "SaaS / Software", "Marketing Agency", "Education", "Healthcare", "Finance", "Real Estate", "Travel & Hospitality", "Media & Entertainment", "Non-profit", "Other"];
const COMPANY_SIZES = [
  { id: "1", label: "Just me" },
  { id: "2-10", label: "2–10 people" },
  { id: "11-50", label: "11–50 people" },
  { id: "51-200", label: "51–200 people" },
  { id: "201+", label: "201+ people" },
];

type Form = { name: string; website: string; industry: string; companySize: string; timezone: string; weekStartsOn: number };

const field = "h-10 w-full rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-2";

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink-2">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

function DeleteWorkspaceDialog({ open, onClose, name }: { open: boolean; onClose: () => void; name: string }) {
  const api = useApiClient();
  const { signOut } = useClerk();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setTyped(""), [open]);
  const go = async () => {
    setBusy(true);
    try {
      const r = await api.deleteWorkspace(typed);
      if (r.loginError) toast.error(r.loginError, { duration: 10000 });
      else toast.success("Workspace deleted");
      await signOut({ redirectUrl: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The workspace wasn't deleted.");
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      title="Delete this workspace?"
      sub="This can't be undone."
      width={500}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} disabled={typed.trim() !== name.trim()} onClick={() => void go()}>
            Delete workspace
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-ink-2">
        <p>
          Deletes <strong className="text-ink">{name}</strong> and everything in it: clients, connected ad accounts and their synced data, campaigns, creatives, audiences, plans, history and pending invites. Teammates lose access. Your Advertix login is deleted too, unless you belong to another workspace.
        </p>
        <p>Nothing changes on Meta, Google, TikTok or LinkedIn: campaigns there keep running. Disconnecting Advertix in each platform&apos;s settings also revokes its access.</p>
        <Labeled label={`Type ${name} to confirm`}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className={field} autoComplete="off" aria-label="Workspace name" />
        </Labeled>
      </div>
    </Dialog>
  );
}

export function GeneralTab({ setSaver }: { setSaver: (s: SettingsSaver | null) => void }) {
  const api = useApiClient();
  const access = useAccess();
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const q = useApi((c) => c.getWorkspace(), [], { key: "workspace" });
  const ws = q.data;
  const canEdit = access.can("workspace");
  const initial = useMemo<Form | null>(
    () => (ws ? { name: ws.name, website: ws.website ?? "", industry: ws.industry ?? "", companySize: ws.companySize ?? "", timezone: ws.timezone ?? "", weekStartsOn: ws.weekStartsOn ?? 1 } : null),
    [ws]
  );
  const [form, setForm] = useState<Form | null>(null);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setForm(initial), [initial]);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return ["UTC"];
    }
  }, []);

  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial));
  const valid = Boolean(form?.name.trim());

  useEffect(() => {
    if (!form || !initial) return setSaver(null);
    setSaver({
      dirty,
      disabled: !canEdit || !valid,
      reason: !canEdit ? access.why("workspace") : !valid ? "The agency name can't be empty." : null,
      save: async () => {
        const body: UpdateWorkspaceInput = {
          name: form.name.trim(),
          website: form.website.trim() || null,
          industry: form.industry || null,
          companySize: form.companySize || null,
          timezone: form.timezone || null,
          weekStartsOn: form.weekStartsOn,
        };
        await api.updateWorkspace(body);
        await q.refetch();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, initial, dirty, canEdit, valid]);
  useEffect(() => () => setSaver(null), [setSaver]);

  if (q.error) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-neg">Couldn’t load the workspace: {q.error}</span>
        <Button variant="secondary" size="sm" onClick={() => void q.refetch()}>
          Try again
        </Button>
      </Card>
    );
  }
  if (!form || !ws) return <Skeleton className="h-[420px] rounded-card" />;
  const set = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  // Words that start with a letter or digit ("Halden & Pike" → HP).
  const initials = form.name.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "A";

  return (
    <>
      <Card padded={false} className="flex flex-col gap-[18px] p-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">Agency profile</span>
          <span className="text-[13px] text-ink-2">Your workspace name appears across Advertix and in alert emails.{!canEdit && ` ${access.why("workspace")}`}</span>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="inline-flex h-16 w-16 flex-none items-center justify-center rounded-card bg-[image:var(--grad)] text-lg font-bold text-white" aria-hidden="true">
            {initials}
          </span>
          <span className="text-xs text-ink-3">Your initials stand in for a logo.</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
          <Labeled label="Agency name">
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} disabled={!canEdit} className={field} maxLength={120} />
          </Labeled>
          <Labeled label="Website">
            <input value={form.website} onChange={(e) => set({ website: e.target.value })} disabled={!canEdit} className={field} placeholder="haldenpike.com" maxLength={200} />
          </Labeled>
          <Labeled label="Industry">
            <select value={form.industry} onChange={(e) => set({ industry: e.target.value })} disabled={!canEdit} className={field}>
              <option value="">Not set</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
              {form.industry && !INDUSTRIES.includes(form.industry) && <option value={form.industry}>{form.industry}</option>}
            </select>
          </Labeled>
          <Labeled label="Team size">
            <select value={form.companySize} onChange={(e) => set({ companySize: e.target.value })} disabled={!canEdit} className={field}>
              <option value="">Not set</option>
              {COMPANY_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
              {form.companySize && !COMPANY_SIZES.some((s) => s.id === form.companySize) && <option value={form.companySize}>{form.companySize}</option>}
            </select>
          </Labeled>
        </div>
      </Card>

      <Card padded={false} className="flex flex-col gap-[18px] p-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">Reporting defaults</span>
          <span className="text-[13px] text-ink-2">Used for the weekly summary email and when alerts go out.</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">Time zone</span>
            <span className="text-[13px] text-ink-2">The weekly summary arrives at 09:00 in this time zone</span>
          </span>
          <select value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} disabled={!canEdit} className={`${field} sm:w-[280px]`} aria-label="Time zone">
            <option value="">UTC</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">Week starts on</span>
            <span className="text-[13px] text-ink-2">The weekly summary covers the 7 days before this day</span>
          </span>
          <Segmented
            label="Week starts on"
            size="sm"
            value={String(form.weekStartsOn)}
            onChange={(v) => canEdit && set({ weekStartsOn: Number(v) })}
            options={[
              { value: "1", label: "Monday", disabled: !canEdit },
              { value: "0", label: "Sunday", disabled: !canEdit },
            ]}
          />
        </div>
      </Card>

      <Card padded={false} className="flex flex-wrap items-center gap-3.5 p-[22px]">
        <ShieldCheck size={20} className="flex-none text-brand" aria-hidden="true" />
        <span className="flex min-w-0 flex-[1_1_260px] flex-col">
          <span className="text-base font-semibold">Your login</span>
          <span className="text-[13px] text-ink-2">
            {user ? `${user.fullName || user.primaryEmailAddress?.emailAddress}` : "Signed in"} · name, email, password, two-step verification and signed-in devices
          </span>
        </span>
        <Button variant="secondary" onClick={() => openUserProfile()}>
          Manage login & security
        </Button>
      </Card>

      <Card padded={false} className="flex flex-wrap items-center gap-3.5 border-neg/30 p-[22px]">
        <span className="flex min-w-0 flex-[1_1_260px] flex-col">
          <span className="text-base font-semibold text-neg">Delete workspace</span>
          <span className="text-[13px] text-ink-2">
            {access.role === "OWNER" ? "Permanently deletes this workspace, all its data and your login." : "Only the owner can delete the workspace. To leave it, ask the owner to remove you."}
          </span>
        </span>
        {access.role === "OWNER" && (
          <Button variant="secondary" className="border-neg/40 text-neg hover:bg-neg-soft" onClick={() => setDeleting(true)}>
            Delete workspace
          </Button>
        )}
      </Card>
      <DeleteWorkspaceDialog open={deleting} onClose={() => setDeleting(false)} name={ws.name} />
    </>
  );
}
