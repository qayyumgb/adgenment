"use client";

import { cn } from "@/lib/cn";
import { AiNote, Card, Skeleton } from "@/components/app/ui";

const compact = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e4 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en-US");

/**
 * Conversion funnel (Analytics, guide §5.7). Impressions, clicks and
 * conversions cover every platform; landing-page views and add-to-cart come
 * from Meta's ad-level results (B4). Until those have synced the two steps
 * say so instead of showing made-up numbers, and when other platforms are in
 * scope their rates are taken against Meta's own clicks.
 */
type AdLevel = { impressions: number; clicks: number; conversions: number; landingPageViews: number; addToCart: number };

export function Funnel({
  impressions,
  clicks,
  conversions,
  scopeLabel,
  adLevel = null,
  loading = false,
}: {
  impressions: number;
  clicks: number;
  conversions: number;
  scopeLabel: string;
  /** Meta ad-level totals for the same scope; null until synced. */
  adLevel?: AdLevel | null;
  loading?: boolean;
}) {
  // Ad-level data covers only part of the scope when other platforms delivered too.
  const metaOnly = adLevel !== null && adLevel.impressions < impressions * 0.98;
  const lpv = adLevel?.landingPageViews ?? null;
  const atc = adLevel?.addToCart ?? null;
  const steps: { label: string; value: number | null; prev?: number; of?: string }[] = [
    { label: "Impressions", value: impressions },
    { label: "Clicks", value: clicks, prev: impressions },
    { label: "Landing page views", value: lpv, prev: adLevel ? (metaOnly ? adLevel.clicks : clicks) : undefined, of: metaOnly ? "of Meta clicks" : undefined },
    { label: "Added to cart", value: atc, prev: lpv ?? undefined },
    {
      label: "Conversions",
      value: conversions,
      prev: !metaOnly && atc ? atc : !metaOnly && lpv ? lpv : clicks,
      of: metaOnly || !(atc || lpv) ? "of clicks" : undefined,
    },
  ];
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
  const cvr = clicks > 0 ? (conversions / clicks) * 100 : null;
  // A plain read of where people drop off, from the two rates we have.
  const read =
    ctr === null
      ? null
      : cvr === null || conversions === 0
        ? `${compact(clicks)} clicks and no conversions recorded. Check that the conversion event is firing before judging the ads.`
        : ctr < 1
          ? `The biggest drop is before the click: CTR is ${ctr.toFixed(2)}%, so the ads are the lever — test new hooks before changing budgets.`
          : `People click (CTR ${ctr.toFixed(2)}%) but ${cvr.toFixed(1)}% of clicks convert. The landing page and offer are the lever here.`;

  return (
    <Card className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-base font-semibold">Conversion funnel</span>
        <span className="text-[13px] text-ink-2">{scopeLabel} · all platforms</span>
      </div>
      {loading ? (
        <Skeleton className="h-48" />
      ) : (
        <ol className="flex flex-col gap-2">
          {steps.map((s) => {
            const missing = s.value === null;
            const w = missing ? 0 : impressions > 0 ? Math.max(4, 100 * Math.pow((s.value as number) / impressions, 0.28)) : 0;
            const rate = !missing && s.prev ? Math.min(100, ((s.value as number) / s.prev) * 100) : null;
            return (
              <li key={s.label} className="flex items-center gap-3">
                <span className={cn("w-28 flex-none text-sm font-medium min-[700px]:w-44", missing && "text-ink-3")}>{s.label}</span>
                <span className="h-7 min-w-0 flex-1 overflow-hidden rounded-lg bg-surface-2">
                  {!missing && <span className="block h-full rounded-lg bg-brand-mid" style={{ width: `${w}%` }} />}
                </span>
                <span className={cn("w-14 flex-none text-right text-sm font-semibold tabular-nums", missing && "font-normal text-ink-3")}>
                  {missing ? "—" : compact(s.value as number)}
                </span>
                <span className="hidden w-32 flex-none text-right text-xs text-ink-2 min-[700px]:block">
                  {missing ? "Not synced yet" : rate === null ? (s.prev === 0 ? "—" : "100%") : `${rate.toFixed(rate < 1 ? 2 : 1)}% ${s.of ?? "of previous"}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {!loading && (!adLevel || metaOnly) && (
        <p className="text-xs text-ink-3">
          {!adLevel
            ? "Landing page views and add-to-cart come from Meta ad-level results. They show after the next Meta sync."
            : "Landing page views and add-to-cart are from Meta ads only; the other platforms don't report them to Advertix yet."}
        </p>
      )}
      {!loading && read && <AiNote title="Where people drop off">{read}</AiNote>}
    </Card>
  );
}
