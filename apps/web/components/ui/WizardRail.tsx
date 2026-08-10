"use client";

import clsx from "clsx";
import { Check, type LucideIcon } from "lucide-react";

export interface WizardStep {
  key: string;
  label: string;
  /** One line under the label — what this step is actually for. */
  hint?: string;
  icon?: LucideIcon;
}

/**
 * Vertical step rail for the full-height wizard modals.
 *
 * Replaces the horizontal dot-and-line indicator those wizards used. That
 * pattern fit a narrow centered dialog but degraded badly as steps were added:
 * six unlabelled circles told you a number, not where you were or what was
 * left. A vertical rail has room for every step's name and a one-line hint,
 * all visible at once, which is what makes a six-step flow feel finite.
 *
 * Completed steps are clickable so users can jump back and check an earlier
 * answer. Steps ahead are not — they may depend on validation that hasn't run.
 */
export function WizardRail({
  steps,
  current,
  onStepClick,
  disabled = false,
}: {
  steps: readonly WizardStep[];
  /** Zero-based index of the active step. */
  current: number;
  /** Omit to make completed steps non-interactive. */
  onStepClick?: (index: number) => void;
  /** Freeze navigation (e.g. while publishing). */
  disabled?: boolean;
}) {
  return (
    <aside className="hidden w-[240px] shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/50 px-3 py-5 md:block">
      <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Steps
      </p>
      <ol className="space-y-0.5">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = s.icon;
          const canJump = done && !!onStepClick && !disabled;

          return (
            <li key={s.key}>
              <button
                type="button"
                disabled={!canJump}
                onClick={canJump ? () => onStepClick(i) : undefined}
                aria-current={active ? "step" : undefined}
                className={clsx(
                  "group flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition",
                  active && "bg-white shadow-sm ring-1 ring-primary/20",
                  canJump && "cursor-pointer hover:bg-white/70",
                  !canJump && !active && "cursor-default"
                )}
              >
                <span
                  className={clsx(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition",
                    done
                      ? "bg-primary text-white"
                      : active
                        ? "bg-primary/15 text-primary ring-2 ring-primary"
                        : "bg-slate-200/70 text-slate-400"
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  ) : Icon ? (
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span
                    className={clsx(
                      "block truncate text-[13px] font-semibold leading-tight",
                      active
                        ? "text-slate-900"
                        : done
                          ? "text-slate-600"
                          : "text-slate-400"
                    )}
                  >
                    {s.label}
                  </span>
                  {s.hint && (
                    <span
                      className={clsx(
                        "mt-0.5 block text-[10.5px] leading-snug",
                        active ? "text-slate-500" : "text-slate-400"
                      )}
                    >
                      {s.hint}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/**
 * Compact horizontal progress bar for narrow screens, where the rail is
 * hidden. Keeps "step 3 of 6" legible without eating vertical space.
 */
export function WizardProgressBar({
  steps,
  current,
}: {
  steps: readonly WizardStep[];
  current: number;
}) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <div className="border-b border-slate-100 px-5 py-3 md:hidden">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-bold text-slate-900">
          {steps[current]?.label}
        </span>
        <span className="text-[11px] font-medium text-slate-500">
          {current + 1} of {steps.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
