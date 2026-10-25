"use client";

/**
 * Reusable error card for Meta API failures (campaign sync, publish, any Meta
 * call). Shows a plain-English title + message via translateMetaError, plus an
 * action button (retry / reconnect / open Business Manager) and a support link.
 */

import { AlertCircle, RefreshCw, ExternalLink, Plug } from "lucide-react";
import { translateMetaError } from "@/lib/meta-errors";
import { Button, ButtonLink } from "@/components/app/ui";

export default function MetaErrorCard({
  code,
  message,
  detail,
  step,
  onRetry,
  onReconnect,
}: {
  code?: number;
  message: string;
  /** Meta's verbatim response, when the server passed it through. */
  detail?: string;
  /** Which server-side step failed, e.g. "create ad set". */
  step?: string;
  onRetry?: () => void;
  onReconnect?: () => void;
}) {
  const t = translateMetaError(code, message);
  const isReconnect = t.actionUrl?.includes("/connections");

  return (
    <div role="alert" className="rounded-card border border-l-4 border-neg/30 border-l-neg bg-neg-soft p-4">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="mt-0.5 flex-none text-neg" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{t.title}</p>
          <p className="mt-0.5 text-sm text-ink-2">{t.message}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {/* Primary action — prefer explicit handlers, else the mapped URL */}
            {onReconnect ? (
              <Button variant="primary" size="sm" icon={<Plug size={14} />} onClick={onReconnect}>
                {t.action}
              </Button>
            ) : isReconnect ? (
              <ButtonLink href={t.actionUrl ?? "/connections"} variant="primary" size="sm" icon={<Plug size={14} />}>
                {t.action}
              </ButtonLink>
            ) : t.actionUrl ? (
              <ButtonLink href={t.actionUrl} target="_blank" rel="noopener noreferrer" variant="primary" size="sm" className="hover:text-white">
                {t.action} <ExternalLink size={14} aria-hidden="true" />
              </ButtonLink>
            ) : onRetry ? (
              <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={onRetry}>
                {t.action}
              </Button>
            ) : null}

            <a href="mailto:support@advertix.io" className="text-xs font-semibold text-ink-2 no-underline transition-colors hover:text-brand">
              Need help?
            </a>
          </div>

          {/* Exactly what the platform said. Collapsed so it doesn't compete
              with the plain-English message, but present — the friendly text
              is an interpretation, and when it's wrong this is the only way to
              tell without server logs. */}
          {(detail || step) && (
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-[11px] font-semibold text-ink-3 transition-colors hover:text-ink-2">
                <span className="group-open:hidden">▸ Technical details</span>
                <span className="hidden group-open:inline">▾ Technical details</span>
              </summary>
              <div className="mt-1.5 space-y-1 rounded-lg bg-surface/60 p-2.5">
                {step && (
                  <p className="text-[11px] text-ink-2">
                    <span className="font-semibold">Failed at:</span> {step}
                  </p>
                )}
                {detail && <p className="break-words font-mono text-[11px] leading-relaxed text-ink-2">{detail}</p>}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
