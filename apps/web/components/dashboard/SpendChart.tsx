"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = "7D" | "30D" | "90D";

type Point = {
  date: string;
  label: string;
  spend: number;
  roas: number;
};

export type SpendChartPoint = {
  date: string; // YYYY-MM-DD
  spend: number;
  roas: number;
};

interface SpendChartProps {
  /** Real timeseries data. If omitted, falls back to mock generated data. */
  data?: SpendChartPoint[];
  /** Show the 7D/30D/90D range tabs. Defaults to true when not providing data. */
  showRangeTabs?: boolean;
  /** Optional title override. */
  title?: string;
}

// Deterministic pseudo-random for stable SSR output.
function seeded(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function generateData(days: number): Point[] {
  const today = new Date("2026-05-25T00:00:00Z");
  const out: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const dow = d.getUTCDay();
    const weekend = dow === 0 || dow === 6;

    const base = weekend ? 1000 : 1800;
    const variance = seeded(days - i, 1) * 600 - 200;
    const spend = Math.max(800, Math.min(2400, Math.round(base + variance)));

    // ROAS inversely correlated with spend spikes, with own jitter
    const norm = (spend - 800) / 1600;
    const roasBase = 4.2 - norm * 2.0;
    const roas = Math.max(
      1.8,
      Math.min(4.2, +(roasBase + (seeded(days - i, 7) - 0.5) * 0.4).toFixed(2))
    );

    out.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      spend,
      roas,
    });
  }
  return out;
}

const TABS: Range[] = ["7D", "30D", "90D"];
const TAB_DAYS: Record<Range, number> = { "7D": 7, "30D": 30, "90D": 90 };

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function SpendChart({
  data: dataProp,
  showRangeTabs,
  title = "Spend & ROAS",
}: SpendChartProps = {}) {
  const [range, setRange] = useState<Range>("30D");

  // If real data is provided, use it; otherwise fall back to the mock
  // generator (mainly for storybook / unconnected previews).
  const data = useMemo<Point[]>(() => {
    if (dataProp) {
      return dataProp.map((d) => ({
        date: d.date,
        label: new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        spend: Number(d.spend) || 0,
        roas: Number(d.roas) || 0,
      }));
    }
    return generateData(TAB_DAYS[range]);
  }, [dataProp, range]);

  const showTabs = showRangeTabs ?? !dataProp;

  const totals = useMemo(() => {
    const totalSpend = data.reduce((s, d) => s + d.spend, 0);
    const avgRoas =
      data.reduce((s, d) => s + d.roas, 0) / Math.max(1, data.length);
    return { totalSpend, avgRoas };
  }, [data]);

  // Show ~6 ticks
  const tickInterval = Math.max(1, Math.floor(data.length / 6));

  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">
            {fmtMoney(totals.totalSpend)} spent ·{" "}
            <span className="font-semibold text-emerald-600">
              {totals.avgRoas.toFixed(2)}x
            </span>{" "}
            avg ROAS
          </p>
        </div>

        {showTabs && (
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRange(t)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                  range === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-sm bg-primary" /> Spend
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> ROAS
        </span>
      </div>

      <div className="mt-2 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 8, left: -8, bottom: 0 }}
          >
            <defs>
              <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 4"
              stroke="#e2e8f0"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              interval={tickInterval - 1}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
              dy={6}
            />
            <YAxis
              yAxisId="spend"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
              tickFormatter={(v) => `$${Math.round(v / 100) / 10}k`}
              width={40}
            />
            <YAxis
              yAxisId="roas"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 500 }}
              tickFormatter={(v) => `${v}x`}
              domain={[1.5, 4.5]}
              width={32}
            />
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeDasharray: "3 4" }}
              content={<CustomTooltip />}
            />
            <Area
              yAxisId="spend"
              type="monotone"
              dataKey="spend"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#spend-fill)"
              isAnimationActive
              animationDuration={800}
            />
            <Line
              yAxisId="roas"
              type="monotone"
              dataKey="roas"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: "#10b981", stroke: "white", strokeWidth: 2 }}
              isAnimationActive
              animationDuration={800}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-1 space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-sm bg-primary" /> Spend
          </span>
          <span className="text-sm font-bold text-slate-900">
            {fmtMoney(p.spend)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" /> ROAS
          </span>
          <span className="text-sm font-bold text-emerald-600">
            {p.roas.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
  );
}
