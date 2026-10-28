"use client";

import { useApiClient } from "@/lib/api";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { Button, EmptyState, Card, useConfirm } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { SetupRing, SetupSteps, useSetupChecklist } from "@/components/app/setup/SetupSteps";

/**
 * Get started (plan C11): the setup checklist on its own page, for the
 * client in the switcher (or the whole workspace). Owners only; the sidebar
 * link stays (with a ✓ once done) until it's hidden from here.
 */
export default function SetupPage() {
  const api = useApiClient();
  const access = useAccess();
  const { client, hasMultiple, setClient } = useClientScope();
  const q = useSetupChecklist();
  const { confirm, dialog } = useConfirm();
  const s = q.data;
  const next = s?.steps.find((x) => !x.done && !x.skipped);
  const scope = client ? client.name : hasMultiple ? "All clients" : "Your workspace";

  const toggleSidebar = async () => {
    if (!s) return;
    if (!s.dismissed && !(await confirm({ title: "Hide Get started from the sidebar?", body: "This page stays available from search (⌘K). Steps keep ticking off on their own.", confirmLabel: "Hide it" }))) return;
    await api.dismissSetup(!s.dismissed, client?.id);
    await q.refetch();
  };

  if (!access.loading && !access.can("workspace")) {
    return (
      <>
        <PageHeader kicker="Getting started" title="Get started" />
        <PageBody>
          <Card>
            <EmptyState title="Set up by the workspace owner" body="Connecting accounts, clients, budgets and billing are done by an owner. You can use everything they've set up." />
          </Card>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        kicker={`${scope} · getting started`}
        title="Get started"
        summary={s ? (next ? `${s.complete} of ${s.total} done · next: ${next.title}` : "All set. Every step is done or skipped.") : undefined}
        actions={
          s && (
            <Button variant="ghost" size="sm" onClick={() => void toggleSidebar()}>
              {s.dismissed ? "Show in sidebar" : "Hide from sidebar"}
            </Button>
          )
        }
      />
      <PageBody className="max-w-[900px] gap-4">
        {s && (
          <div className="flex items-center gap-3">
            <SetupRing complete={s.complete} total={s.total} size={48} />
            <span className="text-[13px] text-ink-2">
              {s.client ? `Steps for ${s.client.name}, plus the ones for your whole workspace.` : hasMultiple ? "Steps for all your clients: a client step ticks once every client has done it." : "Steps for your workspace."}
            </span>
          </div>
        )}
        <SetupSteps q={q} />
        {s && s.clients.length > 0 && (
          <Card padded={false} className="overflow-hidden">
            <div className="flex flex-col gap-0.5 px-5 py-4">
              <span className="text-base font-semibold">Your clients</span>
              <span className="text-[13px] text-ink-2">Each client&apos;s own steps. Open one to see what&apos;s left for it.</span>
            </div>
            <ul className="m-0 list-none border-t border-line p-0">
              {s.clients.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                  <SetupRing complete={c.complete} total={c.total} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-ink-3">{c.complete === c.total ? "All set" : `${c.total - c.complete} step${c.total - c.complete === 1 ? "" : "s"} left`}</span>
                  </span>
                  <Button variant={c.complete === c.total ? "ghost" : "secondary"} size="sm" onClick={() => setClient(c.id)}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PageBody>
      {dialog}
    </>
  );
}
