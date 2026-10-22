"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import OverviewPage from "@/app/(dashboard)/dashboard/page";

export function DevOverview() {
  return (
    <AppShell>
      <OverviewPage />
    </AppShell>
  );
}
