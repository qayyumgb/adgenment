"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { PlannerStarter } from "@/lib/api";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { Button, Pill } from "@/components/app/ui";
import { useAccess } from "@/components/app/team/access";
import { ChatPanel } from "@/components/app/planner/Chat";
import { PlanPlaceholder, PlanView } from "@/components/app/planner/PlanView";
import { SavedPlansDialog } from "@/components/app/planner/SavedPlans";
import { refinements } from "@/components/app/planner/format";
import { usePlanner } from "@/components/app/planner/usePlanner";

/**
 * AI Planner (guide §5 row 9, plan A12). Advertix reads the client's last 30
 * days (performance per platform, fatigued ads, shared audiences, the month's
 * budget), drafts campaigns, split and timeline, and forecasts from the
 * client's own history. Plans and every refinement are saved; "Create
 * campaigns as drafts" makes paused draft campaigns, and Meta drafts finish
 * in the wizard.
 */
export default function AiPlannerPage() {
  const { user } = useUser();
  const access = useAccess();
  const { clientId: scopeId, client: scopeClient, hasMultiple } = useClientScope();
  const [picked, setPicked] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savedOpen, setSavedOpen] = useState(false);

  const requested = scopeId ?? picked;
  const ctx = useApi((c) => c.getPlannerContext(requested), [requested], { key: "planner-context" });
  const planClient = requested ?? ctx.data?.client?.id ?? null;
  const planner = usePlanner({ clientId: planClient });
  const plans = useApi((c) => c.getPlans({ clientId: scopeId }), [scopeId], { key: "plans" });
  const canEdit = access.can("edit");

  // A different client in the switcher starts over.
  const lastScope = useRef(scopeId);
  useEffect(() => {
    if (lastScope.current === scopeId) return;
    lastScope.current = scopeId;
    setPicked(null);
    planner.reset();
  }, [scopeId, planner]);

  // Keep the saved-plans count current as plans save.
  const { refetch: refetchPlans } = plans;
  useEffect(() => {
    if (planner.planId) void refetchPlans();
  }, [planner.planId, planner.version, refetchPlans]);

  const pickClient = (id: string) => {
    if (id === planClient) return;
    if (planner.messages.length) planner.reset();
    setPicked(id);
  };

  const onStarter = (s: PlannerStarter) => {
    if (!scopeId && s.clientId !== planClient) {
      if (planner.messages.length) planner.reset();
      setPicked(s.clientId);
    }
    if (s.send) void planner.send(s.brief, { clientId: s.clientId });
    else setDraft(s.brief);
  };

  const scopeName = scopeClient?.name ?? (hasMultiple ? "All clients" : "Workspace");
  const count = plans.data?.plans.length ?? 0;
  const planClientName = ctx.data?.clients.find((c) => c.id === planClient)?.name ?? null;

  return (
    <>
      <PageHeader
        kicker={`${scopeName} · plan with Advertix`}
        title="AI Planner"
        summary="Describe a goal. Advertix drafts the campaigns, budgets and creatives to reach it."
        actions={
          <>
            <Button variant="secondary" onClick={() => setSavedOpen(true)}>
              Saved plans
              {count > 0 && <Pill tone="neutral">{count}</Pill>}
            </Button>
            <Button variant="primary" icon={<Plus size={16} strokeWidth={2.5} />} onClick={() => planner.reset()} disabled={!planner.messages.length && !planner.plan}>
              New plan
            </Button>
          </>
        }
      />
      <PageBody className="flex-row flex-wrap items-start gap-4">
        <ChatPanel
          firstName={user?.firstName ?? null}
          context={ctx.data ?? null}
          contextLoading={ctx.loading}
          messages={planner.messages}
          thinking={planner.thinking}
          chips={planner.plan ? refinements(planner.plan) : []}
          usedChips={planner.used}
          suggestions={planner.suggestions}
          canEdit={canEdit}
          cannotReason={access.why("edit")}
          draft={draft}
          setDraft={setDraft}
          onSend={(t) => void planner.send(t)}
          onChip={(r) => void planner.send(r.message, { chip: r.label })}
          onRetry={planner.retry}
          onStarter={onStarter}
          pickClient={scopeId ? null : { value: planClient, onChange: pickClient }}
        />
        <div className="flex min-w-0 flex-[1.2_1_460px] flex-col gap-4">
          {planner.plan && !planner.thinking ? (
            <PlanView
              plan={planner.plan}
              version={planner.version}
              versions={planner.versions}
              onVersion={planner.showVersion}
              created={planner.created}
              creating={planner.creating}
              canEdit={canEdit}
              cannotReason={access.why("edit")}
              onCreate={() => void planner.createDrafts()}
            />
          ) : (
            <PlanPlaceholder thinking={planner.thinking} clientName={planClientName} />
          )}
        </div>
      </PageBody>
      <SavedPlansDialog
        open={savedOpen}
        onClose={() => setSavedOpen(false)}
        plans={plans.data?.plans ?? []}
        loading={plans.loading}
        canEdit={canEdit}
        onOpen={(d) => {
          if (!scopeId && d.clientId) setPicked(d.clientId);
          planner.open(d);
        }}
        onChanged={() => void plans.refetch()}
      />
    </>
  );
}
