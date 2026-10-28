"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarRange, Check, ExternalLink } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import type { AdAccount, Platform } from "@/lib/api";
import { AutoPauseFields } from "@/components/app/campaign/AutoPauseFields";
import { cn } from "@/lib/cn";
import { currencySymbol } from "@/lib/money";
import { ButtonLink, Card, PlatformBadge, Segmented, type PlatformKey } from "@/components/app/ui";
import { Step1Page, Step3Audience, Step5Creative } from "@/components/app/new-campaign/metaSteps";
import { GOALS, WIZARD_PLATFORMS, hasMeta, scheduleCheck, todayStr, type Draft } from "./model";

export const fieldInput =
  "h-10 w-full rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60";

type Patch = (p: Partial<Draft>) => void;
/** Functional update of the Meta fields: async steps (uploads) must not overwrite edits made meanwhile. */
type PatchMeta = (u: Partial<Draft["meta"]>) => void;

export function StepCard({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-5 p-6">
      <div>
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        {sub && <p className="mt-1 text-[13px] text-ink-2">{sub}</p>}
      </div>
      {children}
    </Card>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error ? <span className="text-xs font-medium text-neg">{error}</span> : hint ? <span className="text-xs font-normal text-ink-2">{hint}</span> : null}
    </label>
  );
}

/* ── 1 · Goal ───────────────────────────────────────────────────────────── */

export function GoalStep({ draft, patch, metaConnected }: { draft: Draft; patch: Patch; metaConnected: boolean }) {
  const goal = GOALS.find((g) => g.id === draft.goal);
  // Conversion goals need a Meta Pixel; warn here, not at publish.
  const pixels = useApi((c) => (metaConnected && goal?.needsPixel ? c.getMetaPixels() : Promise.resolve([])), [metaConnected, goal?.needsPixel], {
    key: "meta-pixels",
  });
  const list = pixels.data ?? [];
  const known = metaConnected && !!goal?.needsPixel && !pixels.loading && !pixels.error;
  const missing = known && list.length === 0;
  const neverFired = known && list.length > 0 && list.every((p) => p.lastFiredTime === null);

  return (
    <StepCard title="What should this campaign do?" sub="This decides what the platforms optimize for. You can't change it after publishing.">
      <div role="radiogroup" aria-label="Goal" className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {GOALS.map((g) => {
          const on = draft.goal === g.id;
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => patch({ goal: g.id })}
              className={cn(
                "flex flex-col gap-2 rounded-menu border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft",
                on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-2 hover:bg-surface-2"
              )}
            >
              <span className="flex items-center justify-between">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-ctl", on ? "bg-brand text-white" : "bg-surface-2 text-ink-2")}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                {on && <Check size={16} strokeWidth={2.5} className="text-brand" aria-hidden="true" />}
              </span>
              <span className="font-semibold">{g.name}</span>
              <span className="text-[13px] text-ink-2">{g.desc}</span>
            </button>
          );
        })}
      </div>
      {goal && <p className="rounded-ctl bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">{goal.explainer}</p>}

      {missing && (
        <div className="flex items-start gap-3 rounded-menu border border-neg/30 bg-neg-soft p-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-none text-neg" aria-hidden="true" />
          <div className="min-w-0">
            <div className="font-semibold text-neg">You need a Meta Pixel before this can publish</div>
            <p className="mt-1 text-[13px] text-ink-2">
              A {goal?.name} campaign tells Meta to find people who convert, and it can only do that if the pixel on your site reports back. We couldn&apos;t find one on this ad account. Set it up in Events Manager, or pick <strong>Website visits</strong>, which works right now.
            </p>
            <ButtonLink href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer" variant="secondary" size="sm" className="mt-2.5" icon={<ExternalLink size={14} />}>
              Open Events Manager
            </ButtonLink>
          </div>
        </div>
      )}
      {neverFired && (
        <div className="flex items-start gap-3 rounded-menu border border-warn/30 bg-warn-soft p-4 text-[13px]">
          <AlertTriangle size={18} className="mt-0.5 flex-none text-warn" aria-hidden="true" />
          <div>
            <div className="font-semibold text-warn">Your pixel hasn&apos;t recorded anything yet</div>
            <p className="mt-1 text-ink-2">It exists, so this will publish, but it has never received an event — usually it isn&apos;t installed on your site yet. Until it is, delivery will be slow and expensive.</p>
          </div>
        </div>
      )}

      <Field label="Campaign name (optional)" hint="Only you see it. Leave it empty and Advertix names it from the platform, goal and month.">
        <input value={draft.name} maxLength={200} onChange={(e) => patch({ name: e.target.value, nameTouched: true })} className={fieldInput} placeholder="e.g. Autumn sale — prospecting" />
      </Field>
    </StepCard>
  );
}

/* ── 2 · Platforms & budget ─────────────────────────────────────────────── */

export function PlatformsStep({
  draft,
  patch,
  accounts,
  accountsLoading,
  clientName,
  minDailyBudget,
  currency,
  lockedPlatform,
}: {
  draft: Draft;
  patch: Patch;
  accounts: AdAccount[];
  accountsLoading: boolean;
  clientName: (id: string | null | undefined) => string | null;
  minDailyBudget: number | null;
  currency: string | null;
  /** Resuming an existing campaign: its platform and account can't change. */
  lockedPlatform?: Platform;
}) {
  const sym = currencySymbol(currency);
  const s = scheduleCheck(draft, minDailyBudget, sym);
  const goal = GOALS.find((g) => g.id === draft.goal);
  const meta = hasMeta(draft);
  const metaAccount = accounts.find((a) => a.id === draft.accountIds.META) ?? null;
  // The calendar's read on these dates (C5/C6): Black Friday launch, overlapping campaigns, key dates.
  const datesOk = !s.start && !s.end && !!draft.startDate;
  const checkQ = useApi(
    (c) => (metaAccount && goal && datesOk ? c.checkLaunch({ adAccountId: metaAccount.id, objective: goal.value, start: draft.startDate, end: draft.runContinuously ? null : draft.endDate, excludeId: draft.createdIds.META }) : Promise.resolve(null)),
    [metaAccount?.id, goal?.value, draft.startDate, draft.runContinuously ? "" : draft.endDate, datesOk],
    { key: "launch-check", keepPrevious: true }
  );
  const launchCheck = metaAccount && datesOk ? checkQ.data : null;
  const safety = useApi((c) => (meta ? c.getSafetySettings() : Promise.resolve(null)), [meta], { key: "safety-settings" }).data;
  const metaClient = safety?.clients.find((c) => c.id === metaAccount?.clientId);
  // An empty field isn't an error yet; the footer still says what's missing.
  const budgetError = draft.budgetInput.trim() ? s.budget : null;
  const byPlatform = (p: Platform) => accounts.filter((a) => a.platform === p && a.isActive);

  const toggle = (p: Platform) => {
    if (lockedPlatform) return;
    const list = byPlatform(p);
    if (!list.length) return;
    const on = draft.platforms.includes(p);
    const platforms = on ? draft.platforms.filter((x) => x !== p) : [...draft.platforms, p];
    const accountIds = { ...draft.accountIds };
    if (on) delete accountIds[p];
    else accountIds[p] = accountIds[p] ?? list[0].id;
    patch({ platforms, accountIds });
  };

  return (
    <div className="flex flex-col gap-4">
      <StepCard title="Where should it run?" sub="Meta campaigns publish from Advertix. Other platforms are saved as drafts until publishing comes to them.">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
          {WIZARD_PLATFORMS.map((p) => {
            const list = byPlatform(p.id);
            const on = draft.platforms.includes(p.id);
            const disabled = !list.length || (!!lockedPlatform && lockedPlatform !== p.id);
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col gap-3 rounded-menu border p-4 transition-colors",
                  on ? "border-brand bg-brand-soft" : "border-line bg-surface",
                  disabled && "opacity-60"
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => toggle(p.id)}
                  className="flex items-center gap-3 text-left focus-visible:outline-none disabled:cursor-not-allowed"
                >
                  <PlatformBadge platform={p.id as PlatformKey} size={34} />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-xs text-ink-2">{p.sub}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn("flex h-5 w-5 flex-none items-center justify-center rounded-[5px] border-[1.5px] text-white", on ? "border-brand bg-brand" : "border-line-2 bg-surface")}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                </button>
                {accountsLoading ? (
                  <span className="text-xs text-ink-3">Loading accounts…</span>
                ) : !list.length ? (
                  <span className="text-xs text-ink-2">
                    Not connected ·{" "}
                    <Link href="/connections" className="font-semibold text-brand hover:text-brand-hover">
                      Connect
                    </Link>
                  </span>
                ) : (
                  <>
                    {on && list.length > 1 ? (
                      <select
                        aria-label={`${p.name} ad account`}
                        value={draft.accountIds[p.id] ?? ""}
                        disabled={!!lockedPlatform}
                        onChange={(e) => patch({ accountIds: { ...draft.accountIds, [p.id]: e.target.value } })}
                        className={cn(fieldInput, "h-9 text-[13px]")}
                      >
                        {list.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.accountName}
                            {clientName(a.clientId) ? ` · ${clientName(a.clientId)}` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="truncate text-xs text-ink-2">
                        {list[0].accountName}
                        {clientName(list[0].clientId) ? ` · ${clientName(list[0].clientId)}` : ""}
                      </span>
                    )}
                    <span className={cn("self-start rounded-full px-2 py-px text-[11px] font-semibold", p.id === "META" ? "bg-pos-soft text-pos" : "bg-surface-3 text-ink-2")}>
                      {p.id === "META" ? "Publishes from Advertix" : "Saved as draft · publishing coming soon"}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </StepCard>

      <StepCard title="Budget and schedule" sub={currency ? `In the ad account's currency (${currency}).` : undefined}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            Budget type
            <Segmented
              label="Budget type"
              value={draft.budgetType}
              onChange={(v) => patch({ budgetType: v, ...(v === "LIFETIME" ? { runContinuously: false } : {}) })}
              options={[
                { value: "DAILY", label: "Daily" },
                { value: "LIFETIME", label: "Total" },
              ]}
            />
          </div>
          <div className="min-w-[200px] flex-1">
            <Field
              label={draft.budgetType === "DAILY" ? "Daily budget" : "Total budget"}
              error={budgetError}
              hint={`This account's minimum is ${sym}${s.floor.toLocaleString()}${draft.budgetType === "DAILY" ? " a day" : " in total"}.`}
            >
              <span className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{sym}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={s.floor}
                  value={draft.budgetInput}
                  onChange={(e) => patch({ budgetInput: e.target.value })}
                  placeholder="e.g. 50"
                  aria-invalid={!!budgetError}
                  className={cn(fieldInput, "pl-12 tabular-nums", budgetError && "border-neg")}
                />
              </span>
            </Field>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Schedule
          <Segmented
            label="Schedule"
            value={draft.runContinuously ? "always" : "end"}
            onChange={(v) => patch({ runContinuously: v === "always", ...(v === "always" ? { endDate: "" } : {}) })}
            options={[
              { value: "always", label: "Run continuously", disabled: draft.budgetType === "LIFETIME" },
              { value: "end", label: "Set an end date" },
            ]}
          />
          <span className="text-xs font-normal text-ink-2">
            {draft.runContinuously ? "Starts at 00:00 on the start date, with no end date: pause it whenever you like." : `Runs from 00:00 on the start date to 23:59 on the last day${draft.budgetType === "LIFETIME" ? " (a total budget needs an end date, so the platform can spread it)" : ""}.`}
            {metaAccount?.timezone && ` Times are in the ad account's time zone (${metaAccount.timezone.replace(/_/g, " ")}).`}
          </span>
        </div>
        <div className="grid gap-4 min-[600px]:grid-cols-2">
          <Field label="Start date" error={s.start}>
            <input type="date" value={draft.startDate} min={todayStr()} onChange={(e) => patch({ startDate: e.target.value })} className={fieldInput} />
          </Field>
          {!draft.runContinuously && (
            <Field label="End date" error={s.end} hint={s.days ? `${s.days} day${s.days === 1 ? "" : "s"}` : undefined}>
              <input type="date" value={draft.endDate} min={draft.startDate} onChange={(e) => patch({ endDate: e.target.value })} className={fieldInput} />
            </Field>
          )}
        </div>
        {launchCheck && (launchCheck.peak || launchCheck.overlaps.length > 0) && (
          <div className="flex flex-col gap-2">
            {launchCheck.peak && (
              <p className="m-0 rounded-ctl bg-warn-soft px-3.5 py-2.5 text-[13px] text-ink [text-wrap:pretty]">
                <span className="font-semibold text-warn">Starts in Black Friday week. </span>
                Ads cost the most from Thanksgiving to Cyber Monday, and a new campaign spends its first days learning. Starting a week or two earlier lets it settle before the peak.
              </p>
            )}
            {launchCheck.overlaps.length > 0 && (
              <p className="m-0 rounded-ctl bg-warn-soft px-3.5 py-2.5 text-[13px] text-ink [text-wrap:pretty]">
                <span className="font-semibold text-warn">
                  Overlaps with {launchCheck.overlaps.length === 1 ? "a running" : `${launchCheck.overlaps.length} running`} {goal?.name.toLowerCase()} campaign{launchCheck.overlaps.length === 1 ? "" : "s"}{" "}
                </span>
                on {metaAccount?.accountName}: {launchCheck.overlaps.slice(0, 3).map((o) => `“${o.name}”`).join(", ")}
                {launchCheck.overlaps.length > 3 ? ` and ${launchCheck.overlaps.length - 3} more` : ""}. If they reach the same people they bid against each other, so check the audiences or add this to the existing campaign.{" "}
                <Link href="/calendar" className="inline-flex items-center gap-1 font-semibold text-brand no-underline hover:underline">
                  <CalendarRange size={13} aria-hidden="true" /> See the calendar
                </Link>
              </p>
            )}
          </div>
        )}
      </StepCard>

      {meta && (
        <StepCard title="Pause automatically" sub="Optional, for the Meta campaign. Advertix checks every hour, and each pause shows in Activity with Undo.">
          <AutoPauseFields
            value={draft.autoPause}
            onChange={(autoPause) => patch({ autoPause })}
            currencySymbol={sym}
            trackingRelevant={!!goal?.needsPixel}
            trackingCoveredBy={metaClient?.pixel && goal?.needsPixel ? metaClient.name : null}
            keyDates={launchCheck?.keyDates ?? []}
            minDate={draft.startDate || todayStr()}
            maxDate={draft.runContinuously ? undefined : draft.endDate || undefined}
          />
          {safety?.automationPaused && (
            <p className="m-0 text-xs font-medium text-warn">Automation is paused for this workspace (Settings › AI &amp; automation), so these won&apos;t act until it&apos;s turned back on.</p>
          )}
        </StepCard>
      )}
    </div>
  );
}

/* ── 3 · Audience ───────────────────────────────────────────────────────── */

function NotMetaNote({ what }: { what: string }) {
  return (
    <StepCard title={what} sub="Only Meta publishes from Advertix today.">
      <p className="rounded-ctl bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
        The other platforms you picked are saved as drafts. Set their {what.toLowerCase()} in each platform&apos;s own ads manager for now — Advertix will cover it when publishing arrives there.
      </p>
    </StepCard>
  );
}

export function AudienceStep({ draft, patchMeta }: { draft: Draft; patchMeta: PatchMeta }) {
  if (!hasMeta(draft)) return <NotMetaNote what="Audience" />;
  return (
    <Card className="p-6">
      <Step3Audience state={draft.meta} patch={patchMeta} />
    </Card>
  );
}

/* ── 4 · Ads ────────────────────────────────────────────────────────────── */

export function AdsStep({ draft, patchMeta: metaPatch }: { draft: Draft; patchMeta: PatchMeta }) {
  if (!hasMeta(draft)) return <NotMetaNote what="Ads" />;
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <Step1Page state={draft.meta} patch={metaPatch} />
      </Card>
      <Card className="p-6">
        <Step5Creative state={draft.meta} patch={metaPatch} pageName={draft.meta.pageName} />
      </Card>
    </div>
  );
}
