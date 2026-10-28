"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import SetupPage from "@/app/(dashboard)/setup/page";

export function DevSetup() {
  return (
    <AppShell>
      <SetupPage />
    </AppShell>
  );
}
