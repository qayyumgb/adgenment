import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /campaigns/new: header with step bar, step card, side panel. */
export default function NewCampaignLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3 pt-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-1 rounded-full" />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <Skeleton className="h-[520px] min-w-0 flex-[3_1_520px] rounded-card" />
        <Skeleton className="h-[420px] min-w-0 flex-[1_1_300px] rounded-card" />
      </div>
    </>
  );
}
