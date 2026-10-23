import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /connections: page header, platform cards, accounts grid. */
export default function ConnectionsLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[196px] rounded-card" />
          ))}
        </div>
        <Skeleton className="h-[420px] rounded-card" />
      </div>
    </>
  );
}
