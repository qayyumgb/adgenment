import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /campaigns: page header, KPI strip, banner, grid. */
export default function CampaignsLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-card" />
          ))}
        </div>
        <Skeleton className="h-[60px] rounded-menu" />
        <Skeleton className="h-[480px] rounded-card" />
      </div>
    </>
  );
}
