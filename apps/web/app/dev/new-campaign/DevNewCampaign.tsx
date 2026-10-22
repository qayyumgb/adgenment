"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import NewCampaignPage from "@/app/(dashboard)/campaigns/new/page";

export function DevNewCampaign() {
  return (
    <AppShell>
      <NewCampaignPage />
    </AppShell>
  );
}
