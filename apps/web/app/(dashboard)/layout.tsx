"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useApi } from "@/hooks/useApi";

/**
 * Workspace gate. Every dashboard route fans out to API calls that require
 * a workspace; without one, every Sidebar/Header/page fetch returns
 * NO_WORKSPACE. Cheaper UX to detect once at the layout level and bounce
 * to `/onboarding` before the children mount.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const me = useApi((c) => c.getMe(), []);

  useEffect(() => {
    if (!me.loading && me.data && !me.data.workspace) {
      router.replace("/onboarding");
    }
  }, [me.loading, me.data, router]);

  // While checking, or while the redirect is pending, show a centered
  // spinner instead of mounting the dashboard chrome (which would fire
  // dozens of NO_WORKSPACE requests).
  if (me.loading || (me.data && !me.data.workspace)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      <div
        className="flex min-h-screen flex-col transition-[margin] duration-300 ease-out"
        style={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto w-full max-w-screen-2xl">{children}</div>
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0f172a",
            color: "#f8fafc",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "12px",
            padding: "10px 14px",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "#0f172a" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#0f172a" },
          },
        }}
      />
    </div>
  );
}
