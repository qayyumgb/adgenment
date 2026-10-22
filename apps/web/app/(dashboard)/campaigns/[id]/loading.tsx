import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /campaigns/[id]: header with tabs, 6 KPIs, chart + side panel. */
export default function CampaignDetailLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3 pt-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-3.5 w-96 max-w-full" />
        <Skeleton className="mt-2 h-5 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-card" />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-[340px] min-w-0 flex-[1.6_1_520px] rounded-card" />
          <Skeleton className="h-[340px] min-w-0 flex-[1_1_320px] rounded-card" />
        </div>
      </div>
    </>
  );
}
