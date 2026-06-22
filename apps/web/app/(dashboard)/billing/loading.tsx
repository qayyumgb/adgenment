import { SkeletonMetricCard } from "@/components/ui/Skeleton";

export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-24 animate-pulse rounded bg-slate-200/70" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-200/70" />
      </div>

      {/* Current plan */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse rounded bg-slate-200/70" />
            <div className="h-7 w-32 animate-pulse rounded bg-slate-200/70" />
            <div className="h-3 w-48 animate-pulse rounded bg-slate-200/70" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200/70" />
        </div>
      </div>

      {/* Usage */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Invoices */}
      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200/70" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-200/70" />
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-200/70" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200/70" />
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
