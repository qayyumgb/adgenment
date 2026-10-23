import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /audiences: page header, stats, tip cards, grid. */
export default function AudiencesLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[98px] rounded-card" />
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
          <Skeleton className="h-[140px] rounded-card" />
          <Skeleton className="h-[140px] rounded-card" />
        </div>
        <Skeleton className="h-[420px] rounded-card" />
      </div>
    </>
  );
}
