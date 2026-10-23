"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { THEME_SCRIPT, ThemeProvider } from "@/components/app/theme/ThemeProvider";
import { ClientProvider } from "./ClientContext";
import { NavigationProgress } from "./NavigationProgress";
import { SidebarContent } from "./Sidebar";
import { MobileAppBar, TopBar } from "./TopBar";

/**
 * Pages rebuilt on the new design render their own <PageHeader>/<PageBody>.
 * Everything else still expects the old padded content area, so the shell
 * keeps providing it until each page is migrated (plan A4–A14).
 * TODO(A15): remove once every page is in this list.
 */
const REBUILT_ROUTES: (string | RegExp)[] = [/^\/campaigns\/[^/]+$/, "/dashboard", "/campaigns", "/analytics", "/creatives", "/audiences", "/budgets", "/ai-planner", "/dev/analytics", "/dev/creatives", "/dev/audiences", "/dev/budgets", "/dev/planner", "/dev/team", "/dev/new-campaign", "/dev/shell", "/dev/grid", "/dev/overview", "/dev/campaigns", /^\/dev\/campaign\/[^/]+$/];

/**
 * App shell (guide §3): 256px sticky sidebar + content from 900px up; below
 * that the app bar, drawer and bottom tab bar. The top bar is sticky; page
 * headers stick under it (PageHeader).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Exact paths, or patterns for dynamic routes (/campaigns/[id]).
  const rebuilt = REBUILT_ROUTES.some((r) => (typeof r === "string" ? r === pathname : r.test(pathname)));

  return (
    <ThemeProvider>
      {/* First paint gets the stored theme (no light/dark flash). */}
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {/* useSearchParams needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <ClientProvider>
        <div className="grid min-h-screen grid-cols-1 bg-bg text-sm leading-normal text-ink min-[900px]:grid-cols-[256px_minmax(0,1fr)]">
          <aside className="sticky top-0 hidden h-screen overflow-y-auto border-r border-line bg-surface min-[900px]:block">
            <SidebarContent />
          </aside>
          <div className="flex min-w-0 flex-col">
            <div className="sticky top-0 z-30">
              <div className="hidden min-[900px]:block">
                <TopBar />
              </div>
              <div className="min-[900px]:hidden">
                <MobileAppBar />
              </div>
            </div>
            <main className={cn("flex-1 pb-20 min-[900px]:pb-0", !rebuilt && "p-6 pb-24 lg:p-8 min-[900px]:pb-8")}>
              {rebuilt ? children : <div className="mx-auto w-full max-w-screen-2xl">{children}</div>}
            </main>
          </div>
        </div>
      </ClientProvider>
    </ThemeProvider>
  );
}
