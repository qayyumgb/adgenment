import { Skeleton } from "@/components/app/ui";

/**
 * Route-level skeleton for /dashboard. Mirrors the Overview layout (page
 * header, 5 KPI cards, chart + suggestions) so content arrives in place.
 */
export default function DashboardLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-6 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-card" />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-[380px] min-w-0 flex-[1.7_1_520px] rounded-card" />
          <Skeleton className="h-[380px] min-w-0 flex-[1_1_300px] rounded-card" />
        </div>
      </div>
    </>
  );
}
