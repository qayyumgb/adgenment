"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Check, ChevronDown, Copy } from "lucide-react";
import type { AiPlan, PlanDraftsResult } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { Button, ButtonLink, Card, Menu, MenuItem, Pill, PlatformBadge, type PlatformKey } from "@/components/app/ui";
import { fmtRange, money, planSummaryText, ratioText, targetText } from "./format";
import type { PlanVersionEntry } from "./usePlanner";

/**
 * The plan (guide §5 row 9, plan A12): summary with facts and timeline, the
 * campaigns with budgets and history-based returns, the forecast and
 * watch-outs, how Advertix built it, and "Create campaigns as drafts".
 */

export function PlanPlaceholder({ thinking, clientName }: { thinking: boolean; clientName: string | null }) {
  return (
    <div className="flex min-h-[520px] flex-col justify-center gap-2 rounded-card border-[1.5px] border-dashed border-line-2 p-10">
      {thinking ? (
        <>
          <span className="text-lg font-semibold">Drafting the plan…</span>
          <span className="max-w-[420px] text-ink-2">Advertix is reading performance, overlap and fatigue{clientName ? ` for ${clientName}` : ""}.</span>
          <span className="mt-3 flex flex-col gap-2" aria-hidden="true">
            <span className="h-3 w-3/4 animate-pulse rounded-full bg-surface-3 motion-reduce:animate-none" />
            <span className="h-3 w-1/2 animate-pulse rounded-full bg-surface-3 motion-reduce:animate-none" />
          </span>
        </>
      ) : (
        <>
          <span className="text-lg font-semibold">Your plan will appear here</span>
          <span className="max-w-[420px] text-ink-2">Campaigns, budget split, timeline and a revenue forecast, ready to create as paused drafts.</span>
        </>
      )}
    </div>
  );
}

const PHASE_COLOURS = ["bg-brand-mid", "bg-brand", "bg-ink", "bg-ink-3"];
const compact = (plan: AiPlan, n: number) => (plan.metric === "revenue" ? fmtMoney(n, plan.currency, { compact: true }) : `${Math.round(n).toLocaleString("en-US")}`);

function Summary({ plan, version, versions, onVersion }: { plan: AiPlan; version: number; versions: PlanVersionEntry[]; onVersion: (v: number) => void }) {
  const pill =
    plan.meetsTarget === true ? (
      <Pill tone="pos">Forecast meets target</Pill>
    ) : plan.meetsTarget === false ? (
      <Pill tone="warn">Forecast below target</Pill>
    ) : !plan.forecast ? (
      <Pill tone="neutral">No forecast yet</Pill>
    ) : null;
  const facts = [
    { label: "Budget", value: money(plan, plan.budget) },
    { label: "Duration", value: `${plan.days} day${plan.days === 1 ? "" : "s"}` },
    { label: plan.metric === "revenue" ? "Target ROAS" : "Target cost", value: targetText(plan) },
    { label: plan.metric === "revenue" ? "Forecast ROAS" : "Forecast cost", value: plan.forecast ? ratioText(plan, plan.forecast.ratio, true) : "—" },
  ];
  return (
    <Card padded={false} className="flex flex-col gap-[18px] p-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-1 text-xs text-ink-3">
            Plan · {plan.clientName} ·
            {versions.length > 1 ? (
              <Menu
                width={300}
                trigger={(p) => (
                  <button type="button" {...p} aria-label={`Version ${version} of ${versions.length}`} className={cn("inline-flex items-center gap-0.5 rounded px-1 font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink", p.className)}>
                    v{version}
                    <ChevronDown size={12} aria-hidden="true" />
                  </button>
                )}
              >
                {(close) =>
                  [...versions].reverse().map((v) => (
                    <MenuItem key={v.version} selected={v.version === version} onSelect={() => (close(), onVersion(v.version))} hint={v.note ?? undefined}>
                      Version {v.version}
                    </MenuItem>
                  ))
                }
              </Menu>
            ) : (
              <span> v{version || 1}</span>
            )}
          </span>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">{plan.title}</h2>
        </div>
        {pill}
      </div>
      <div className="grid grid-cols-2 gap-2 tabular-nums sm:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-3">
            <span className="text-xs text-ink-2">{f.label}</span>
            <span className="truncate text-lg font-semibold">{f.value}</span>
          </div>
        ))}
      </div>
      {plan.phases.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">Timeline</span>
          <div className="flex gap-1">
            {plan.phases.map((p, i) => (
              <div key={`${p.name}-${i}`} className="flex min-w-[92px] flex-col gap-1.5" style={{ flex: `${p.endDay - p.startDay + 1} 1 0` }}>
                <span className={cn("h-2.5 rounded-full", PHASE_COLOURS[i % PHASE_COLOURS.length])} />
                <span className="break-words text-xs leading-snug">
                  <span className="font-semibold">{p.name}</span>
                  <br />
                  <span className="text-ink-2">{fmtRange(p.start, p.end)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Campaigns({ plan }: { plan: AiPlan }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
        <span className="text-base font-semibold">
          {plan.campaigns.length} campaign{plan.campaigns.length === 1 ? "" : "s"}
        </span>
        <span className="text-[13px] text-ink-2">{plan.forecast ? `Returns from ${plan.forecast.basis}` : "No results history to forecast from"}</span>
      </div>
      {plan.campaigns.map((c, i) => (
        <div key={`${c.name}-${i}`} className="grid grid-cols-[30px_minmax(0,1fr)_auto] gap-3.5 border-t border-line px-5 py-3.5">
          <PlatformBadge platform={c.platform as PlatformKey} size={26} className="mt-0.5" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold">{c.name}</span>
            <span className="text-[13px] text-ink-2">{c.audience}</span>
            {(c.buildsOn || c.startDay > 1 || c.endDay < plan.days) && (
              <span className="text-xs text-ink-3">
                {[c.buildsOn ? `Builds on “${c.buildsOn}”` : null, c.startDay > 1 || c.endDay < plan.days ? fmtRange(c.start, c.end) : null].filter(Boolean).join(" · ")}
              </span>
            )}
            {c.needs.length > 0 && (
              <span className="flex flex-wrap gap-1.5 pt-0.5">
                {c.needs.map((n) => (
                  <span key={n} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-2">
                    {n}
                  </span>
                ))}
              </span>
            )}
            {(c.blocker || c.warning) && <span className="text-xs text-warn">{c.blocker ?? c.warning}</span>}
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right tabular-nums">
            <span className="font-semibold">{money(plan, c.daily)}/day</span>
            <span className="text-xs text-ink-2">
              {money(plan, c.total)} · {Math.round(c.share)}%
            </span>
            {c.expected ? (
              <span className="text-xs font-semibold text-pos" title={c.expected.basis === "curve" ? "From this platform's response curve at the planned spend" : "From this platform's 30-day average"}>
                ≈ {ratioText(plan, c.expected.ratio, true)}
              </span>
            ) : (
              <span className="text-xs text-ink-3">No history</span>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}

function ForecastAndWatchOuts({ plan }: { plan: AiPlan }) {
  const f = plan.forecast;
  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1 rounded-card bg-brand-soft px-5 py-[18px]">
        <span className="text-[13px] font-semibold text-brand-ink">{plan.metric === "revenue" ? "Forecast revenue" : "Forecast results"}</span>
        {f ? (
          <>
            <span className="text-[28px] font-semibold tabular-nums tracking-[-0.03em]">
              {f.low != null && f.high != null && Math.round(f.low) !== Math.round(f.high) ? `${compact(plan, f.low)} – ${compact(plan, f.high)}` : compact(plan, f.value)}
            </span>
            <span className="text-[13px] text-ink-2">
              Most likely {plan.metric === "revenue" ? money(plan, f.value) : `${Math.round(f.value).toLocaleString("en-US")} results`} at {ratioText(plan, f.ratio)}, from {f.basis} for {plan.clientName}.
              {f.uncovered.platforms.length > 0 && ` Leaves out ${f.uncovered.platforms.join(" and ")} (${money(plan, f.uncovered.budget)}), which has no history yet.`}
            </span>
          </>
        ) : (
          <span className="text-[13px] text-ink-2">{plan.forecastNote}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2 rounded-card border border-line bg-surface px-5 py-[18px]">
        <span className="text-[13px] font-semibold">Watch-outs</span>
        {plan.watchOuts.length ? (
          <ul className="flex flex-col gap-2">
            {plan.watchOuts.map((w) => (
              <li key={w} className="flex gap-2 text-[13px] text-ink-2">
                <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-warn" aria-hidden="true" />
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-[13px] text-ink-2">Nothing stood out in this account.</span>
        )}
      </div>
    </div>
  );
}

function Details({ plan }: { plan: AiPlan }) {
  const checks = [
    { label: "After 24 hours", items: plan.checks.first24h },
    { label: "After 48 hours", items: plan.checks.first48h },
    { label: "After 7 days", items: plan.checks.first7d },
  ].filter((c) => c.items.length);
  return (
    <details className="group rounded-card border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        How Advertix built this
        <ChevronDown size={16} className="text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-4 border-t border-line px-5 py-4 text-[13px]">
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Why each campaign</span>
          {plan.campaigns.map((c, i) => (
            <p key={`${c.name}-${i}`} className="text-ink-2">
              <span className="font-medium text-ink">{c.name}:</span> {c.rationale}
              {c.interests.length > 0 && <span className="text-ink-3"> Interests to pick in the wizard: {c.interests.join(", ")}.</span>}
            </p>
          ))}
        </div>
        {plan.assumptions.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Assumptions</span>
            <ul className="list-disc pl-5 text-ink-2">
              {plan.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {checks.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            {checks.map((c) => (
              <div key={c.label} className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3">
                <span className="font-semibold">{c.label}</span>
                <ul className="list-disc pl-4 text-ink-2">
                  {c.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-ink-3">Daily budgets are each campaign’s share spread over its own days. Forecasts use this client’s results, never industry averages; platforms without results get none.</p>
      </div>
    </details>
  );
}

function ActionBar({ plan, created, creating, canEdit, cannotReason, onCreate }: { plan: AiPlan; created: PlanDraftsResult | null; creating: boolean; canEdit: boolean; cannotReason: string; onCreate: () => void }) {
  const [copied, setCopied] = useState(false);
  const creatable = plan.campaigns.filter((c) => !c.blocker).length;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(planSummaryText(plan));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Your browser blocked the clipboard.");
    }
  };
  if (created && created.created.length) {
    return (
      <Card padded={false} className="flex flex-col gap-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex flex-[1_1_200px] items-center gap-1.5 font-semibold text-pos">
            <Check size={18} strokeWidth={2.5} aria-hidden="true" />
            {created.created.length} draft{created.created.length === 1 ? "" : "s"} created for {plan.clientName}
          </span>
          <ButtonLink href="/campaigns" variant="primary" className="bg-ink text-surface hover:bg-ink/90">
            Open in Campaigns
          </ButtonLink>
        </div>
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {created.created.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={c.platform as PlatformKey} size={20} />
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {c.platform === "META" ? (
                <ButtonLink href={`/campaigns/new?from=${c.id}`} variant="soft" size="sm">
                  Finish in the wizard
                </ButtonLink>
              ) : (
                <span className="text-xs text-ink-3">Saved as a draft · publishing coming soon</span>
              )}
            </li>
          ))}
          {created.skipped.map((s) => (
            <li key={s.name} className="text-xs text-warn">
              {s.name}: {s.reason}
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  return (
    <Card padded={false} className="flex flex-wrap items-center gap-2.5 px-5 py-4">
      <span className="flex-[1_1_200px] text-[13px] text-ink-2">
        {created && !created.created.length ? created.skipped.map((s) => `${s.name}: ${s.reason}`).join(" ") : "Drafts are created paused. Nothing spends until you publish."}
      </span>
      <span className="ml-auto flex flex-wrap justify-end gap-2.5">
        <Button variant="secondary" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy summary"}
        </Button>
        <span title={!canEdit ? cannotReason : creatable === 0 ? "None of these platforms is connected for this client." : undefined}>
          <Button variant="primary" loading={creating} disabled={!canEdit || creatable === 0} onClick={onCreate}>
            Create {creatable} campaign{creatable === 1 ? "" : "s"} as drafts
          </Button>
        </span>
      </span>
    </Card>
  );
}

export function PlanView(props: {
  plan: AiPlan;
  version: number;
  versions: PlanVersionEntry[];
  onVersion: (v: number) => void;
  created: PlanDraftsResult | null;
  creating: boolean;
  canEdit: boolean;
  cannotReason: string;
  onCreate: () => void;
}) {
  const { plan } = props;
  return (
    <div className="flex flex-col gap-4">
      <Summary plan={plan} version={props.version} versions={props.versions} onVersion={props.onVersion} />
      <Campaigns plan={plan} />
      <ForecastAndWatchOuts plan={plan} />
      <Details plan={plan} />
      <ActionBar plan={plan} created={props.created} creating={props.creating} canEdit={props.canEdit} cannotReason={props.cannotReason} onCreate={props.onCreate} />
    </div>
  );
}
