"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  Pencil,
  PauseCircle,
  PlayCircle,
  Trash2,
  Megaphone,
  Inbox,
  Plus,
} from "lucide-react";

type Platform = "META" | "GOOGLE" | "TIKTOK" | "LINKEDIN";
type Status = "ACTIVE" | "PAUSED" | "DRAFT" | "ENDED";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  platform: Platform;
  status: Status;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  roas: number;
  startDate: string;
};

const CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Summer Sale 2026",
    objective: "Conversions · Retargeting",
    platform: "META",
    status: "ACTIVE",
    budget: 5000,
    spend: 3240,
    impressions: 412000,
    clicks: 8240,
    ctr: 2.0,
    roas: 4.2,
    startDate: "2026-04-28",
  },
  {
    id: "c2",
    name: "Brand Awareness Q2",
    objective: "Reach · Top of funnel",
    platform: "GOOGLE",
    status: "ACTIVE",
    budget: 3500,
    spend: 2890,
    impressions: 287000,
    clicks: 4310,
    ctr: 1.5,
    roas: 2.8,
    startDate: "2026-05-01",
  },
  {
    id: "c3",
    name: "Product Launch — Tide+",
    objective: "Conversions · New SKU",
    platform: "TIKTOK",
    status: "ACTIVE",
    budget: 4200,
    spend: 1820,
    impressions: 198400,
    clicks: 6190,
    ctr: 3.1,
    roas: 3.7,
    startDate: "2026-05-12",
  },
  {
    id: "c4",
    name: "Enterprise Lead Gen",
    objective: "Lead form · B2B",
    platform: "LINKEDIN",
    status: "PAUSED",
    budget: 6000,
    spend: 4100,
    impressions: 84200,
    clicks: 980,
    ctr: 1.2,
    roas: 1.6,
    startDate: "2026-03-18",
  },
  {
    id: "c5",
    name: "Retargeting · Cart Abandon",
    objective: "Conversions · Warm",
    platform: "META",
    status: "ACTIVE",
    budget: 2200,
    spend: 1670,
    impressions: 142800,
    clicks: 4280,
    ctr: 3.0,
    roas: 5.1,
    startDate: "2026-04-02",
  },
  {
    id: "c6",
    name: "Black Friday Teaser",
    objective: "Awareness · Wait‐list",
    platform: "META",
    status: "DRAFT",
    budget: 8000,
    spend: 0,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    roas: 0,
    startDate: "2026-11-15",
  },
  {
    id: "c7",
    name: "Search · Branded Terms",
    objective: "Search · Brand defense",
    platform: "GOOGLE",
    status: "ACTIVE",
    budget: 1800,
    spend: 1240,
    impressions: 96400,
    clicks: 3850,
    ctr: 4.0,
    roas: 6.2,
    startDate: "2026-02-08",
  },
  {
    id: "c8",
    name: "Winter Collection 2025",
    objective: "Conversions · Apparel",
    platform: "TIKTOK",
    status: "ENDED",
    budget: 3000,
    spend: 2980,
    impressions: 218000,
    clicks: 5240,
    ctr: 2.4,
    roas: 2.1,
    startDate: "2025-12-01",
  },
];

const PLATFORM_STYLES: Record<Platform, { label: string; bg: string; text: string }> =
  {
    META: { label: "Meta", bg: "bg-[#1877F2]/10", text: "text-[#1877F2]" },
    GOOGLE: { label: "Google", bg: "bg-[#EA4335]/10", text: "text-[#EA4335]" },
    TIKTOK: { label: "TikTok", bg: "bg-slate-900/[0.08]", text: "text-slate-900" },
    LINKEDIN: {
      label: "LinkedIn",
      bg: "bg-[#0A66C2]/10",
      text: "text-[#0A66C2]",
    },
  };

const STATUS_STYLES: Record<Status, { label: string; cls: string; dot: string }> =
  {
    ACTIVE: { label: "Active", cls: "text-emerald-700", dot: "active" },
    PAUSED: { label: "Paused", cls: "text-amber-700", dot: "paused" },
    DRAFT: { label: "Draft", cls: "text-slate-600", dot: "draft" },
    ENDED: { label: "Ended", cls: "text-rose-700", dot: "ended" },
  };

const TABS: { key: "ALL" | Status; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PAUSED", label: "Paused" },
  { key: "DRAFT", label: "Draft" },
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function CampaignTable() {
  const [tab, setTab] = useState<"ALL" | Status>("ALL");

  const rows = useMemo(
    () => (tab === "ALL" ? CAMPAIGNS : CAMPAIGNS.filter((c) => c.status === tab)),
    [tab]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: CAMPAIGNS.length };
    for (const c of CAMPAIGNS) map[c.status] = (map[c.status] ?? 0) + 1;
    return map;
  }, []);

  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white shadow-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">Active Campaigns</h3>
          <p className="text-xs text-slate-500">
            Track performance across all your connected ad accounts
          </p>
        </div>
        <a
          href="/campaigns"
          className="text-sm font-semibold text-primary hover:underline"
        >
          View All →
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-100 px-5 pt-3">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={clsx(
                "relative flex items-center gap-2 px-3 py-2.5 text-sm font-semibold transition",
                active
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
              {typeof count === "number" && (
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    active
                      ? "bg-primary/10 text-primary"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">Name</th>
                <th className="py-3">Platform</th>
                <th className="py-3">Status</th>
                <th className="py-3">Budget / Spend</th>
                <th className="py-3">Impressions</th>
                <th className="py-3">CTR</th>
                <th className="py-3">ROAS</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const pct = c.budget
                  ? Math.min(100, Math.round((c.spend / c.budget) * 100))
                  : 0;
                const plat = PLATFORM_STYLES[c.platform];
                const st = STATUS_STYLES[c.status];
                return (
                  <tr
                    key={c.id}
                    className="group border-t border-slate-50 transition hover:bg-slate-50/70"
                  >
                    <td className="max-w-[220px] px-5 py-3.5">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {c.name}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {c.objective}
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={clsx("pill", plat.bg, plat.text)}
                      >
                        {plat.label}
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-2">
                        <span className={clsx("status-dot", st.dot)} />
                        <span
                          className={clsx("text-xs font-semibold", st.cls)}
                        >
                          {st.label}
                        </span>
                      </span>
                    </td>
                    <td className="py-3.5">
                      <div className="text-xs font-semibold text-slate-700">
                        {formatMoney(c.spend)}{" "}
                        <span className="font-medium text-slate-400">
                          / {formatMoney(c.budget)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={clsx(
                            "h-full rounded-full transition-all",
                            pct >= 90
                              ? "bg-rose-500"
                              : pct >= 70
                                ? "bg-amber-500"
                                : "bg-primary"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 text-sm font-medium text-slate-700">
                      {formatCompact(c.impressions)}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={clsx(
                          "text-sm font-semibold",
                          c.ctr === 0
                            ? "text-slate-400"
                            : c.ctr > 2
                              ? "text-emerald-600"
                              : "text-amber-600"
                        )}
                      >
                        {c.ctr.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={clsx(
                          "text-sm font-bold",
                          c.roas === 0
                            ? "text-slate-400"
                            : c.roas > 2
                              ? "text-emerald-600"
                              : "text-rose-600"
                        )}
                      >
                        {c.roas.toFixed(2)}x
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <IconBtn label="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn
                          label={c.status === "ACTIVE" ? "Pause" : "Resume"}
                        >
                          {c.status === "ACTIVE" ? (
                            <PauseCircle className="h-3.5 w-3.5" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5" />
                          )}
                        </IconBtn>
                        <IconBtn label="Delete" tone="danger">
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function IconBtn({
  children,
  label,
  tone = "default",
}: {
  children: React.ReactNode;
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition",
        tone === "danger"
          ? "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          : "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-glow">
          <Inbox className="h-6 w-6" />
        </div>
      </div>
      <h4 className="text-base font-bold text-slate-900">
        No campaigns in this view
      </h4>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Switch tabs or launch a new campaign to start tracking performance.
      </p>
      <button type="button" className="btn-brand mt-4">
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Launch new campaign
      </button>
    </div>
  );
}
