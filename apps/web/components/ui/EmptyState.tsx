"use client";

import Link from "next/link";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void; icon?: LucideIcon };
  secondaryAction?: { label: string; href: string };
  className?: string;
  compact?: boolean;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center",
        compact ? "px-6 py-10" : "px-6 py-16",
        className
      )}
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-glow">
          <Icon className="h-7 w-7" strokeWidth={2} />
        </div>
      </div>
      <h4 className="text-lg font-bold text-slate-900">{title}</h4>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="btn-brand mt-5"
        >
          {action.icon && (
            <action.icon className="h-4 w-4" strokeWidth={2.5} />
          )}
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <Link
          href={secondaryAction.href}
          className="mt-3 text-xs font-semibold text-slate-500 transition hover:text-primary"
        >
          {secondaryAction.label} →
        </Link>
      )}
    </div>
  );
}
