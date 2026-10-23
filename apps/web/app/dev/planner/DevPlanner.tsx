"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import AiPlannerPage from "@/app/(dashboard)/ai-planner/page";

export function DevPlanner() {
  return (
    <AppShell>
      <AiPlannerPage />
    </AppShell>
  );
}
