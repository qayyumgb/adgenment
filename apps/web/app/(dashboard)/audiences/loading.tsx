export default function AudiencesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded bg-slate-200/70" />
          <div className="h-4 w-72 animate-pulse rounded bg-slate-200/70" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-200/70" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200/70" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-slate-200/70" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200/70" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-200/70" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/70" />
            </div>
            <div className="mt-4 flex gap-3 border-t border-slate-100 pt-3">
              <div className="h-4 w-16 animate-pulse rounded bg-slate-200/70" />
              <div className="h-4 w-16 animate-pulse rounded bg-slate-200/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
