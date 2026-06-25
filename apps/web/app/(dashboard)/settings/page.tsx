"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import {
  Building2,
  Users,
  Plug,
  Bell,
  Key,
  Shield,
  AlertTriangle,
  Pencil,
  Plus,
  Copy,
  Check,
  Lock,
  Laptop,
  Smartphone,
  X,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useApiClient, type AdAccount } from "@/lib/api";
import { useApi } from "@/hooks/useApi";
import MetaConnect from "@/components/settings/MetaConnect";
import MetaHealthStatus from "@/components/settings/MetaHealthStatus";
import GoogleConnect from "@/components/settings/GoogleConnect";
import TikTokConnect from "@/components/settings/TikTokConnect";
import LinkedInConnect from "@/components/settings/LinkedInConnect";

type Tab =
  | "general"
  | "workspace"
  | "integrations"
  | "notifications"
  | "apikeys"
  | "security"
  | "danger";

const TABS: {
  id: Tab;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
}[] = [
  { id: "general", label: "General", icon: Building2 },
  { id: "workspace", label: "Workspace", icon: Users },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "apikeys", label: "API Keys", icon: Key },
  { id: "security", label: "Security", icon: Shield },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle, danger: true },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="space-y-6">
      <header className="animate-in stagger-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account, workspace, integrations, and preferences.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 animate-in stagger-2 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* ── Left nav ── */}
        <nav className="rounded-2xl border border-slate-200/70 bg-white p-2 shadow-card lg:sticky lg:top-20 lg:self-start">
          <ul className="space-y-0.5">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={clsx(
                      "relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                      t.danger
                        ? active
                          ? "bg-rose-50 text-rose-700"
                          : "text-rose-600 hover:bg-rose-50/60"
                        : active
                          ? "bg-primary/10 text-slate-900"
                          : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {active && (
                      <span
                        className={clsx(
                          "absolute inset-y-2 left-0 w-0.5 rounded-r-full",
                          t.danger ? "bg-rose-500" : "bg-primary"
                        )}
                      />
                    )}
                    <t.icon
                      className="h-4 w-4"
                      strokeWidth={active ? 2.5 : 2}
                    />
                    {t.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Content ── */}
        <div>
          {tab === "general" && <GeneralTab />}
          {tab === "workspace" && <WorkspaceTab />}
          {tab === "integrations" && <IntegrationsTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "apikeys" && <APIKeysTab />}
          {tab === "security" && <SecurityTab />}
          {tab === "danger" && <DangerTab />}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Reusable                                   */
/* ───────────────────────────────────────── */

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
      <div className="mb-5">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & { readOnlyBadge?: string }
) {
  const { readOnlyBadge, className, ...rest } = props;
  return (
    <div className="relative">
      <input
        {...rest}
        className={clsx(
          "h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none disabled:bg-slate-50",
          className
        )}
      />
      {readOnlyBadge && (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          {readOnlyBadge}
        </span>
      )}
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { children, className, ...rest } = props;
  return (
    <select
      {...rest}
      className={clsx(
        "h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none",
        className
      )}
    >
      {children}
    </select>
  );
}

function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={clsx(
        "relative h-6 w-11 shrink-0 rounded-full transition",
        on ? "bg-primary" : "bg-slate-300"
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          on ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}

/* ───────────────────────────────────────── */
/* General                                    */
/* ───────────────────────────────────────── */

function GeneralTab() {
  const api = useApiClient();
  const me = useApi((c) => c.getMe(), []);

  const [fullName, setFullName] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [language, setLanguage] = useState("English");
  const [workspaceName, setWorkspaceName] = useState("");
  const [slug, setSlug] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate form from real data on first load + any refetch.
  useEffect(() => {
    if (!me.data) return;
    setFullName(me.data.user.name ?? "");
    setWorkspaceName(me.data.workspace?.name ?? "");
    // Workspace.slug / industry / companySize aren't in the MeResponse type
    // today (they're returned by /auth/workspace). We hydrate them lazily
    // when the user opens the General tab.
    setDirty(false);
  }, [me.data]);

  // Also fetch the full workspace (with slug/industry/companySize)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ws = await api.getWorkspace();
        if (cancelled) return;
        setSlug(ws.slug ?? "");
        setIndustry(ws.industry ?? "");
        setCompanySize(ws.companySize ?? "");
      } catch {
        // ignore — defaults stay empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      await api.updateWorkspace({
        name: workspaceName.trim() || undefined,
        slug: slug.trim() || undefined,
        industry: industry || undefined,
        companySize: companySize || undefined,
      });
      // TODO: persist `fullName` + `timezone` + `language` once user-level
      // settings endpoints exist (User.timezone / User.language fields).
      toast.success("Workspace saved");
      setDirty(false);
      me.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Compute initials for the avatar bubble
  const initials = (() => {
    const n = fullName || me.data?.user.email || "?";
    return n
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
  })();

  return (
    <div className="space-y-6">
      <Card
        title="Profile"
        description="Personal info — visible to your teammates."
      >
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-md ring-2 ring-white">
            {initials || "?"}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Change Avatar
          </button>
        </div>

        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(e) => markDirty(setFullName)(e.target.value)}
            placeholder={me.loading ? "Loading…" : "Your name"}
          />
        </Field>

        <Field label="Email">
          <Input
            value={me.data?.user.email ?? ""}
            disabled
            readOnlyBadge="Clerk"
          />
        </Field>

        <Field label="Timezone">
          <Select
            value={timezone}
            onChange={(e) => markDirty(setTimezone)(e.target.value)}
          >
            <option value="America/Los_Angeles">
              (UTC-08) America/Los_Angeles
            </option>
            <option value="America/New_York">(UTC-05) America/New_York</option>
            <option value="Europe/London">(UTC+00) Europe/London</option>
            <option value="Europe/Berlin">(UTC+01) Europe/Berlin</option>
            <option value="Asia/Dubai">(UTC+04) Asia/Dubai</option>
            <option value="Asia/Karachi">(UTC+05) Asia/Karachi</option>
            <option value="Asia/Singapore">(UTC+08) Asia/Singapore</option>
            <option value="Asia/Tokyo">(UTC+09) Asia/Tokyo</option>
          </Select>
        </Field>

        <Field label="Language">
          <Select
            value={language}
            onChange={(e) => markDirty(setLanguage)(e.target.value)}
          >
            <option>English</option>
            <option>Arabic</option>
            <option>Spanish</option>
            <option>French</option>
          </Select>
        </Field>
      </Card>

      <Card title="Workspace" description="Your team workspace details.">
        <Field label="Workspace name">
          <Input
            value={workspaceName}
            onChange={(e) => markDirty(setWorkspaceName)(e.target.value)}
          />
        </Field>

        <Field
          label="Workspace slug"
          hint={`Your workspace URL: advertix.io/${slug}`}
        >
          <Input
            value={slug}
            onChange={(e) =>
              markDirty(setSlug)(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
              )
            }
          />
        </Field>

        <Field label="Industry">
          <Select
            value={industry}
            onChange={(e) => markDirty(setIndustry)(e.target.value)}
          >
            <option>E-commerce</option>
            <option>SaaS</option>
            <option>Agency</option>
            <option>Restaurant</option>
            <option>Real Estate</option>
            <option>Other</option>
          </Select>
        </Field>

        <Field label="Company size">
          <Select
            value={companySize}
            onChange={(e) => markDirty(setCompanySize)(e.target.value)}
          >
            <option value="1-10">1–10</option>
            <option value="11-50">11–50</option>
            <option value="51-200">51–200</option>
            <option value="200+">200+</option>
          </Select>
        </Field>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            You have unsaved changes
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className={clsx(
            "btn-brand",
            (!dirty || saving) && "pointer-events-none opacity-50"
          )}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Workspace                                  */
/* ───────────────────────────────────────── */

type AssignableRole = "ADMIN" | "EDITOR" | "VIEWER";

const ROLE_GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-emerald-500 to-cyan-600",
  "from-amber-500 to-rose-500",
  "from-pink-500 to-fuchsia-600",
  "from-sky-500 to-blue-600",
] as const;

function initialsOf(name: string | null | undefined, email: string): string {
  const src = name && name.trim() ? name : email;
  return src
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function WorkspaceTab() {
  const api = useApiClient();
  const membersQ = useApi((c) => c.getMembers(), []);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function sendInvite() {
    if (inviting) return;
    const email = inviteEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email");
      return;
    }
    setInviting(true);
    try {
      await api.inviteMember(email, inviteRole);
      toast.success(`Invite sent to ${email}`);
      setInviteEmail("");
      setInviteOpen(false);
      membersQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(memberId: string, role: AssignableRole) {
    setBusyId(memberId);
    try {
      await api.updateMemberRole(memberId, role);
      toast.success("Role updated");
      membersQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(memberId: string) {
    if (!window.confirm("Remove this teammate from the workspace?")) return;
    setBusyId(memberId);
    try {
      await api.removeMember(memberId);
      toast.success("Member removed");
      membersQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusyId(null);
    }
  }

  const members = membersQ.data ?? [];

  return (
    <div className="space-y-6">
      <Card
        title="Team Members"
        description="People who have access to this workspace."
      >
        <div className="-mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setInviteOpen((v) => !v)}
            className="btn-brand"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Invite Member
          </button>
        </div>

        {inviteOpen && (
          <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.04] p-4 animate-in">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Field label="Email">
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                  />
                </Field>
              </div>
              <div className="sm:w-32">
                <Field label="Role">
                  <Select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as AssignableRole)
                    }
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </Select>
                </Field>
              </div>
              <button
                type="button"
                onClick={sendInvite}
                disabled={inviting}
                className={clsx("btn-brand", inviting && "opacity-60")}
              >
                <Send className="h-4 w-4" />
                {inviting ? "Sending…" : "Send Invite"}
              </button>
            </div>
          </div>
        )}

        {membersQ.loading ? (
          <ul className="space-y-2">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-200/70" />
                  <div className="h-2 w-48 animate-pulse rounded bg-slate-200/70" />
                </div>
                <div className="h-8 w-24 animate-pulse rounded bg-slate-200/70" />
              </li>
            ))}
          </ul>
        ) : members.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No team members yet. Invite teammates with the button above.
          </p>
        ) : (
          <ul className="space-y-2">
            {members.map((m, i) => {
              const gradient = ROLE_GRADIENTS[i % ROLE_GRADIENTS.length];
              const isOwner = m.role === "OWNER";
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300"
                >
                  <div
                    className={clsx(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white shadow-sm",
                      gradient
                    )}
                  >
                    {initialsOf(m.user.name, m.user.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {m.user.name || m.user.email}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {m.user.email}
                    </p>
                  </div>
                  {isOwner ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Owner
                    </span>
                  ) : (
                    <>
                      <Select
                        value={m.role}
                        onChange={(e) =>
                          changeRole(m.id, e.target.value as AssignableRole)
                        }
                        disabled={busyId === m.id}
                        className="h-8 w-28 text-xs"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </Select>
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        disabled={busyId === m.id}
                        className="text-xs font-semibold text-rose-600 transition hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* TODO(phase-3): persist pending invites in DB + render real list here */}
      <Card
        title="Pending Invites"
        description="Invites that haven't been accepted yet (placeholder — real invite records in Phase 3)."
      >
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 p-4 text-center text-xs text-slate-500">
          No pending invites.
        </p>
      </Card>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Integrations                               */
/* ───────────────────────────────────────── */

const STATIC_PLATFORMS = [
  {
    id: "youtube",
    name: "YouTube Ads",
    color: "#FF0000",
    initial: "Y",
    textOnColor: "white" as const,
  },
  {
    id: "snapchat",
    name: "Snapchat Ads",
    color: "#FFFC00",
    initial: "S",
    textOnColor: "black" as const,
  },
] as const;

const OTHER_INTEGRATIONS = ["Zapier", "HubSpot", "Salesforce", "Slack"];

function timeAgo(iso: string | undefined | null): string | undefined {
  if (!iso) return undefined;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return undefined;
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function IntegrationsTab() {
  const api = useApiClient();
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const list = await api.getAdAccounts();
      setAccounts(list);
    } catch (err) {
      console.error("[settings/integrations] load failed", err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surface OAuth callback flags from the URL once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected === "meta") {
      toast.success("Meta account connected");
    } else if (connected === "google") {
      toast.success("Google Ads account connected");
    } else if (error === "meta_failed") {
      toast.error("Meta connect failed. Please try again.");
    } else if (error === "meta_cancelled") {
      toast("Meta connect cancelled");
    } else if (error === "meta_no_workspace") {
      toast.error("Finish onboarding before connecting Meta");
    } else if (error === "google_failed") {
      toast.error("Google connect failed. Please try again.");
    } else if (error === "google_cancelled") {
      toast("Google connect cancelled");
    } else if (error === "google_no_workspace") {
      toast.error("Finish onboarding before connecting Google");
    } else if (error === "google_no_customers") {
      toast.error("That Google account has no Google Ads customers");
    } else if (connected === "tiktok") {
      toast.success("TikTok Ads account connected");
    } else if (error === "tiktok_failed") {
      toast.error("TikTok connect failed. Please try again.");
    } else if (error === "tiktok_cancelled") {
      toast("TikTok connect cancelled");
    } else if (error === "tiktok_no_workspace") {
      toast.error("Finish onboarding before connecting TikTok");
    } else if (error === "tiktok_no_advertisers") {
      toast.error("That TikTok account has no advertiser access");
    } else if (connected === "linkedin") {
      toast.success("LinkedIn Ads account connected");
    } else if (error === "linkedin_failed") {
      toast.error("LinkedIn connect failed. Please try again.");
    } else if (error === "linkedin_cancelled") {
      toast("LinkedIn connect cancelled");
    } else if (error === "linkedin_no_workspace") {
      toast.error("Finish onboarding before connecting LinkedIn");
    } else if (error === "linkedin_no_accounts") {
      toast.error("That LinkedIn account has no ad accounts");
    }
    if (connected || error) {
      const cleaned = new URLSearchParams(window.location.search);
      cleaned.delete("connected");
      cleaned.delete("error");
      const search = cleaned.toString();
      const newUrl =
        window.location.pathname + (search ? `?${search}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const meta = (accounts ?? []).find((a) => a.platform === "META");
  const google = (accounts ?? []).find((a) => a.platform === "GOOGLE");
  const tiktok = (accounts ?? []).find((a) => a.platform === "TIKTOK");
  const linkedin = (accounts ?? []).find((a) => a.platform === "LINKEDIN");

  return (
    <div className="space-y-6">
      <Card
        title="Connected Platforms"
        description="Connect your ad accounts to sync campaigns automatically."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {loading ? (
            <div className="col-span-full flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-xs font-medium text-slate-500">
              Loading connections…
            </div>
          ) : (
            <>
              <MetaConnect
                connected={!!meta}
                adAccountId={meta?.id}
                accountName={meta?.accountName}
                lastSynced={timeAgo(meta?.createdAt)}
                onChange={refresh}
              />
              <GoogleConnect
                connected={!!google}
                adAccountId={google?.id}
                accountName={google?.accountName}
                lastSynced={timeAgo(google?.createdAt)}
                onChange={refresh}
              />
              <TikTokConnect
                connected={!!tiktok}
                adAccountId={tiktok?.id}
                accountName={tiktok?.accountName}
                lastSynced={timeAgo(tiktok?.createdAt)}
                onChange={refresh}
              />
              <LinkedInConnect
                connected={!!linkedin}
                adAccountId={linkedin?.id}
                accountName={linkedin?.accountName}
                lastSynced={timeAgo(linkedin?.createdAt)}
                onChange={refresh}
              />
              {STATIC_PLATFORMS.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm"
                      style={{
                        backgroundColor: p.color,
                        color:
                          p.textOnColor === "black" ? "#0f172a" : "#ffffff",
                      }}
                    >
                      {p.initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {p.name}
                      </p>
                      <p className="flex items-center gap-1 text-[11px]">
                        <span className="status-dot draft" />
                        <span className="font-semibold text-slate-500">
                          Not Connected
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-medium text-slate-400">
                      Last synced: Never
                    </span>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-400"
                    >
                      Coming Soon
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        {meta?.id && (
          <div className="mt-4">
            <MetaHealthStatus adAccountId={meta.id} />
          </div>
        )}
      </Card>

      <Card
        title="Other Integrations"
        description="Workflow tools — coming soon."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {OTHER_INTEGRATIONS.map((name) => (
            <div
              key={name}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/40 p-4 text-center"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-500 shadow-sm">
                {name[0]}
              </div>
              <p className="text-sm font-semibold text-slate-700">{name}</p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                Coming Soon
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Notifications                              */
/* ───────────────────────────────────────── */

type NotificationKey =
  | "campaignLive"
  | "campaignEnds"
  | "budget80"
  | "campaignAutoPause"
  | "dailySummary"
  | "weeklyReport"
  | "roasDrop"
  | "anomaly"
  | "aiOptimization"
  | "aiInsight"
  | "invoiceGenerated"
  | "planLimit";

const NOTIF_GROUPS: Array<{
  title: string;
  items: { key: NotificationKey; label: string; desc: string; defaultOn: boolean }[];
}> = [
  {
    title: "Campaign Alerts",
    items: [
      {
        key: "campaignLive",
        label: "Campaign goes live",
        desc: "When a new campaign starts serving.",
        defaultOn: true,
      },
      {
        key: "campaignEnds",
        label: "Campaign ends",
        desc: "When a scheduled end date is reached.",
        defaultOn: true,
      },
      {
        key: "budget80",
        label: "Budget 80% used",
        desc: "Get notified before a campaign runs out of budget.",
        defaultOn: true,
      },
      {
        key: "campaignAutoPause",
        label: "Campaign paused automatically",
        desc: "When AI or platform rules pause a campaign.",
        defaultOn: true,
      },
    ],
  },
  {
    title: "Performance",
    items: [
      {
        key: "dailySummary",
        label: "Daily performance summary",
        desc: "A morning email with yesterday's numbers.",
        defaultOn: false,
      },
      {
        key: "weeklyReport",
        label: "Weekly report",
        desc: "Every Monday — full performance recap.",
        defaultOn: true,
      },
      {
        key: "roasDrop",
        label: "ROAS drops below threshold",
        desc: "Alert when any campaign ROAS falls below 1.5x.",
        defaultOn: true,
      },
      {
        key: "anomaly",
        label: "Anomaly detected",
        desc: "Unusual spikes or drops in spend or conversions.",
        defaultOn: true,
      },
    ],
  },
  {
    title: "AI Activity",
    items: [
      {
        key: "aiOptimization",
        label: "AI optimization applied",
        desc: "When AI makes a budget or audience change.",
        defaultOn: false,
      },
      {
        key: "aiInsight",
        label: "AI insight available",
        desc: "When a new recommendation is ready to review.",
        defaultOn: true,
      },
    ],
  },
  {
    title: "Billing",
    items: [
      {
        key: "invoiceGenerated",
        label: "Invoice generated",
        desc: "Receive a copy of each invoice.",
        defaultOn: true,
      },
      {
        key: "planLimit",
        label: "Plan approaching limit",
        desc: "When you're close to your plan's usage cap.",
        defaultOn: true,
      },
    ],
  },
];

function NotificationsTab() {
  const initial: Record<NotificationKey, boolean> = NOTIF_GROUPS.reduce(
    (acc, g) => {
      g.items.forEach((i) => {
        acc[i.key] = i.defaultOn;
      });
      return acc;
    },
    {} as Record<NotificationKey, boolean>
  );
  const [prefs, setPrefs] = useState<Record<NotificationKey, boolean>>(initial);

  return (
    <div className="space-y-6">
      {NOTIF_GROUPS.map((g) => (
        <Card key={g.title} title={g.title}>
          <ul className="-mt-1 divide-y divide-slate-100">
            {g.items.map((i) => (
              <li
                key={i.key}
                className="flex items-start justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {i.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{i.desc}</p>
                </div>
                <Switch
                  on={prefs[i.key]}
                  onChange={(b) => setPrefs((p) => ({ ...p, [i.key]: b }))}
                />
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => toast.success("Preferences saved")}
          className="btn-brand"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* API Keys                                   */
/* ───────────────────────────────────────── */

type APIKey = {
  id: string;
  name: string;
  masked: string;
  created: string;
  lastUsed: string;
  permissions: Array<"Read" | "Write" | "Delete">;
};

const INIT_KEYS: APIKey[] = [
  {
    id: "k1",
    name: "Production API",
    masked: "ag_live_••••••••••••••3f2a",
    created: "2026-03-12",
    lastUsed: "12 min ago",
    permissions: ["Read", "Write"],
  },
  {
    id: "k2",
    name: "Reporting Read-only",
    masked: "ag_live_••••••••••••••8c91",
    created: "2026-02-08",
    lastUsed: "Yesterday",
    permissions: ["Read"],
  },
];

function APIKeysTab() {
  const [keys, setKeys] = useState<APIKey[]>(INIT_KEYS);
  const [modalOpen, setModalOpen] = useState(false);

  function revoke(id: string) {
    setKeys((k) => k.filter((x) => x.id !== id));
    toast.success("Key revoked");
  }

  return (
    <div className="space-y-6">
      <Card
        title="API Keys"
        description="Use these keys to integrate Advertix with your own tools."
      >
        <div className="-mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-brand"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Generate Key
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Key</th>
                <th className="pb-2">Created</th>
                <th className="pb-2">Last Used</th>
                <th className="pb-2">Permissions</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr
                  key={k.id}
                  className="border-t border-slate-100 transition hover:bg-slate-50/40"
                >
                  <td className="py-3 text-sm font-semibold text-slate-900">
                    {k.name}
                  </td>
                  <td className="py-3 font-mono text-xs text-slate-600">
                    {k.masked}
                  </td>
                  <td className="py-3 text-xs text-slate-500">{k.created}</td>
                  <td className="py-3 text-xs text-slate-500">
                    {k.lastUsed}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {k.permissions.map((p) => (
                        <span
                          key={p}
                          className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => revoke(k.id)}
                      className="text-xs font-bold text-rose-600 transition hover:underline"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen && (
        <GenerateKeyModal
          onClose={() => setModalOpen(false)}
          onCreate={(name, perms) => {
            const newKey: APIKey = {
              id: `k-${Date.now()}`,
              name,
              masked: `ag_live_••••••••••••••${Math.random()
                .toString(16)
                .slice(2, 6)}`,
              created: new Date().toISOString().slice(0, 10),
              lastUsed: "Never",
              permissions: perms,
            };
            setKeys((prev) => [newKey, ...prev]);
          }}
        />
      )}
    </div>
  );
}

function GenerateKeyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, perms: Array<"Read" | "Write" | "Delete">) => void;
}) {
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<Array<"Read" | "Write" | "Delete">>([
    "Read",
  ]);
  const [generated, setGenerated] = useState<string | null>(null);

  function togglePerm(p: "Read" | "Write" | "Delete") {
    setPerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  function handleGenerate() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const value = `ag_live_${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
    setGenerated(value);
    onCreate(name, perms);
  }

  function copyKey() {
    if (generated && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(generated).then(
        () => toast.success("Copied!"),
        () => toast.error("Couldn't copy")
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {generated ? "API Key Generated" : "Generate API Key"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!generated ? (
          <div className="space-y-4">
            <Field label="Key name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production API"
              />
            </Field>
            <Field label="Permissions">
              <div className="flex flex-wrap gap-2">
                {(["Read", "Write", "Delete"] as const).map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={perms.includes(p)}
                      onChange={() => togglePerm(p)}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </Field>
            <button
              type="button"
              onClick={handleGenerate}
              className="btn-brand w-full justify-center"
            >
              Generate
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                Store this key safely — it won&apos;t be shown again.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <code className="flex-1 truncate font-mono text-xs text-slate-800">
                {generated}
              </code>
              <button
                type="button"
                onClick={copyKey}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm transition hover:text-primary"
                aria-label="Copy"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn-brand w-full justify-center"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Security                                   */
/* ───────────────────────────────────────── */

function SecurityTab() {
  const sessions = [
    {
      id: "s1",
      device: "MacBook Pro",
      deviceIcon: Laptop,
      location: "San Francisco, CA",
      lastActive: "Active now",
      current: true,
    },
    {
      id: "s2",
      device: "iPhone 15",
      deviceIcon: Smartphone,
      location: "San Francisco, CA",
      lastActive: "3 hours ago",
      current: false,
    },
  ];

  const logins = [
    {
      date: "May 25, 2026 03:12",
      ip: "192.168.1.42",
      device: "MacBook Pro · Chrome",
      location: "San Francisco, CA",
      ok: true,
    },
    {
      date: "May 24, 2026 22:51",
      ip: "192.168.1.42",
      device: "MacBook Pro · Chrome",
      location: "San Francisco, CA",
      ok: true,
    },
    {
      date: "May 24, 2026 14:18",
      ip: "73.222.81.91",
      device: "iPhone 15 · Safari",
      location: "San Francisco, CA",
      ok: true,
    },
    {
      date: "May 23, 2026 09:24",
      ip: "85.204.18.4",
      device: "Unknown · Firefox",
      location: "Bucharest, RO",
      ok: false,
    },
    {
      date: "May 22, 2026 11:42",
      ip: "73.222.81.91",
      device: "iPhone 15 · Safari",
      location: "San Francisco, CA",
      ok: true,
    },
  ];

  return (
    <div className="space-y-6">
      <Card title="Password">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
          <Lock className="h-5 w-5 text-slate-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">
              Managed by Clerk
            </p>
            <p className="text-xs text-slate-500">
              Your password is securely stored and rotated through Clerk.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Change Password
          </button>
        </div>
      </Card>

      <Card title="Two-Factor Authentication">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Authenticator app
            </p>
            <p className="text-xs text-slate-500">
              Add an extra layer of security at sign-in.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Not enabled
          </span>
        </div>
        <button type="button" className="btn-brand">
          Enable 2FA
        </button>
      </Card>

      <Card title="Active Sessions">
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <s.deviceIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  {s.device}
                  {s.current && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-500">
                  {s.location} · {s.lastActive}
                </p>
              </div>
              {!s.current && (
                <button
                  type="button"
                  className="text-xs font-bold text-rose-600 transition hover:underline"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
        >
          Sign out all other sessions
        </button>
      </Card>

      <Card title="Login History">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="pb-2">Date</th>
                <th className="pb-2">IP Address</th>
                <th className="pb-2">Device</th>
                <th className="pb-2">Location</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((l, i) => (
                <tr
                  key={i}
                  className="border-t border-slate-100 transition hover:bg-slate-50/40"
                >
                  <td className="py-2.5 text-xs font-medium text-slate-700">
                    {l.date}
                  </td>
                  <td className="py-2.5 font-mono text-xs text-slate-600">
                    {l.ip}
                  </td>
                  <td className="py-2.5 text-xs text-slate-600">{l.device}</td>
                  <td className="py-2.5 text-xs text-slate-600">
                    {l.location}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        l.ok
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      )}
                    >
                      {l.ok ? (
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      ) : (
                        <X className="h-2.5 w-2.5" strokeWidth={3} />
                      )}
                      {l.ok ? "Success" : "Failed"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────────────────────── */
/* Danger Zone                                */
/* ───────────────────────────────────────── */

function DangerTab() {
  const [resetConfirm, setResetConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const workspaceName = "My Workspace";

  return (
    <div className="space-y-4">
      <DangerCard
        title="Export All Data"
        description="Download all your campaigns, analytics, and creative data as CSV."
        buttonLabel="Export Data"
        onClick={() => toast.success("Export will be emailed when ready")}
        variant="outline"
      />

      <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/30 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-900">Reset Workspace</h4>
            <p className="mt-0.5 text-xs text-rose-700/80">
              Delete all campaigns and data but keep your account.
            </p>
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Type{" "}
                <code className="rounded bg-white px-1 py-0.5 text-rose-900">
                  {workspaceName}
                </code>{" "}
                to confirm
              </p>
              <Input
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                placeholder={workspaceName}
              />
              <button
                type="button"
                disabled={resetConfirm !== workspaceName}
                onClick={() => {
                  toast.success("Workspace reset");
                  setResetConfirm("");
                }}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 transition",
                  resetConfirm === workspaceName
                    ? "hover:bg-rose-100"
                    : "cursor-not-allowed opacity-50"
                )}
              >
                Reset Workspace
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/30 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-900">Delete Account</h4>
            <p className="mt-0.5 text-xs text-rose-700/80">
              Permanently delete your account and all data. This cannot be
              undone.
            </p>
            <div className="mt-3 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Type{" "}
                <code className="rounded bg-white px-1 py-0.5 text-rose-900">
                  DELETE
                </code>{" "}
                to confirm
              </p>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
              />
              <button
                type="button"
                disabled={deleteConfirm !== "DELETE"}
                onClick={() => toast.error("Account deletion is disabled in demo")}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition",
                  deleteConfirm === "DELETE"
                    ? "hover:bg-rose-700"
                    : "cursor-not-allowed opacity-50"
                )}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DangerCard({
  title,
  description,
  buttonLabel,
  onClick,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  variant: "outline" | "solid";
}) {
  return (
    <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/30 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-rose-900">{title}</h4>
          <p className="mt-0.5 text-xs text-rose-700/80">{description}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
