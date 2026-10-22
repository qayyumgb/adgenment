"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

/* ── Segmented control (guide §4) ─────────────────────────────────────────
 * Track surface-2, 3px padding, radius 10. Active item: white chip + shadow.
 * Radiogroup semantics with arrow-key navigation.
 */
export type SegmentOption<T extends string | number> = {
  value: T;
  label: ReactNode;
  /** Optional count shown after the label ("Active 12"). */
  count?: number;
  disabled?: boolean;
};

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "md",
  stretch = false,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: "sm" | "md";
  /** Items share the full width. */
  stretch?: boolean;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir || enabled.length === 0) return;
    e.preventDefault();
    const at = enabled.indexOf(options.findIndex((o) => o.value === value));
    const next = enabled[(at + dir + enabled.length) % enabled.length];
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cn("inline-flex gap-0.5 rounded-ctl bg-surface-2 p-[3px]", stretch && "flex w-full", className)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-[5px] text-[13px]",
              stretch && "flex-1",
              on ? "bg-surface text-ink shadow-[0_1px_2px_rgba(22,20,40,.12)]" : "text-ink-2 hover:text-ink"
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn("tabular-nums", on ? "text-ink-2" : "text-ink-3")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Toggle (guide §4): 34×20 pill, brand when on, 16px knob, 150ms ─────── */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Accessible name (visually hidden). */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-[34px] flex-none rounded-full transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-brand" : "bg-line-2",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-transform duration-150 motion-reduce:transition-none",
          checked && "translate-x-[14px]"
        )}
      />
    </button>
  );
}

/* ── Checkbox (guide §4): 18px, radius 5, 1.5px border ───────────────────── */
export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  hideLabel = false,
  disabled,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  /** Keep the label for screen readers only (e.g. table row selection). */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const on = checked || indeterminate;
  return (
    <label
      htmlFor={id}
      className={cn("inline-flex cursor-pointer items-center gap-2.5 text-sm", disabled && "cursor-not-allowed opacity-50", className)}
    >
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-checked={indeterminate ? "mixed" : checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white transition-colors",
          "peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand-soft",
          on ? "border-brand bg-brand" : "border-line-2 bg-surface"
        )}
      >
        {indeterminate ? <Minus size={12} strokeWidth={3} /> : checked ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className={cn(hideLabel && "sr-only")}>{label}</span>
    </label>
  );
}
