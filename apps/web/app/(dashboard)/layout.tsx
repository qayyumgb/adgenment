"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { AppShell } from "@/components/app/shell/AppShell";

/**
 * Workspace gate + app shell. Every dashboard route fans out to API calls
 * that require a workspace; without one, every fetch returns NO_WORKSPACE.
 * Cheaper UX to detect once here and bounce to `/onboarding` before the
 * children mount. (`getMe` is cached under "me" and shared with the shell.)
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useApi((c) => c.getMe(), [], { key: "me" });

  useEffect(() => {
    if (!me.loading && me.data && !me.data.workspace) {
      router.replace("/onboarding");
    }
  }, [me.loading, me.data, router]);

  if (me.loading || (me.data && !me.data.workspace)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="h-6 w-6 animate-spin text-brand" aria-label="Loading" />
      </div>
    );
  }

  return (
    <>
      <AppShell>{children}</AppShell>
      <Toaster
        position="bottom-right"
        containerStyle={{ bottom: 88 }}
        toastOptions={{
          style: {
            background: "var(--ink)",
            color: "var(--surface)",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "12px",
            padding: "10px 14px",
            boxShadow: "var(--shadow-lg)",
          },
          success: { iconTheme: { primary: "rgb(var(--c-pos))", secondary: "var(--surface)" } },
          error: { iconTheme: { primary: "rgb(var(--c-neg))", secondary: "var(--surface)" } },
        }}
      />
    </>
  );
}
