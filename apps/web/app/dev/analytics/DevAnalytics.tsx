"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import AnalyticsPage from "@/app/(dashboard)/analytics/page";

export function DevAnalytics() {
  return (
    <AppShell>
      <AnalyticsPage />
    </AppShell>
  );
}
