"use client";

/**
 * Reusable error card for Meta API failures (campaign sync, publish, any Meta
 * call). Shows a plain-English title + message via translateMetaError, plus an
 * action button (retry / reconnect / open Business Manager) and a support link.
 */

import Link from "next/link";
import { AlertCircle, RefreshCw, ExternalLink, Plug } from "lucide-react";
import { translateMetaError } from "@/lib/meta-errors";

export default function MetaErrorCard({
  code,
  message,
  onRetry,
  onReconnect,
}: {
  code?: number;
  message: string;
  onRetry?: () => void;
  onReconnect?: () => void;
}) {
  const t = translateMetaError(code, message);
  const isReconnect = t.actionUrl?.includes("/settings");

  return (
    <div className="rounded-2xl border-l-4 border-l-rose-500 border border-rose-200 bg-rose-50/60 p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{t.title}</p>
          <p className="mt-0.5 text-sm text-slate-600">{t.message}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Primary action — prefer explicit handlers, else the mapped URL */}
            {onReconnect || isReconnect ? (
              onReconnect ? (
                <button
                  type="button"
                  onClick={onReconnect}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/90"
                >
                  <Plug className="h-3.5 w-3.5" /> {t.action}
                </button>
              ) : (
                <Link
                  href={t.actionUrl ?? "/settings"}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/90"
                >
                  <Plug className="h-3.5 w-3.5" /> {t.action}
                </Link>
              )
            ) : t.actionUrl ? (
              <a
                href={t.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/90"
              >
                {t.action} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary/90"
              >
                <RefreshCw className="h-3.5 w-3.5" /> {t.action}
              </button>
            ) : null}

            <a
              href="mailto:support@advertix.io"
              className="text-xs font-semibold text-slate-500 transition hover:text-primary"
            >
              Need help?
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
