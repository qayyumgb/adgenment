import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /budgets: page header, allocator, pacing grid. */
export default function BudgetsLoading() {
  return (
    <>
      <div className="flex flex-col gap-2 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] pb-3.5 pt-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 px-[clamp(16px,4vw,32px)] pb-10 pt-6">
        <Skeleton className="h-[460px] rounded-card" />
        <Skeleton className="h-[320px] rounded-card" />
        <Skeleton className="h-[180px] rounded-card" />
      </div>
    </>
  );
}
