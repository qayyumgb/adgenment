export default function InsightsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded bg-slate-200/70" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-200/70" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200/70" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200/70" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-200/70" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200/70" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200/70" />
              <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
