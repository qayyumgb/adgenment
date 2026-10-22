"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import CampaignDetailPage from "@/app/(dashboard)/campaigns/[id]/page";

export function DevCampaign() {
  return (
    <AppShell>
      <CampaignDetailPage />
    </AppShell>
  );
}
