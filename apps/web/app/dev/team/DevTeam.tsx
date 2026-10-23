"use client";

import { AppShell } from "@/components/app/shell/AppShell";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { TeamPanel } from "@/components/app/team/TeamPanel";

export function DevTeam() {
  return (
    <AppShell>
      <PageHeader kicker="Settings" title="Team" summary="Members, roles, client access and invites" />
      <PageBody>
        <TeamPanel />
      </PageBody>
    </AppShell>
  );
}
