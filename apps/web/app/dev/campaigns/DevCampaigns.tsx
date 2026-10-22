"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import CampaignsPage from "@/app/(dashboard)/campaigns/page";

export function DevCampaigns() {
  return (
    <AppShell>
      <CampaignsPage />
    </AppShell>
  );
}
