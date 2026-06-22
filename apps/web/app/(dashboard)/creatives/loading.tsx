export default function CreativesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 animate-pulse rounded bg-slate-200/70" />
          <div className="h-4 w-64 animate-pulse rounded bg-slate-200/70" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-10 w-36 animate-pulse rounded-xl bg-slate-200/70" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card">
        <div className="h-10 flex-1 min-w-[200px] animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200/70 bg-white shadow-card overflow-hidden"
          >
            <div className="aspect-square animate-pulse bg-slate-200/70" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
