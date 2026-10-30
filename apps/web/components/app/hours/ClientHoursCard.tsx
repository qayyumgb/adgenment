"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { Platform } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import { Card, CardHeader, Segmented, Skeleton } from "@/components/app/ui";
import { HoursHeatmap } from "./HoursHeatmap";
import { PlatformCaps } from "./PlatformCaps";
import { recTitle, recWhy, resultWord } from "@/components/app/campaign/HoursTab";

/**
 * Smart hours for a client's campaigns together (plan C7, on Budgets): the
 * same heatmap, across platforms or one at a time. For reading: changes are
 * made per campaign (its Hours tab), where the platform's limits apply.
 */

type P = "ALL" | Extract<Platform, "META" | "GOOGLE" | "TIKTOK">;

export function ClientHoursCard({ clientId, clientName }: { clientId: string | null; clientName: string }) {
  const [platform, setPlatform] = useState<P>("ALL");
  const q = useApi((c) => c.getClientHours(clientId, platform === "ALL" ? null : platform), [clientId, platform], { key: "client-hours", keepPrevious: true });
  const d = q.data;

  const header = (
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-[1_1_300px]">
        <CardHeader
          title={`When does ${clientName} convert cheaply?`}
          sub={
            d && !d.mixedCurrency && d.total.spend > 0
              ? `Cost per ${resultWord(platform === "ALL" ? "MIXED" : platform, d.metric)} by hour and weekday · last ${d.windowDays} days · ${d.campaigns} campaign${d.campaigns === 1 ? "" : "s"}${d.timezone ? ` · ${d.timezone.replace(/_/g, " ")}` : d.mixedZones ? " · each account's own time zone" : ""}`
              : "Cost per result by hour and weekday, from each ad account's hourly report."
          }
        />
      </div>
      <Segmented<P>
        size="sm"
        label="Platform"
        value={platform}
        onChange={setPlatform}
        options={[
          { value: "ALL", label: "All platforms" },
          { value: "META", label: "Meta" },
          { value: "GOOGLE", label: "Google" },
          { value: "TIKTOK", label: "TikTok" },
        ]}
      />
    </div>
  );

  if (!d) return <Card className="flex flex-col gap-4">{header}{q.loading ? <Skeleton className="h-56" /> : <p className="m-0 text-sm text-ink-2">{q.error}</p>}</Card>;
  if (d.mixedCurrency) {
    return (
      <Card className="flex flex-col gap-4">
        {header}
        <p className="m-0 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">These campaigns spend in {d.currencies.join(", ")}, so their costs can&apos;t be added up. Pick one client in the switcher, or open a campaign&apos;s Hours tab.</p>
      </Card>
    );
  }
  const word = resultWord(platform === "ALL" ? "MIXED" : platform, d.metric);
  const r = d.recommendation;
  return (
    <Card className="flex flex-col gap-5">
      {header}
      {d.total.spend <= 0 ? (
        <p className="m-0 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">No hour-by-hour data yet. Advertix pulls each ad account&apos;s hourly report once a day, for campaigns that have spent in the last 45 days.</p>
      ) : (
        <>
          <div className={q.loading ? "opacity-60 transition-opacity" : undefined}>
            <HoursHeatmap cells={d.cells} hours={d.hours} metric={d.metric} currency={d.currency} resultWord={word} highlight={r} />
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex min-w-0 flex-[1.4_1_360px] flex-col gap-2 rounded-card bg-brand-soft p-4">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
                <Sparkles size={13} aria-hidden="true" /> Advertix read
              </span>
              {!d.eligible.ok ? (
                <span className="text-[13px] text-ink-2">
                  Not enough data to judge yet: {d.eligible.days} of {d.eligible.needDays} days and {d.eligible.conversions.toLocaleString()} of {d.eligible.needConversions} conversions.
                </span>
              ) : r ? (
                <>
                  <span className="font-semibold leading-snug">{recTitle(platform === "ALL" ? "MIXED" : platform, r)}</span>
                  <span className="text-[13px] text-ink-2 [text-wrap:pretty]">
                    {recWhy(r, word)} Make the change on each campaign&apos;s Hours tab, where the platform&apos;s limits apply.
                  </span>
                  {r.savedPerWeek >= 1 && <span className="text-[13px] font-semibold text-pos">≈ {fmtMoney(r.savedPerWeek, d.currency, { whole: true })} / week</span>}
                </>
              ) : (
                <>
                  <span className="font-semibold leading-snug">Keep running around the clock</span>
                  <span className="text-[13px] text-ink-2">No run of hours costs 40%+ more than average with enough spend to be sure.</span>
                </>
              )}
            </div>
            <PlatformCaps className="flex-[1_1_260px]" />
          </div>
        </>
      )}
    </Card>
  );
}
