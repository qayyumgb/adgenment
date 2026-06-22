/**
 * Skeleton for marketing routes (Home, Features, About, Contact, Privacy,
 * Terms, Data Deletion). Mirrors the dark hero + light content blocks pattern
 * the real pages use, so navigation between marketing pages doesn't flash.
 */
export default function MarketingLoading() {
  return (
    <main className="bg-white">
      {/* Dark hero placeholder */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0B1319] via-indigo-950 to-[#0B1319] pb-24 pt-32 sm:pt-36">
        <div className="mx-auto max-w-4xl px-6 text-center lg:px-8 space-y-6">
          <div className="mx-auto h-7 w-48 animate-pulse rounded-full bg-white/10" />
          <div className="mx-auto h-12 w-3/4 animate-pulse rounded-xl bg-white/10" />
          <div className="mx-auto h-12 w-1/2 animate-pulse rounded-xl bg-white/10" />
          <div className="mx-auto h-4 w-2/3 animate-pulse rounded bg-white/10" />
        </div>
      </section>

      {/* Light section placeholder */}
      <section className="bg-[#F6F6FD] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl bg-white p-6 shadow-sm space-y-3"
              >
                <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200/70" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200/70" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-200/70" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200/70" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
