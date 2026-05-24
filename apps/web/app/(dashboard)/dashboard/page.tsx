export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-slate-400">
          Welcome back. Here&apos;s an overview of your ad performance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Spend", value: "$0.00" },
          { label: "Impressions", value: "0" },
          { label: "Clicks", value: "0" },
          { label: "ROAS", value: "0.0x" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-dark-border bg-dark-surface p-5"
          >
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dark-border bg-dark-surface p-6">
        <h2 className="text-lg font-semibold">Recent campaigns</h2>
        <p className="mt-2 text-sm text-slate-400">
          No campaigns yet. Create your first campaign to get started.
        </p>
      </div>
    </div>
  );
}
