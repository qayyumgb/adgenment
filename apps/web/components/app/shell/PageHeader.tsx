"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Page header (guide §3.1): small context line, title 24/600, one-line
 * summary, actions on the right (secondary then one primary), optional tabs
 * inside. Sticky under the top bar so both scroll as one block.
 */
export function PageHeader({
  kicker,
  title,
  summary,
  actions,
  tabs,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  summary?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sticky top-14 z-20 border-b border-line bg-surface min-[900px]:top-16", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <div className="min-w-0 flex-[1_1_280px]">
          {kicker && <div className="text-xs text-ink-3">{kicker}</div>}
          <h1 className="m-0 mt-0.5 text-2xl font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
          {summary && <div className="mt-0.5 text-[13px] text-ink-2">{summary}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="overflow-x-auto px-[clamp(16px,4vw,32px)] [scrollbar-width:none]">{tabs}</div>}
    </div>
  );
}

/** Underline tabs for the page header, with optional count pills. */
export function PageTabs({
  tabs,
  active,
  label,
}: {
  tabs: { id: string; label: string; href: string; count?: number }[];
  active: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-5">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.href}
            aria-current={on ? "page" : undefined}
            scroll={false}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm no-underline transition-colors",
              on ? "border-brand font-semibold text-ink" : "border-transparent font-medium text-ink-2 hover:text-ink"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-surface-3 px-1.5 text-xs tabular-nums text-ink-2">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Standard page body padding (gutter per guide §2.3). */
export function PageBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-col gap-6 px-[clamp(16px,4vw,32px)] pb-10 pt-6", className)}>{children}</div>;
}
