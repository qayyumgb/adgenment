import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ── Pill / status (guide §4): 12/600, 2×8, radius 999 ───────────────────── */
export type PillTone = "pos" | "brand" | "warn" | "neg" | "neutral" | "muted";

const PILL: Record<PillTone, string> = {
  pos: "bg-pos-soft text-pos",
  brand: "bg-brand-soft text-brand-ink",
  warn: "bg-warn-soft text-warn",
  neg: "bg-neg-soft text-neg",
  neutral: "bg-surface-3 text-ink-2",
  muted: "bg-surface-2 text-ink-2",
};

export function Pill({ tone = "neutral", className, children }: { tone?: PillTone; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", PILL[tone], className)}>
      {children}
    </span>
  );
}

/** Campaign / creative status → pill tone (guide: Active pos, Learning brand, Paused warn, Draft surface-3, Fatigued neg). */
export const STATUS_TONE: Record<string, PillTone> = {
  Active: "pos",
  Live: "pos",
  Learning: "brand",
  "Learning limited": "warn",
  Paused: "warn",
  Draft: "neutral",
  Ended: "neutral",
  Fatigued: "neg",
  Error: "neg",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <Pill tone={STATUS_TONE[status] ?? "neutral"} className={className}>
      {status}
    </Pill>
  );
}

/* ── Delta pill (guide §4): ↑/↓ + value; good = pos, bad = neg ───────────── */
export function DeltaPill({
  value,
  higherIsBetter = true,
  format = (v) => `${Math.abs(v).toFixed(1)}%`,
  className,
}: {
  /** Change vs the previous period (e.g. 12.4 for +12.4%). */
  value: number | null | undefined;
  /** For costs (CPA, CPC) a decrease is good. */
  higherIsBetter?: boolean;
  format?: (v: number) => string;
  className?: string;
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={cn("rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-3", className)}>—</span>;
  }
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : value > 0 === higherIsBetter;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        good == null ? "bg-surface-2 text-ink-2" : good ? "bg-pos-soft text-pos" : "bg-neg-soft text-neg",
        className
      )}
    >
      <span aria-hidden="true">{flat ? "→" : value > 0 ? "↑" : "↓"}</span>
      <span className="sr-only">{flat ? "No change" : value > 0 ? "Up" : "Down"}</span>
      {format(value)}
    </span>
  );
}

/* ── Platform badge (guide §4): square, platform colour, 1–2-letter mark ───── */
export type PlatformKey = "META" | "GOOGLE" | "TIKTOK" | "SNAPCHAT" | "LINKEDIN" | "YOUTUBE" | "PINTEREST" | "X";

export const PLATFORM_META: Record<PlatformKey, { name: string; mark: string; className: string }> = {
  META: { name: "Meta", mark: "M", className: "bg-[var(--p-meta)] text-white" },
  GOOGLE: { name: "Google", mark: "G", className: "bg-[var(--p-google)] text-white" },
  // TikTok uses ink, so it inverts in dark mode (guide §2.1).
  TIKTOK: { name: "TikTok", mark: "T", className: "bg-ink text-surface" },
  SNAPCHAT: { name: "Snapchat", mark: "S", className: "bg-[var(--p-snap)] text-black" },
  LINKEDIN: { name: "LinkedIn", mark: "in", className: "bg-[var(--p-li)] text-white" },
  YOUTUBE: { name: "YouTube", mark: "YT", className: "bg-[#ff0000] text-white" },
  PINTEREST: { name: "Pinterest", mark: "P", className: "bg-[#e60023] text-white" },
  X: { name: "X", mark: "X", className: "bg-ink text-surface" },
};

export function PlatformBadge({
  platform,
  size = 24,
  withName = false,
  className,
}: {
  platform: PlatformKey;
  size?: 20 | 22 | 24 | 26 | 34 | 44;
  /** Show the platform name next to the badge. */
  withName?: boolean;
  className?: string;
}) {
  const p = PLATFORM_META[platform] ?? PLATFORM_META.META;
  const badge = (
    <span
      role={withName ? undefined : "img"}
      aria-label={withName ? undefined : p.name}
      aria-hidden={withName || undefined}
      className={cn("inline-flex flex-none items-center justify-center font-bold leading-none", p.className, !withName && className)}
      style={{ width: size, height: size, borderRadius: size >= 34 ? 10 : size >= 26 ? 7 : 6, fontSize: Math.round(size * 0.42) }}
    >
      {p.mark}
    </span>
  );
  if (!withName) return badge;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {badge}
      <span>{p.name}</span>
    </span>
  );
}

/* ── Card (guide §2.3): white, 1px line, radius 16, soft shadow ──────────── */
export function Card({
  className,
  padded = true,
  children,
  ...rest
}: { padded?: boolean; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-card border border-line bg-surface shadow-card", padded && "p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  sub,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon}
        <div className="min-w-0">
          <h2 className="m-0 text-base font-semibold leading-snug">{title}</h2>
          {sub && <div className="mt-0.5 text-[13px] text-ink-2">{sub}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-none items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Skeleton: shimmer while loading (reduced motion: static) ────────────── */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-lg bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--surface-3)_50%,var(--surface-2)_100%)] bg-[length:200%_100%]",
        "animate-[adx-shimmer_1.4s_linear_infinite] motion-reduce:animate-none",
        className
      )}
      {...rest}
    />
  );
}

/* ── Empty state (guide §4): title 18/600, one line, one button ───────────── */
export function EmptyState({
  title,
  body,
  action,
  icon,
  dashed = false,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  /** Dashed border for drop zones and "plan appears here" areas. */
  dashed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-card px-6 py-10 text-center",
        dashed ? "border border-dashed border-line-2" : "bg-surface-2",
        className
      )}
    >
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <div className="text-lg font-semibold">{title}</div>
      {body && <p className="m-0 max-w-[420px] text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
