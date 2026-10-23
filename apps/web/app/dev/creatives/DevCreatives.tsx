"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import CreativesPage from "@/app/(dashboard)/creatives/page";

export function DevCreatives() {
  return (
    <AppShell>
      <CreativesPage />
    </AppShell>
  );
}
