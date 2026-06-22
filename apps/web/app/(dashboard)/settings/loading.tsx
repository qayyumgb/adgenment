export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-24 animate-pulse rounded bg-slate-200/70" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-200/70" />
      </div>

      <div className="flex gap-6">
        {/* Tab nav */}
        <div className="w-60 shrink-0 space-y-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-full animate-pulse rounded-xl bg-slate-200/70"
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-card">
            <div className="space-y-2 mb-6">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200/70" />
              <div className="h-3 w-80 animate-pulse rounded bg-slate-200/70" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-200/70" />
                  <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <div className="h-10 w-32 animate-pulse rounded-xl bg-slate-200/70" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
