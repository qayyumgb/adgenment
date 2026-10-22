import { Skeleton } from "@/components/app/ui";

/** Route-level skeleton for /budget-optimizer (still on the old padded layout). */
export default function BudgetOptimizerLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[96px] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-[420px] rounded-card" />
    </div>
  );
}
