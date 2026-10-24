"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import SettingsPage from "@/app/(dashboard)/settings/page";

export function DevSettings() {
  return (
    <AppShell>
      <SettingsPage />
    </AppShell>
  );
}
