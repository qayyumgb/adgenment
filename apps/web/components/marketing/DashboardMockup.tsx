"use client";

import { TrendingUp, MoreHorizontal, Sparkles } from "lucide-react";

/**
 * Stylized dashboard preview used in marketing pages. Pure CSS/SVG — no real
 * data and no client-side state needed. Designed to look credible at a glance:
 * window chrome, sidebar with active item, metric tiles, a smooth area chart,
 * and a live campaigns table.
 */
export function DashboardMockup() {
  return (
    <div className="relative">
      {/* Outer browser frame */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 p-1.5 shadow-2xl shadow-indigo-950/40 ring-1 ring-white/10">
        {/* Top chrome */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="rounded-md bg-slate-950/60 px-3 py-1 font-mono text-[10px] text-slate-400 ring-1 ring-white/5">
            app.advertix.io/dashboard
          </div>
          <div className="w-12" />
        </div>

        {/* App body */}
        <div className="grid grid-cols-[180px_1fr] gap-0 overflow-hidden rounded-xl bg-[#0a0e1a]">
          {/* Sidebar */}
          <aside className="border-r border-white/5 p-3">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600">
                <Sparkles className="h-3 w-3 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-xs font-bold text-white">Advertix</span>
            </div>
            <div className="mt-4 space-y-1">
              <SidebarItem label="Dashboard" active />
              <SidebarItem label="Campaigns" />
              <SidebarItem label="Analytics" />
              <SidebarItem label="Audiences" />
              <SidebarItem label="Creatives" />
              <SidebarItem label="AI Planner" badge="NEW" />
              <SidebarItem label="Settings" />
            </div>
          </aside>

          {/* Main */}
          <main className="p-4 sm:p-5">
            {/* Top row: title + ai pill */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Overview · Last 30 days
                </div>
                <div className="mt-1 text-base font-bold text-white">
                  Good morning, AB 👋
                </div>
              </div>
              <div className="hidden items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold text-indigo-300 ring-1 ring-indigo-400/20 sm:flex">
                <Sparkles className="h-3 w-3" strokeWidth={2.5} />
                AI active
              </div>
            </div>

            {/* Metric tiles */}
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <MetricTile label="Total Spend" value="$24,180" delta="+12.4%" />
              <MetricTile label="Revenue" value="$71,240" delta="+18.2%" />
              <MetricTile label="ROAS" value="2.94x" delta="+0.41x" highlight />
            </div>

            {/* Chart */}
            <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  Performance
                  <TrendingUp className="h-3 w-3 text-emerald-400" strokeWidth={2.5} />
                </div>
                <div className="flex gap-1 text-[9px] font-bold text-slate-500">
                  <span className="rounded bg-white/5 px-1.5 py-0.5">7D</span>
                  <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-indigo-300">
                    30D
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5">90D</span>
                </div>
              </div>
              <Chart />
            </div>

            {/* Campaign rows */}
            <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-bold text-white">Active campaigns</div>
                <MoreHorizontal className="h-4 w-4 text-slate-500" />
              </div>
              <CampaignRow
                name="Summer Sale — IG Reels"
                platform="Meta"
                platformColor="#1877F2"
                spend="$2.4k"
                roas="3.2x"
              />
              <CampaignRow
                name="Brand Awareness Q3"
                platform="Google"
                platformColor="#EA4335"
                spend="$1.8k"
                roas="2.1x"
              />
              <CampaignRow
                name="Retargeting — Cart Abandoners"
                platform="TikTok"
                platformColor="#0f172a"
                spend="$960"
                roas="4.6x"
                highlight
              />
            </div>
          </main>
        </div>
      </div>

      {/* Floating AI suggestion card */}
      <div className="absolute -bottom-6 -left-3 hidden max-w-[240px] rounded-2xl border border-indigo-300/30 bg-white/95 p-3 shadow-2xl shadow-indigo-900/30 backdrop-blur sm:block lg:-bottom-8 lg:-left-10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow shadow-indigo-500/40">
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
            AI Suggestion
          </span>
        </div>
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-slate-700">
          <strong className="text-slate-900">Pause &quot;Brand Awareness Q3&quot;</strong> —
          ROAS 2.1x is below your 2.5x target. Reallocate ~$600 to TikTok
          retargeting for +$1.2k projected revenue.
        </p>
        <div className="mt-2 flex gap-1.5">
          <div className="rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white">
            Apply
          </div>
          <div className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
            Dismiss
          </div>
        </div>
      </div>

      {/* Floating ROAS chip */}
      <div className="absolute -right-3 -top-4 hidden rounded-2xl border border-white/15 bg-slate-900/90 p-3 shadow-2xl shadow-slate-950/60 backdrop-blur sm:block lg:-right-10 lg:-top-6">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Best Campaign
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <div className="text-2xl font-bold text-white">4.6×</div>
          <div className="text-[10px] font-bold text-emerald-400">ROAS</div>
        </div>
        <div className="mt-1 text-[10px] font-medium text-slate-400">
          Cart Abandoners
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  label,
  active,
  badge,
}: {
  label: string;
  active?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold ${
        active
          ? "bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-400/30"
          : "text-slate-400"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={`h-1 w-1 rounded-full ${
            active ? "bg-indigo-400" : "bg-slate-700"
          }`}
        />
        {label}
      </div>
      {badge && (
        <span className="rounded-sm bg-indigo-500/20 px-1 text-[8px] font-bold text-indigo-300">
          {badge}
        </span>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  delta,
  highlight,
}: {
  label: string;
  value: string;
  delta: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 ${
        highlight
          ? "border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 to-violet-500/10"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <div className="text-base font-bold text-white">{value}</div>
        <div className="text-[10px] font-bold text-emerald-400">{delta}</div>
      </div>
    </div>
  );
}

function CampaignRow({
  name,
  platform,
  platformColor,
  spend,
  roas,
  highlight,
}: {
  name: string;
  platform: string;
  platformColor: string;
  spend: string;
  roas: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${
        highlight ? "bg-indigo-500/10" : ""
      }`}
    >
      <div className="flex items-center gap-2 truncate">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
          style={{ backgroundColor: platformColor }}
        >
          {platform.charAt(0)}
        </span>
        <span className="truncate text-[11px] font-medium text-slate-200">
          {name}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-[10px] font-bold text-slate-400">{spend}</span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            highlight
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-white/5 text-slate-300"
          }`}
        >
          {roas}
        </span>
      </div>
    </div>
  );
}

function Chart() {
  return (
    <svg viewBox="0 0 400 80" className="mt-2 h-20 w-full">
      <defs>
        <linearGradient id="dm-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="dm-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <path
        d="M0 70 L25 58 L50 62 L75 45 L100 50 L125 35 L150 38 L175 26 L200 31 L225 22 L250 28 L275 18 L300 22 L325 14 L350 18 L375 10 L400 14 L400 80 L0 80 Z"
        fill="url(#dm-gradient)"
      />
      <path
        d="M0 70 L25 58 L50 62 L75 45 L100 50 L125 35 L150 38 L175 26 L200 31 L225 22 L250 28 L275 18 L300 22 L325 14 L350 18 L375 10 L400 14"
        stroke="url(#dm-line)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="375" cy="10" r="4" fill="#c084fc" />
      <circle cx="375" cy="10" r="8" fill="#c084fc" fillOpacity={0.2} />
    </svg>
  );
}
