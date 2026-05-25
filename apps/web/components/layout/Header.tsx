"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  Search,
  Bell,
  Plus,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import { useApi } from "@/hooks/useApi";

const PLAN_META: Record<
  string,
  { label: string; muted: string; cta: string }
> = {
  FREE: { label: "Free Plan", muted: "text-slate-500", cta: "Upgrade" },
  STARTER: {
    label: "Starter",
    muted: "text-emerald-700",
    cta: "Manage",
  },
  PRO: { label: "Pro", muted: "text-primary-700", cta: "Manage" },
  ENTERPRISE: {
    label: "Enterprise",
    muted: "text-amber-700",
    cta: "Manage",
  },
};

type Notification = {
  id: string;
  emoji: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    emoji: "🚀",
    title: "Campaign launched",
    body: "Summer Sale ‐ Meta is now live and serving impressions.",
    time: "2m ago",
    unread: true,
  },
  {
    id: "n2",
    emoji: "💡",
    title: "AI optimization applied",
    body: "Budget reallocated +$120/day to your top‐performing ad set.",
    time: "1h ago",
    unread: true,
  },
  {
    id: "n3",
    emoji: "📊",
    title: "Weekly report ready",
    body: "ROAS up 18% week over week. Tap to view the breakdown.",
    time: "3h ago",
    unread: false,
  },
  {
    id: "n4",
    emoji: "⚠️",
    title: "Creative fatigue detected",
    body: "Ad set \"Retargeting Q3\" CTR dropped below threshold.",
    time: "yesterday",
    unread: false,
  },
];

export default function Header() {
  const [notifOpen, setNotifOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread).length;

  // Live plan badge — pulls from /auth/me. Cheap call, gets cached by SWR
  // pattern in useApi.
  const meQ = useApi((c) => c.getMe(), []);
  const planKey = meQ.data?.workspace?.plan ?? meQ.data?.user.plan ?? "FREE";
  const plan = PLAN_META[planKey] ?? PLAN_META.FREE;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen]);

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-200/70 bg-white/80 px-6 backdrop-blur-xl"
      style={{ height: "var(--header-height)" }}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search campaigns, audiences, creatives…"
          className={clsx(
            "input-search",
            focused && "ring-0"
          )}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline-flex">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* New Campaign */}
        <Link
          href="/campaigns?new=1"
          className="btn-brand hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          <span>New Campaign</span>
        </Link>

        {/* Notifications */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
            className={clsx(
              "relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-primary/40 hover:text-primary",
              notifOpen && "border-primary/40 text-primary"
            )}
          >
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-12 z-40 w-[360px] origin-top-right animate-in rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Mark all read
                </button>
              </div>
              <ul className="max-h-[400px] space-y-0.5 overflow-y-auto">
                {NOTIFICATIONS.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={clsx(
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50",
                        n.unread && "bg-primary/[0.04]"
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-base">
                        {n.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {n.title}
                          </p>
                          {n.unread && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-500">
                          {n.body}
                        </p>
                        <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                          {n.time}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 px-3 py-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  View all notifications →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Plan Pill */}
        <Link
          href="/billing"
          className="hidden items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary/[0.1] md:inline-flex"
        >
          <span className={plan.muted}>{plan.label}</span>
          <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
          <span className="text-primary">{plan.cta}</span>
        </Link>

        {/* User */}
        <div className="ml-1 flex h-9 w-9 items-center justify-center">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "h-9 w-9 rounded-xl ring-2 ring-slate-100",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
