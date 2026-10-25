"use client";

import { Suspense, type ReactNode } from "react";
import { THEME_SCRIPT, ThemeProvider } from "@/components/app/theme/ThemeProvider";
import { ClientProvider } from "./ClientContext";
import { NavigationProgress } from "./NavigationProgress";
import { SidebarContent } from "./Sidebar";
import { MobileAppBar, TopBar } from "./TopBar";

/**
 * App shell (guide §3): 256px sticky sidebar + content from 900px up; below
 * that the app bar, drawer and bottom tab bar. The top bar is sticky; page
 * headers stick under it (PageHeader).
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
            {/* Pages render their own <PageHeader>/<PageBody>. */}
            <main className="flex-1 pb-20 min-[900px]:pb-0">{children}</main>
          </div>
        </div>
      </ClientProvider>
    </ThemeProvider>
  );
}
