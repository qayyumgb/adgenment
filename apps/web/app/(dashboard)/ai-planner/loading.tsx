export default function AIPlannerLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-slate-200/70" />
        <div className="h-4 w-96 animate-pulse rounded bg-slate-200/70" />
      </div>

      {/* Prompt card */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card space-y-4">
        <div className="space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200/70" />
          <div className="h-24 w-full animate-pulse rounded-xl bg-slate-100" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200/70" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <div className="h-11 w-40 animate-pulse rounded-xl bg-slate-200/70" />
        </div>
      </div>

      {/* Example chips */}
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200/70" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-9 w-48 animate-pulse rounded-full bg-slate-200/70"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
