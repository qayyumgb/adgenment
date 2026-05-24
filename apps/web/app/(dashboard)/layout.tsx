import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/creatives", label: "Creatives" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/ai", label: "AI Studio" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-dark-bg text-slate-100">
      <aside className="flex w-64 flex-col border-r border-dark-border bg-dark-surface">
        <div className="border-b border-dark-border p-6">
          <Link href="/dashboard" className="text-xl font-bold">
            AdGenius <span className="text-primary">AI</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-dark-bg hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-dark-border p-4">
          <UserButton afterSignOutUrl="/" />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <header className="flex h-16 items-center justify-between border-b border-dark-border px-8">
          <h2 className="text-sm font-medium text-slate-400">Workspace</h2>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
