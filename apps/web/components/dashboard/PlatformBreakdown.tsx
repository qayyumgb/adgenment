"use client";

import { useState } from "react";
import clsx from "clsx";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Platform = {
  name: string;
  pct: number;
  spend: number;
  color: string;
};

export type PlatformBreakdownPoint = {
  platform: string;
  spend: number;
  revenue?: number;
};

const FALLBACK_PLATFORMS: Platform[] = [
  { name: "Meta", pct: 42, spend: 10300, color: "#6366f1" },
  { name: "Google", pct: 31, spend: 7600, color: "#8b5cf6" },
  { name: "TikTok", pct: 18, spend: 4400, color: "#ec4899" },
  { name: "LinkedIn", pct: 9, spend: 2220, color: "#06b6d4" },
];

const PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
];

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function prettyPlatform(p: string): string {
  // Convert enum-style "META" → "Meta"
  if (p === p.toUpperCase()) {
    return p.charAt(0) + p.slice(1).toLowerCase();
  }
  return p;
}

interface PlatformBreakdownProps {
  data?: PlatformBreakdownPoint[];
}

export default function PlatformBreakdown({ data }: PlatformBreakdownProps = {}) {
  const [active, setActive] = useState<string | null>(null);

  const PLATFORMS: Platform[] = data
    ? (() => {
        const total =
          data.reduce((s, p) => s + (Number(p.spend) || 0), 0) || 1;
        return data
          .map((p, i) => {
            const spend = Number(p.spend) || 0;
            return {
              name: prettyPlatform(p.platform),
              spend,
              pct: Math.round((spend / total) * 100),
              color: PALETTE[i % PALETTE.length],
            };
          })
          .filter((p) => p.spend > 0)
          .sort((a, b) => b.spend - a.spend);
      })()
    : FALLBACK_PLATFORMS;

  const TOTAL = PLATFORMS.reduce((sum, p) => sum + p.spend, 0);

  if (data && PLATFORMS.length === 0) {
    return (
      <section className="flex h-full flex-col items-center justify-center rounded-2xl border border-slate-200/70 bg-white p-5 text-center shadow-card">
        <h3 className="text-base font-bold text-slate-900">
          Spend by Platform
        </h3>
        <p className="mt-1 text-xs text-slate-500">No platform data yet</p>
        <p className="mt-4 max-w-[14rem] text-[11px] text-slate-400">
          Sync your ad accounts to see spend split per platform.
        </p>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Spend by Platform</h3>
        <p className="text-xs text-slate-500">
          Last 30 days · across {PLATFORMS.length} channels
        </p>
      </div>

      <div className="relative mx-auto h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={PLATFORMS}
              dataKey="pct"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={84}
              paddingAngle={3}
              stroke="none"
              isAnimationActive
              animationDuration={900}
              onMouseEnter={(_, idx) =>
                setActive(PLATFORMS[idx]?.name ?? null)
              }
              onMouseLeave={() => setActive(null)}
            >
              {PLATFORMS.map((p) => (
                <Cell
                  key={p.name}
                  fill={p.color}
                  opacity={
                    active === null ? 1 : active === p.name ? 1 : 0.35
                  }
                />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 8px 24px -8px rgba(15,23,42,0.18)",
                fontSize: 12,
                padding: "8px 12px",
              }}
              formatter={(value, _name, item) => [
                `${value}%`,
                (item?.payload as Platform | undefined)?.name ?? "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Total
          </span>
          <span className="text-xl font-bold text-slate-900">
            {fmtMoney(TOTAL)}
          </span>
          <span className="text-[10px] text-slate-400">30‐day spend</span>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {PLATFORMS.map((p) => (
          <li
            key={p.name}
            onMouseEnter={() => setActive(p.name)}
            onMouseLeave={() => setActive(null)}
            className={clsx(
              "rounded-xl p-2 transition",
              active === p.name ? "bg-slate-50" : "bg-transparent"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: p.color }}
                />
                <span className="text-sm font-semibold text-slate-700">
                  {p.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500">
                  {p.pct}%
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {fmtMoney(p.spend)}
                </span>
              </div>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${p.pct}%`, backgroundColor: p.color }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
