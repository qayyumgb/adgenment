"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import ConnectionsPage from "@/app/(dashboard)/connections/page";

export function DevConnections() {
  return (
    <AppShell>
      <ConnectionsPage />
    </AppShell>
  );
}
