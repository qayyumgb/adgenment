"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Mail, Search } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { AdminUser, AdminUserActivity, LeadStage, WorkspaceRole } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ButtonLink, Button, Card, Drawer, EmptyState, Pill, PlatformBadge, Segmented, Skeleton, type PillTone, type PlatformKey } from "@/components/app/ui";

/**
 * Superadmin › Users: everyone who signed up (leads), how far they got and
 * what they did. Click a row for their timeline; export the list as CSV.
 */

const DAY = 86_400_000;
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
function ago(iso: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 15 * 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
  if (ms < DAY) return `${Math.round(ms / 3_600_000)} h ago`;
  const d = Math.round(ms / DAY);
  return d < 31 ? `${d} day${d === 1 ? "" : "s"} ago` : date(iso);
}

const STAGE: Record<LeadStage, { label: string; tone: PillTone }> = {
  SIGNED_UP: { label: "Signed up", tone: "muted" },
  CONNECTED: { label: "Connected", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "brand" },
  PAYING: { label: "Paying", tone: "pos" },
};
const ROLE: Record<WorkspaceRole, string> = { OWNER: "Owner", MEDIA_BUYER: "Media buyer", ANALYST: "Analyst", CLIENT_VIEWER: "Client viewer" };
const TIER: Record<string, string> = { FOUNDER: "Founder", TEAM: "Team", AGENCY: "Agency", ENTERPRISE: "Enterprise" };

function planOf(u: AdminUser): { label: string; tone: PillTone } {
  const w = u.workspace;
  if (!w) return { label: "No workspace", tone: "muted" };
  if (w.locked) return { label: "Locked", tone: "warn" };
  if (w.state === "TRIAL") {
    const left = w.trialEndsAt ? Math.ceil((new Date(w.trialEndsAt).getTime() - Date.now()) / DAY) : null;
    return { label: left !== null && left >= 0 ? `Trial · ${left} day${left === 1 ? "" : "s"} left` : "Trial", tone: "brand" };
  }
  if (w.state === "PAST_DUE") return { label: "Payment failed", tone: "warn" };
  return { label: w.tier ? TIER[w.tier] ?? w.tier : "Active", tone: "pos" };
}

type SortKey = "createdAt" | "lastSeenAt" | "changes" | "campaigns";
const STAGE_FILTERS: { value: "ALL" | LeadStage; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SIGNED_UP", label: "Signed up" },
  { value: "CONNECTED", label: "Connected" },
  { value: "PUBLISHED", label: "Published" },
  { value: "PAYING", label: "Paying" },
];

function toCsv(rows: AdminUser[]) {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Name", "Email", "Signed up", "Last active", "Stage", "Workspace", "Role", "Plan", "Platforms", "Ad accounts", "Campaigns", "Published", "Changes", "AI credits"];
  const lines = rows.map((u) =>
    [
      u.name,
      u.email,
      u.createdAt.slice(0, 10),
      u.lastSeenAt?.slice(0, 10) ?? "",
      STAGE[u.stage].label,
      u.workspace?.name,
      u.workspace ? ROLE[u.workspace.role] : "",
      planOf(u).label,
      u.platforms.join(" "),
      u.adAccounts,
      u.campaigns,
      u.published,
      u.changes,
      u.aiCredits,
    ]
      .map(cell)
      .join(",")
  );
  return [head.join(","), ...lines].join("\n");
}

function download(rows: AdminUser[]) {
  const blob = new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `advertix-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-card border border-line bg-surface px-4 py-3">
      <span className="text-xs text-ink-2">{label}</span>
      <span className="text-[22px] font-semibold tabular-nums tracking-tight">{value}</span>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </div>
  );
}

function SortHead({ k, label, sort, onSort, className }: { k: SortKey; label: string; sort: { key: SortKey; desc: boolean }; onSort: (k: SortKey) => void; className?: string }) {
  const on = sort.key === k;
  return (
    <th className={cn("px-3 py-2.5 font-medium", className)} aria-sort={on ? (sort.desc ? "descending" : "ascending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-ink", on && "text-ink")}>
        {label}
        {on && (sort.desc ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />)}
      </button>
    </th>
  );
}

function UserDrawer({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const q = useApi((c) => (user ? c.getAdminUserActivity(user.id) : new Promise<never>(() => {})), [user?.id], { key: "admin-user-activity" });
  const a: AdminUserActivity | null = q.data ?? null;
  const plan = user ? planOf(user) : null;
  return (
    <Drawer
      open={Boolean(user)}
      onClose={onClose}
      title={user?.name || user?.email || ""}
      sub={user?.name ? user.email : undefined}
      width={480}
      actions={user ? <ButtonLink href={`mailto:${user.email}`} variant="secondary" size="sm" icon={<Mail size={14} />}>Email</ButtonLink> : undefined}
    >
      {user && (
        <div className="flex flex-col gap-5 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={STAGE[user.stage].tone}>{STAGE[user.stage].label}</Pill>
            {plan && <Pill tone={plan.tone}>{plan.label}</Pill>}
            {user.workspace && (
              <Pill tone="muted">
                {user.workspace.name} · {ROLE[user.workspace.role]}
                {user.otherWorkspaces ? ` · +${user.otherWorkspaces}` : ""}
              </Pill>
            )}
          </div>
          <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
            {[
              ["Signed up", `${date(user.createdAt)} (${user.daysSinceSignup} d)`],
              ["Last active", ago(user.lastSeenAt)],
              ["Ad accounts", String(user.adAccounts)],
              ["Campaigns", `${user.campaigns} (${user.published} published from Advertix)`],
              ["Changes made", `${user.changes}${user.lastChangeAt ? ` · last ${ago(user.lastChangeAt).toLowerCase()}` : ""}`],
              ["AI credits used", String(user.aiCredits)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-xs text-ink-2">{k}</dt>
                <dd className="m-0 font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          {q.loading && !a ? (
            <Skeleton className="h-40 rounded-card" />
          ) : q.error && !a ? (
            <p className="m-0 text-neg">Couldn&apos;t load the activity. {q.error}</p>
          ) : a ? (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="m-0 text-[13px] font-semibold">Journey</h3>
                <ol className="m-0 flex list-none flex-col gap-0 border-l border-line pl-4">
                  {a.milestones.map((m, i) => (
                    <li key={i} className="relative pb-3 last:pb-0">
                      <span className={cn("absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface", m.kind === "published" ? "bg-brand" : m.kind === "connected" ? "bg-pos" : "bg-ink-3")} aria-hidden="true" />
                      <span className="block font-medium">{m.label}</span>
                      <span className="text-xs text-ink-3">{date(m.at)}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="m-0 text-[13px] font-semibold">Latest changes{a.changes.length ? ` (${a.changes.length})` : ""}</h3>
                {a.changes.length === 0 ? (
                  <p className="m-0 text-ink-2">No changes to campaigns yet.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col divide-y divide-line rounded-ctl border border-line p-0">
                    {a.changes.map((c) => (
                      <li key={c.id} className="flex flex-col gap-0.5 px-3 py-2">
                        <span className={cn("leading-snug", c.undoneAt && "text-ink-3 line-through")}>{c.summary}</span>
                        <span className="text-xs text-ink-3">
                          {c.campaignName} · {ago(c.createdAt)}
                          {c.undoneAt ? " · undone" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {a.ai.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="m-0 text-[13px] font-semibold">AI features used</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {a.ai.map((f) => (
                      <Pill key={f.feature} tone="brand">
                        {f.feature} · {f.uses}× · {f.credits} credits
                      </Pill>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}

export function UsersPanel() {
  const q = useApi((c) => c.getAdminUsers(), [], { key: "admin-users", keepPrevious: true });
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"ALL" | LeadStage>("ALL");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "createdAt", desc: true });
  const [open, setOpen] = useState<AdminUser | null>(null);
  const all = useMemo(() => q.data?.users ?? [], [q.data]);

  const stats = useMemo(() => {
    const week = Date.now() - 7 * DAY;
    const reached = (s: LeadStage[]) => all.filter((u) => s.includes(u.stage)).length;
    const pct = (n: number) => (all.length ? `${Math.round((n / all.length) * 100)}% of sign-ups` : undefined);
    const connected = reached(["CONNECTED", "PUBLISHED", "PAYING"]);
    const published = reached(["PUBLISHED", "PAYING"]);
    return {
      total: all.length,
      week: all.filter((u) => new Date(u.createdAt).getTime() > week).length,
      active: all.filter((u) => u.lastSeenAt && new Date(u.lastSeenAt).getTime() > week).length,
      connected,
      connectedPct: pct(connected),
      published,
      publishedPct: pct(published),
      paying: reached(["PAYING"]),
    };
  }, [all]);

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = all.filter((u) => (stage === "ALL" || u.stage === stage) && (!s || `${u.name ?? ""} ${u.email} ${u.workspace?.name ?? ""}`.toLowerCase().includes(s)));
    const val = (u: AdminUser) => (sort.key === "createdAt" ? new Date(u.createdAt).getTime() : sort.key === "lastSeenAt" ? (u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0) : sort.key === "changes" ? u.changes : u.campaigns);
    return [...list].sort((a, b) => (sort.desc ? val(b) - val(a) : val(a) - val(b)));
  }, [all, search, stage, sort]);

  const onSort = (k: SortKey) => setSort((p) => (p.key === k ? { key: k, desc: !p.desc } : { key: k, desc: true }));

  if (q.loading && !q.data) return <Skeleton className="h-80 rounded-card" />;
  if (q.error && !q.data)
    return (
      <Card>
        <EmptyState title="Users didn't load" body={q.error} />
      </Card>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        <Stat label="Sign-ups" value={stats.total} sub={`${stats.week} in the last 7 days`} />
        <Stat label="Active this week" value={stats.active} />
        <Stat label="Connected an ad account" value={stats.connected} sub={stats.connectedPct} />
        <Stat label="Published a campaign" value={stats.published} sub={stats.publishedPct} />
        <Stat label="Paying" value={stats.paying} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative flex min-w-[220px] flex-1 items-center">
          <Search size={15} className="pointer-events-none absolute left-3 text-ink-3" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or workspace"
            aria-label="Search users"
            className="h-9 w-full rounded-ctl border border-line-2 bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft"
          />
        </label>
        <Segmented<"ALL" | LeadStage> label="Stage" value={stage} onChange={setStage} options={STAGE_FILTERS} />
        <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => download(rows)} disabled={!rows.length}>
          Export CSV
        </Button>
      </div>

      <Card padded={false} className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState title={all.length ? "No users match" : "No sign-ups yet"} body={all.length ? "Try another search or stage." : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-[13px]">
              <thead className="border-b border-line bg-surface-2 text-xs text-ink-2">
                <tr>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <SortHead k="createdAt" label="Signed up" sort={sort} onSort={onSort} />
                  <SortHead k="lastSeenAt" label="Last active" sort={sort} onSort={onSort} />
                  <th className="px-3 py-2.5 font-medium">Workspace</th>
                  <th className="px-3 py-2.5 font-medium">Plan</th>
                  <th className="px-3 py-2.5 font-medium">Stage</th>
                  <th className="px-3 py-2.5 font-medium">Platforms</th>
                  <SortHead k="campaigns" label="Campaigns" sort={sort} onSort={onSort} className="text-right" />
                  <SortHead k="changes" label="Changes" sort={sort} onSort={onSort} className="pr-4 text-right" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const plan = planOf(u);
                  return (
                    <tr key={u.id} onClick={() => setOpen(u)} className="cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-2">
                      <td className="max-w-[240px] px-4 py-3">
                        <button type="button" onClick={() => setOpen(u)} className="flex min-w-0 flex-col text-left">
                          <span className="truncate font-semibold text-ink">{u.name || "—"}</span>
                          <span className="truncate text-xs text-ink-2">{u.email}</span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className="block">{date(u.createdAt)}</span>
                        <span className="text-xs text-ink-3">{ago(u.createdAt)}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-ink-2">{ago(u.lastSeenAt)}</td>
                      <td className="max-w-[200px] px-3 py-3">
                        {u.workspace ? (
                          <>
                            <span className="block truncate">{u.workspace.name}</span>
                            <span className="text-xs text-ink-3">
                              {ROLE[u.workspace.role]}
                              {u.otherWorkspaces ? ` · +${u.otherWorkspaces} more` : ""}
                            </span>
                          </>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Pill tone={plan.tone}>{plan.label}</Pill>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <Pill tone={STAGE[u.stage].tone}>{STAGE[u.stage].label}</Pill>
                      </td>
                      <td className="px-3 py-3">
                        {u.platforms.length ? (
                          <span className="flex items-center gap-1" title={`${u.adAccounts} ad account${u.adAccounts === 1 ? "" : "s"}`}>
                            {u.platforms.map((p) => (
                              <PlatformBadge key={p} platform={p as PlatformKey} size={20} />
                            ))}
                          </span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                        {u.campaigns}
                        {u.published ? <span className="text-xs text-ink-3"> · {u.published} pub.</span> : null}
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right tabular-nums">{u.changes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="m-0 text-xs text-ink-3">
        {rows.length} of {all.length} users. &ldquo;Last active&rdquo; is recorded from today, so it&apos;s empty for people who haven&apos;t used Advertix since.
      </p>

      <UserDrawer user={open} onClose={() => setOpen(null)} />
    </div>
  );
}
