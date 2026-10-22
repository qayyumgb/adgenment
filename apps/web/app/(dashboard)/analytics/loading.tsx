import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /analytics: header, 5 KPI cards, trend + share, funnel. */
export default function AnalyticsLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-card" />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-[400px] min-w-0 flex-[1.8_1_560px] rounded-card" />
          <Skeleton className="h-[400px] min-w-0 flex-[1_1_300px] rounded-card" />
        </div>
        <Skeleton className="h-[300px] rounded-card" />
      </div>
    </>
  );
}
