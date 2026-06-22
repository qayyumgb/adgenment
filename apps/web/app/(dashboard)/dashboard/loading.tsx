import {
  SkeletonMetricCard,
  SkeletonChartCard,
  SkeletonCampaignCard,
} from "@/components/ui/Skeleton";

/**
 * Route-level skeleton shown by Next.js during the navigation to /dashboard.
 * Mirrors the real page's layout (greeting, 4 KPI tiles, chart, recent
 * campaigns) so the transition feels like content arriving in place rather
 * than a blank flash.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded bg-slate-200/70" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-200/70" />
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Chart + side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <SkeletonChartCard height={320} />
        <SkeletonChartCard height={320} />
      </div>

      {/* Recent campaigns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCampaignCard key={i} />
        ))}
      </div>
    </div>
  );
}
