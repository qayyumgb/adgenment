"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type SegmentOption<T extends string | number> = { value: T; label: ReactNode };

/**
 * Pill-track segmented control (radiogroup semantics, arrow-key navigation).
 * `tone="dark"` for use on dark panels.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  label,
  tone = "light",
  size = "md",
  className = "",
  itemClassName = "",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  /** light: ink active chip · paper: white chip on a sand track · dark: on dark panels. */
  tone?: "light" | "paper" | "dark";
  size?: "sm" | "md";
  className?: string;
  /** Extra classes per option, e.g. `flex-auto` to stretch them. */
  itemClassName?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.value === value);

  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (idx + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  const track =
    tone === "dark" ? "bg-white/[.07] border border-white/10 p-1" : tone === "paper" ? "bg-mk-s3 p-[3px]" : "bg-mk-s2 p-1";
  const on =
    tone === "dark"
      ? "bg-white text-mk-on-light"
      : tone === "paper"
        ? "bg-mk-paper2 text-mk-ink shadow-[0_1px_2px_rgba(21,19,26,.12)]"
        : "bg-mk-ink text-mk-paper";
  const off = tone === "dark" ? "text-[#b9b4cc] hover:text-white" : "text-mk-ink2 hover:text-mk-ink";
  const h = size === "sm" ? "h-[34px] px-3.5 text-[13px]" : "h-[38px] px-3.5 text-[13.5px]";

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={`inline-flex flex-wrap gap-0.5 rounded-full ${track} ${className}`}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mk-brand ${h} ${itemClassName} ${
              active ? on : off
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
