import {
  SkeletonMetricCard,
  SkeletonChartCard,
} from "@/components/ui/Skeleton";

export default function CampaignDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="h-4 w-24 animate-pulse rounded bg-slate-200/70" />

      {/* Hero */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200/70" />
            <div className="h-8 w-72 animate-pulse rounded bg-slate-200/70" />
            <div className="h-4 w-96 animate-pulse rounded bg-slate-200/70" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-200/70" />
            <div className="h-9 w-32 animate-pulse rounded-xl bg-slate-200/70" />
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Chart */}
      <SkeletonChartCard height={360} />

      {/* Insights / breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonChartCard height={280} />
        <SkeletonChartCard height={280} />
      </div>
    </div>
  );
}
