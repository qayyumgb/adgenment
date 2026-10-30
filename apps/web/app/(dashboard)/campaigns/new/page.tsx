"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppRouter } from "@/hooks/useAppRouter";
import { ChevronRight, RotateCcw } from "lucide-react";
import MetaErrorCard from "@/components/app/meta/MetaErrorCard";
import MetaHealthStatus from "@/components/app/meta/MetaHealthStatus";
import { useApi } from "@/hooks/useApi";
import { ApiError, useApiClient, type Platform } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PageBody, PageHeader } from "@/components/app/shell/PageHeader";
import { useClientScope } from "@/components/app/shell/ClientContext";
import { useAccess } from "@/components/app/team/access";
import { Button, ButtonLink, Skeleton } from "@/components/app/ui";
import { audienceToState, buildPublishPayload, initialState, targetingToState } from "@/components/app/new-campaign/metaSteps";
import { AUTOSAVE_KEY, GOALS, WIZARD_PLATFORMS, budgetOf, emptyDraft, hasMeta, stepValid, todayStr, type Draft } from "@/components/app/new-campaign/model";
import { autoPauseFromCampaign, isAutoPauseOn, toAutoPause } from "@/components/app/campaign/AutoPauseFields";
import { AdsStep, AudienceStep, GoalStep, PlatformsStep } from "@/components/app/new-campaign/steps";
import { DoneScreen, ReviewStep, SidePanel, type LaunchResult } from "@/components/app/new-campaign/review";

/**
 * New campaign (guide §5.4, plan A7): Goal → Platforms & budget → Audience →
 * Ads → Review & launch, with a live forecast and setup strength. The one
 * create + publish flow: Meta campaigns are created and published (paused, or
 * started), other platforms saved as drafts. The draft autosaves in this
 * browser; `?from=<id>` resumes an existing unpublished campaign (AI Planner
 * drafts open this way, with their budget, dates and targeting).
 */

const STEPS = ["Goal", "Platforms & budget", "Audience", "Ads", "Review & launch"];

function readSaved(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    // Files and in-flight uploads don't survive a reload.
    return { ...emptyDraft(), ...d, meta: { ...initialState(), ...d.meta, uploading: false, uploadFile: null } };
  } catch {
    return null;
  }
}

export default function NewCampaignPage() {
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get("from");
  const api = useApiClient();
  const { clients } = useClientScope();
  const access = useAccess();
  const storageKey = fromId ? `${AUTOSAVE_KEY}:${fromId}` : AUTOSAVE_KEY;

  const accountsQ = useApi((c) => c.getAdAccounts(), [], { key: "ad-accounts" });
  const fromQ = useApi((c) => (fromId ? c.getCampaign(fromId) : Promise.resolve(null)), [fromId], { key: "wizard-from" });
  // ?audience=<id> (Audiences page "Use in campaign"): start from that saved audience.
  const audienceParam = searchParams.get("audience");
  const audienceQ = useApi((c) => (audienceParam ? c.getAudiences({ limit: "100" }) : Promise.resolve(null)), [audienceParam], { key: "wizard-audience" });
  const accounts = useMemo(() => (accountsQ.data ?? []).filter((a) => a.isActive), [accountsQ.data]);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [audienceLoaded, setAudienceLoaded] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; detail?: string; step?: string } | null>(null);
  const [done, setDone] = useState<LaunchResult | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const patch = useCallback((p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p })), []);
  const patchMeta = useCallback((u: Partial<Draft["meta"]>) => setDraft((d) => ({ ...d, meta: { ...d.meta, ...u } })), []);

  // Hydrate once: resume a campaign, or restore the autosaved draft.
  useEffect(() => {
    if (hydrated || accountsQ.loading || (fromId && fromQ.loading) || (audienceParam && audienceQ.loading)) return;
    const saved = readSaved(storageKey);
    const fromAudience = audienceParam ? audienceQ.data?.audiences.find((a) => a.id === audienceParam) : undefined;
    if (fromAudience && !fromId) {
      // Keep an unfinished draft, but put this audience on it (Meta targeting).
      const base = saved ?? emptyDraft();
      const meta = accounts.find((a) => a.platform === "META");
      setDraft({
        ...base,
        platforms: meta && !base.platforms.includes("META") ? [...base.platforms, "META"] : base.platforms,
        accountIds: meta && !base.accountIds.META ? { ...base.accountIds, META: meta.id } : base.accountIds,
        meta: { ...base.meta, ...audienceToState(fromAudience) },
      });
      setRestored(Boolean(saved));
      setAudienceLoaded(fromAudience.name);
    } else if (saved) {
      setDraft(saved);
      setRestored(true);
    } else if (fromId && fromQ.data) {
      const c = fromQ.data;
      const goal = GOALS.find((g) => g.value.toLowerCase() === (c.objective || "").toLowerCase())?.id ?? "traffic";
      setDraft({
        ...emptyDraft(),
        goal,
        name: c.name,
        nameTouched: true,
        platforms: [c.platform],
        accountIds: { [c.platform]: c.adAccountId },
        budgetType: c.budgetType,
        budgetInput: String(Number(c.budget) || ""),
        startDate: c.startDate && c.startDate.slice(0, 10) >= todayStr() ? c.startDate.slice(0, 10) : todayStr(),
        endDate: c.endDate ? c.endDate.slice(0, 10) : "",
        runContinuously: !c.endDate,
        autoPause: autoPauseFromCampaign(c),
        smartHours: !!c.smartHours,
        meta: { ...initialState({ headline: c.name }), ...targetingToState(c.targeting as Parameters<typeof targetingToState>[0]) },
        createdIds: { [c.platform]: c.id },
      });
      setStep(c.platform === "META" ? 3 : 2);
    }
    setHydrated(true);
  }, [hydrated, accountsQ.loading, fromId, fromQ.loading, fromQ.data, storageKey, accounts, audienceParam, audienceQ.loading, audienceQ.data]);

  // A restored draft can name an ad account that's gone (reconnected accounts
  // get a new id): use the platform's current account, or drop the platform.
  useEffect(() => {
    if (!hydrated || accountsQ.loading || !accountsQ.data) return;
    const stale = draft.platforms.filter((p) => !accounts.some((a) => a.id === draft.accountIds[p] && a.platform === p));
    if (!stale.length) return;
    const accountIds = { ...draft.accountIds };
    const platforms = draft.platforms.filter((p) => {
      if (!stale.includes(p)) return true;
      const first = accounts.find((a) => a.platform === p);
      if (first) accountIds[p] = first.id;
      else delete accountIds[p];
      return !!first;
    });
    patch({ platforms, accountIds });
  }, [hydrated, accountsQ.loading, accountsQ.data, accounts, draft.platforms, draft.accountIds, patch]);

  // Autosave (minus the File, which can't be stored).
  useEffect(() => {
    if (!hydrated || done) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ ...draft, meta: { ...draft.meta, uploadFile: null, uploading: false } }));
    } catch {
      // storage full / blocked: the draft just doesn't persist
    }
  }, [draft, hydrated, storageKey, done]);

  // The budget's account: Meta's if picked, else the first platform's.
  const budgetPlatform = draft.platforms.includes("META") ? "META" : draft.platforms[0];
  const budgetAccount = accounts.find((a) => a.id === (budgetPlatform ? draft.accountIds[budgetPlatform] : undefined)) ?? accounts[0] ?? null;
  const minDailyBudget = budgetAccount?.minDailyBudget ?? null;
  const currency = budgetAccount?.currency ?? null;
  // The budget check counts a total budget by the hour in this zone (see scheduleCheck).
  const budgetTz = budgetAccount?.timezone ?? null;
  useEffect(() => {
    if (hydrated && (draft.budgetTz ?? null) !== budgetTz) patch({ budgetTz });
  }, [hydrated, budgetTz, draft.budgetTz, patch]);
  const clientName = useCallback((id: string | null | undefined) => (id ? clients.find((c) => c.id === id && !c.isDefault)?.name ?? null : null), [clients]);
  const history = useApi((c) => c.getAnalyticsOverview(30, undefined, budgetAccount?.clientId ?? undefined), [budgetAccount?.clientId], { key: "wizard-history" });
  const historyLabel = clientName(budgetAccount?.clientId) ?? "your workspace";

  // Default name until the user writes one.
  useEffect(() => {
    if (!hydrated || draft.nameTouched || !draft.goal || draft.platforms.length === 0) return;
    const plat = draft.platforms.length === 1 ? WIZARD_PLATFORMS.find((p) => p.id === draft.platforms[0])?.name : "Multi-platform";
    const goal = GOALS.find((g) => g.id === draft.goal)?.name;
    const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    const name = `${plat} – ${goal} – ${month}`;
    if (draft.name !== name) patch({ name });
  }, [hydrated, draft.nameTouched, draft.goal, draft.platforms, draft.name, patch]);

  useEffect(() => setError(null), [step]);
  const go = (n: number) => {
    setStep(n);
    topRef.current?.scrollIntoView({ block: "start" });
  };
  const firstInvalid = [1, 2, 3, 4].find((n) => !stepValid(draft, n, minDailyBudget)) ?? 5;
  const valid = stepValid(draft, step, minDailyBudget);

  const startOver = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setDraft(emptyDraft());
    setRestored(false);
    setStep(1);
    if (fromId) router.replace("/campaigns/new");
  };

  async function launch() {
    setSubmitting(true);
    setError(null);
    const goal = GOALS.find((g) => g.id === draft.goal)!;
    const created: Partial<Record<Platform, string>> = { ...draft.createdIds };
    const base = {
      objective: goal.value,
      budget: budgetOf(draft),
      budgetType: draft.budgetType,
      startDate: draft.startDate || null,
      endDate: draft.runContinuously ? null : draft.endDate || null,
    };
    const nameFor = (p: Platform) => (draft.platforms.length > 1 ? `${draft.name.trim()} (${WIZARD_PLATFORMS.find((x) => x.id === p)?.name})` : draft.name.trim());
    try {
      for (const p of draft.platforms) {
        if (created[p]) {
          // Reusing a row from a failed attempt or `?from=`: bring it up to date first (local only — not published yet).
          await api.updateCampaign(created[p]!, { name: nameFor(p), budget: base.budget, budgetType: base.budgetType, startDate: base.startDate, endDate: base.endDate, ...(p === "META" ? { audienceId: draft.meta.libraryAudienceId ?? null } : {}) });
        } else {
          const c = await api.createCampaign({ ...base, name: nameFor(p), platform: p, adAccountId: draft.accountIds[p]!, targeting: null, audienceId: p === "META" ? draft.meta.libraryAudienceId ?? null : null });
          created[p] = c.id;
          setDraft((d) => ({ ...d, createdIds: { ...d.createdIds, [p]: c.id } }));
        }
      }
      // Auto-pause (C6) is saved before publishing, so it's on from the first minute.
      const autoPause = toAutoPause(draft.autoPause);
      const withAutoPause = created.META && (isAutoPauseOn(draft.autoPause) || draft.createdIds.META);
      if (withAutoPause) await api.setAutoPause(created.META!, autoPause);
      // Smart hours (C7) is saved before publishing too.
      if (created.META && (draft.smartHours || draft.createdIds.META)) await api.setSmartHours(created.META, draft.smartHours);
      const result: LaunchResult = [];
      for (const p of draft.platforms) {
        const id = created[p]!;
        if (p === "META" && draft.launch !== "draft") {
          const res = await api.publishCampaignToMeta(id, buildPublishPayload(draft.meta));
          if (draft.launch === "start") {
            await api.launchCampaign(id, "ACTIVE");
            // Check it now it's live (a blackout today pauses it straight away); the hourly pass would catch it anyway.
            if (isAutoPauseOn(draft.autoPause)) await api.setAutoPause(id, autoPause).catch(() => undefined);
          }
          const acct = accounts.find((a) => a.id === draft.accountIds.META);
          result.push({
            campaignId: id,
            platform: p,
            name: nameFor(p),
            state: draft.launch === "start" ? "published-live" : "published-paused",
            adsManagerUrl: acct ? `https://business.facebook.com/adsmanager/manage/campaigns?act=${acct.accountId}&selected_campaign_ids=${res.meta.campaignId}` : undefined,
          });
        } else {
          result.push({ campaignId: id, platform: p, name: nameFor(p), state: "draft" });
        }
      }
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      setDone(result);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Publishing failed. Nothing was created on Meta — try again.",
        detail: err instanceof ApiError ? err.detail : undefined,
        step: err instanceof ApiError ? err.step : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <DoneScreen result={done} />;
  // Read-only roles (B6) can't create campaigns; the API refuses too.
  if (!access.loading && access.role && !access.can("edit")) {
    return (
      <PageBody>
        <div className="mx-auto flex max-w-[520px] flex-col items-start gap-3 rounded-card border border-line bg-surface p-7 shadow-card">
          <span className="text-lg font-semibold">Creating campaigns needs Media buyer access</span>
          <span className="text-sm text-ink-2">{access.why("edit")}</span>
          <ButtonLink href="/campaigns" variant="secondary">
            Back to Campaigns
          </ButtonLink>
        </div>
      </PageBody>
    );
  }

  const meta = hasMeta(draft);
  const launchLabel = !meta || draft.launch === "draft" ? (draft.platforms.length > 1 ? "Save drafts" : "Save draft") : draft.launch === "start" ? "Publish and start" : "Publish to Meta";
  const hints: Record<number, string> = {
    1: "Pick a goal to continue",
    5: "Give the campaign a name to continue",
    2: "Choose a platform and a valid budget and dates",
    3: "Add a location or a saved / custom audience",
    4: "Pick a Page and add media, text and a valid link",
  };
  const metaAccountId = draft.accountIds.META;
  const loadingFrom = !hydrated;

  return (
    <>
      <div ref={topRef} className="scroll-mt-16" />
      <PageHeader
        kicker={
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
            <Link href="/campaigns" className="text-inherit no-underline hover:text-brand">
              Campaigns
            </Link>
            <span aria-hidden="true">/</span>
            <span>{fromId ? "Publish" : "New"}</span>
          </nav>
        }
        title={draft.name.trim() && step > 1 ? draft.name : fromId ? "Publish campaign" : "New campaign"}
        summary={`Step ${step} of 5 · ${STEPS[step - 1]} · draft saved automatically`}
        actions={
          <ButtonLink href="/campaigns" variant="secondary">
            Save draft &amp; exit
          </ButtonLink>
        }
        tabs={
          <nav aria-label="Steps" className="grid grid-cols-5 gap-2 pb-3">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const isDone = n < step && stepValid(draft, n, minDailyBudget);
              const cur = n === step;
              const reachable = n <= firstInvalid || n < step;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={!reachable || submitting}
                  aria-current={cur ? "step" : undefined}
                  onClick={() => go(n)}
                  className="flex min-w-0 flex-col gap-1.5 text-left disabled:cursor-not-allowed focus-visible:outline-none"
                >
                  <span className={cn("h-1 rounded-full", isDone || cur ? "bg-brand" : "bg-surface-3")} />
                  <span className={cn("flex min-w-0 items-center gap-1.5 text-xs", cur ? "font-semibold text-ink" : isDone ? "font-medium text-ink-2" : "text-ink-3")}>
                    <span
                      className={cn(
                        "flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold",
                        isDone ? "bg-brand text-white" : cur ? "bg-brand-soft text-brand-ink" : "bg-surface-3 text-ink-3"
                      )}
                    >
                      {isDone ? "✓" : n}
                    </span>
                    <span className="truncate max-[600px]:hidden">{label}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        }
      />
      <PageBody className="gap-4">
        {(restored || audienceLoaded) && (
          <div className="flex flex-wrap items-center gap-3 rounded-menu bg-brand-soft px-4 py-3 text-[13px]">
            <span className="flex-1">
              {[restored ? "Picked up where you left off." : null, audienceLoaded ? `Audience “${audienceLoaded}” is on the Audience step; adjust it there.` : null].filter(Boolean).join(" ")}
            </span>
            <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={startOver} className="font-semibold text-brand hover:bg-surface hover:text-brand">
              Start over
            </Button>
          </div>
        )}
        {fromId && fromQ.error && <MetaErrorCard message="We couldn't load that campaign. It may have been deleted." />}

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[1.7_1_560px] flex-col gap-4">
            {meta && metaAccountId && step <= 2 && <MetaHealthStatus adAccountId={metaAccountId} hideWhenHealthy />}
            {loadingFrom ? (
              <Skeleton className="h-96 rounded-card" />
            ) : step === 1 ? (
              <GoalStep draft={draft} patch={patch} metaConnected={accounts.some((a) => a.platform === "META")} />
            ) : step === 2 ? (
              <PlatformsStep
                draft={draft}
                patch={patch}
                accounts={accounts}
                accountsLoading={accountsQ.loading}
                clientName={clientName}
                minDailyBudget={minDailyBudget}
                currency={currency}
                lockedPlatform={fromId && fromQ.data ? fromQ.data.platform : undefined}
              />
            ) : step === 3 ? (
              <AudienceStep draft={draft} patchMeta={patchMeta} />
            ) : step === 4 ? (
              <AdsStep draft={draft} patchMeta={patchMeta} />
            ) : (
              <ReviewStep draft={draft} patch={patch} onEdit={go} accounts={accounts} minDailyBudget={minDailyBudget} currency={currency} />
            )}

            {error && <MetaErrorCard message={error.message} detail={error.detail} step={error.step} />}

            <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface px-[18px] py-3.5">
              {step > 1 && (
                <Button variant="secondary" onClick={() => go(step - 1)} disabled={submitting}>
                  Back
                </Button>
              )}
              <span className={cn("min-w-[160px] flex-1 text-[13px]", valid ? "text-ink-2" : "text-warn")}>
                {!valid ? hints[step] : step < 5 ? "" : meta && draft.launch !== "draft" ? "Creates the campaign, ad set and ad on Meta." : "Saved in Advertix only."}
              </span>
              {step < 5 ? (
                <Button variant="primary" disabled={!valid} onClick={() => go(step + 1)}>
                  Continue to {STEPS[step].toLowerCase()} <ChevronRight size={16} />
                </Button>
              ) : (
                <Button variant="primary" loading={submitting} disabled={firstInvalid < 5 || !valid} onClick={() => void launch()}>
                  {submitting ? (meta && draft.launch !== "draft" ? "Publishing to Meta…" : "Saving…") : launchLabel}
                </Button>
              )}
            </div>
          </div>
          <aside className="min-w-0 flex-[1_1_300px] min-[1100px]:sticky min-[1100px]:top-[200px]">
            <SidePanel draft={draft} step={step} minDailyBudget={minDailyBudget} currency={currency} history={history.data} historyLabel={historyLabel} />
          </aside>
        </div>
      </PageBody>
    </>
  );
}
