import { SkeletonCampaignCard } from "@/components/ui/Skeleton";

export default function CampaignsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded bg-slate-200/70" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-200/70" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-200/70" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card">
        <div className="h-10 flex-1 min-w-[200px] animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-20 animate-pulse rounded-xl bg-slate-100" />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCampaignCard key={i} />
        ))}
      </div>
    </div>
  );
}
