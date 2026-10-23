"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import AudiencesPage from "@/app/(dashboard)/audiences/page";

export function DevAudiences() {
  return (
    <AppShell>
      <AudiencesPage />
    </AppShell>
  );
}
