"use client";

/**
 * Full Meta connection health panel. Fetches the health report for an ad
 * account and renders a healthy / degraded / blocked banner plus a card per
 * failing check (errors first, then warnings), each with a plain-English
 * message and an action. Includes a manual refresh (forces a fresh check).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { useApiClient } from "@/lib/api";
import type { HealthCheck, MetaHealthReport } from "@/lib/api";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { Button, Skeleton } from "@/components/app/ui";

function CheckCard({ check }: { check: HealthCheck }) {
  const error = check.status === "error";
  const Icon = error ? XCircle : check.status === "warning" ? AlertTriangle : CheckCircle2;
  const internal = check.actionUrl?.startsWith("/");
  const link = "mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand no-underline hover:text-brand-hover";
  return (
    <div className={cn("rounded-xl border border-l-4 bg-surface p-3.5", error ? "border-neg/30 border-l-neg" : "border-warn/30 border-l-warn")}>
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={cn("mt-0.5 flex-none", error ? "text-neg" : "text-warn")} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{check.title}</p>
          <p className="mt-0.5 text-xs text-ink-2">{check.message}</p>
          {check.actionUrl ? (
            internal ? (
              <Link href={check.actionUrl} className={link}>
                {check.action} →
              </Link>
            ) : (
              <a href={check.actionUrl} target="_blank" rel="noopener noreferrer" className={link}>
                {check.action} <ExternalLink size={12} aria-hidden="true" />
              </a>
            )
          ) : (
            <p className="mt-1 text-[11px] font-medium text-ink-3">{check.action}</p>
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
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-ink-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Checking your Meta connection…
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 text-xs text-ink-2">
        Couldn&apos;t check your Meta connection.{" "}
        <button type="button" onClick={refresh} className="font-semibold text-brand hover:text-brand-hover">
          Try again
        </button>
      </div>
    );
  }

  const errors = report.checks.filter((c) => c.status === "error");
  const warnings = report.checks.filter((c) => c.status === "warning");

  const banner =
    report.overall === "healthy"
      ? { cls: "border-pos/30 bg-pos-soft text-pos", icon: CheckCircle2, text: "Meta account is fully connected and ready" }
      : report.overall === "degraded"
        ? { cls: "border-warn/30 bg-warn-soft text-warn", icon: AlertTriangle, text: "Meta connected with some limitations" }
        : { cls: "border-neg/30 bg-neg-soft text-neg", icon: XCircle, text: "Meta connection has issues that need attention" };
  const BannerIcon = banner.icon;

  return (
    <div className="space-y-3">
      <div className={cn("flex items-center justify-between gap-3 rounded-xl border p-3.5", banner.cls)}>
        <div className="flex items-center gap-2">
          <BannerIcon size={20} className="flex-none" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">{banner.text}</p>
            {checkedAt && <p className="text-[11px] text-ink-2">Last checked {timeAgo(checkedAt)}</p>}
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined} />} onClick={() => void refresh()} disabled={refreshing}>
          Refresh
        </Button>
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
