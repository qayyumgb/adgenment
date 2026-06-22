import {
  SkeletonMetricCard,
  SkeletonChartCard,
} from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded bg-slate-200/70" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-200/70" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-200/70" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      <SkeletonChartCard height={360} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonChartCard height={280} />
        <SkeletonChartCard height={280} />
      </div>
    </div>
  );
}
