"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { THEME_SCRIPT, ThemeProvider } from "@/components/app/theme/ThemeProvider";
import { ClientProvider } from "./ClientContext";
import { CommandPalette } from "./CommandPalette";
import { CreditsDialog } from "@/components/app/credits/Credits";
import { BillingBanner } from "@/components/app/billing/BillingBanner";
import { LockedScreen, LockedShell } from "@/components/app/billing/Upgrade";
import { usePlan, usePlanLockListener } from "@/components/app/billing/plan";
import { NavigationProgress } from "./NavigationProgress";
import { SidebarContent } from "./Sidebar";
import { MobileAppBar, TopBar } from "./TopBar";

/**
 * App shell (guide §3): 256px sticky sidebar + content from 900px up; below
 * that the app bar, drawer and bottom tab bar. The top bar is sticky; page
 * headers stick under it (PageHeader).
 *
 * A locked workspace (trial over, C15) gets a bare frame instead: Settings
 * (with Billing) opens, every other page shows the lock screen.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {/* First paint gets the stored theme (no light/dark flash). */}
      <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      {/* useSearchParams needs a Suspense boundary. */}
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <ClientProvider>
        <ShellBody>{children}</ShellBody>
      </ClientProvider>
    </ThemeProvider>
  );
}

function ShellBody({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const plan = usePlan();
  usePlanLockListener(plan.refetch);
  if (plan.locked) return <LockedShell>{pathname.startsWith("/settings") || pathname.startsWith("/admin") ? children : <LockedScreen />}</LockedShell>;
  return (
    <>
      <CommandPalette />
      <CreditsDialog />
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
          <BillingBanner />
          {/* Pages render their own <PageHeader>/<PageBody>. */}
          <main className="flex-1 pb-20 min-[900px]:pb-0">{children}</main>
        </div>
      </div>
    </>
  );
}
