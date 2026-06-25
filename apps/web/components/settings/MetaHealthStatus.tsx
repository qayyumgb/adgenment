"use client";

/**
 * Full Meta connection health panel. Fetches the health report for an ad
 * account and renders a healthy / degraded / blocked banner plus a card per
 * failing check (errors first, then warnings), each with a plain-English
 * message and an action. Includes a manual refresh (forces a fresh check).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useApiClient } from "@/lib/api";
import type { HealthCheck, MetaHealthReport } from "@/lib/api";

function CheckCard({ check }: { check: HealthCheck }) {
  const error = check.status === "error";
  const Icon = error ? XCircle : check.status === "warning" ? AlertTriangle : CheckCircle2;
  const internal = check.actionUrl?.startsWith("/");
  return (
    <div
      className={clsx(
        "rounded-xl border border-l-4 bg-white p-3.5",
        error ? "border-rose-200 border-l-rose-500" : "border-amber-200 border-l-amber-400"
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", error ? "text-rose-500" : "text-amber-500")} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{check.title}</p>
          <p className="mt-0.5 text-xs text-slate-600">{check.message}</p>
          {check.actionUrl ? (
            internal ? (
              <Link
                href={check.actionUrl}
                className="mt-1.5 inline-block text-xs font-semibold text-primary hover:underline"
              >
                {check.action} →
              </Link>
            ) : (
              <a
                href={check.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                {check.action} <ExternalLink className="h-3 w-3" />
              </a>
            )
          ) : (
            <p className="mt-1 text-[11px] font-medium text-slate-400">{check.action}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MetaHealthStatus({
  adAccountId,
  hideWhenHealthy = false,
}: {
  adAccountId: string;
  /** Render nothing when everything is healthy (used inline in the wizard). */
  hideWhenHealthy?: boolean;
}) {
  const api = useApiClient();
  const [report, setReport] = useState<MetaHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getMetaHealth(adAccountId)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setCheckedAt(new Date());
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to check");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, adAccountId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await api.refreshMetaHealth(adAccountId);
      setReport(r);
      setCheckedAt(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  }, [api, adAccountId]);

  // Wizard mode: stay invisible while loading and when everything's healthy.
  if (hideWhenHealthy && (loading || (report && report.overall === "healthy"))) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your Meta connection…
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        Couldn&apos;t check your Meta connection.{" "}
        <button type="button" onClick={refresh} className="font-semibold text-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

  const errors = report.checks.filter((c) => c.status === "error");
  const warnings = report.checks.filter((c) => c.status === "warning");

  const banner =
    report.overall === "healthy"
      ? { cls: "border-emerald-200 bg-emerald-50/60 text-emerald-800", icon: CheckCircle2, iconCls: "text-emerald-500", text: "Meta account is fully connected and ready" }
      : report.overall === "degraded"
        ? { cls: "border-amber-200 bg-amber-50/60 text-amber-800", icon: AlertTriangle, iconCls: "text-amber-500", text: "Meta connected with some limitations" }
        : { cls: "border-rose-200 bg-rose-50/60 text-rose-800", icon: XCircle, iconCls: "text-rose-500", text: "Meta connection has issues that need attention" };
  const BannerIcon = banner.icon;

  return (
    <div className="space-y-3">
      <div className={clsx("flex items-center justify-between gap-3 rounded-xl border p-3.5", banner.cls)}>
        <div className="flex items-center gap-2">
          <BannerIcon className={clsx("h-5 w-5 shrink-0", banner.iconCls)} />
          <div>
            <p className="text-sm font-bold">{banner.text}</p>
            {checkedAt && (
              <p className="text-[11px] opacity-70">Last checked {timeAgo(checkedAt)}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-current/20 bg-white/60 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-2">
          {errors.map((c) => (
            <CheckCard key={c.code} check={c} />
          ))}
          {warnings.map((c) => (
            <CheckCard key={c.code} check={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}
