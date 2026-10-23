import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /creatives: page header, studio, filter row, card grid. */
export default function CreativesLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <Skeleton className="h-[170px] rounded-card" />
        <Skeleton className="h-9 w-full max-w-[640px] rounded-ctl" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/6] rounded-card" />
          ))}
        </div>
      </div>
    </>
  );
}
