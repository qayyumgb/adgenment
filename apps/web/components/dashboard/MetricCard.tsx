"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  trend: "up" | "down" | "neutral";
  prefix?: string;
  suffix?: string;
  sparklineData?: number[];
}

export default function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  prefix,
  suffix,
  sparklineData,
}: MetricCardProps) {
  const trendStyles = {
    up: {
      pill: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
      arrow: <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />,
      stroke: "#10b981",
      fill: "url(#metric-up)",
    },
    down: {
      pill: "bg-rose-50 text-rose-700 ring-rose-200/60",
      arrow: <ArrowDownRight className="h-3 w-3" strokeWidth={2.5} />,
      stroke: "#ef4444",
      fill: "url(#metric-down)",
    },
    neutral: {
      pill: "bg-slate-100 text-slate-600 ring-slate-200/60",
      arrow: <Minus className="h-3 w-3" strokeWidth={2.5} />,
      stroke: "#6366f1",
      fill: "url(#metric-brand)",
    },
  }[trend];

  const sparkData = sparklineData?.map((v, i) => ({ i, v }));

  return (
    <div className="metric-card group animate-count-up">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </p>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-0.5">
        {prefix && (
          <span className="text-lg font-semibold text-slate-400">{prefix}</span>
        )}
        <span className="text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </span>
        {suffix && (
          <span className="text-lg font-semibold text-slate-400">{suffix}</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={clsx(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
              trendStyles.pill
            )}
          >
            {trendStyles.arrow}
            {change > 0 ? "+" : ""}
            {change}%
          </span>
          <span className="truncate text-xs text-slate-500">{changeLabel}</span>
        </div>

        {sparkData && sparkData.length > 1 && (
          <div className="h-12 w-20 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sparkData}
                margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="metric-up" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="metric-down" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="metric-brand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ display: "none" }}
                  cursor={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={trendStyles.stroke}
                  strokeWidth={2}
                  fill={trendStyles.fill}
                  isAnimationActive
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
