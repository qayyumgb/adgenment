"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Check, CircleDashed, ExternalLink, Sparkles } from "lucide-react";
import type { AdAccount, AnalyticsOverview } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtMoney } from "@/lib/money";
import { AiMark, ButtonLink, Card, PlatformBadge, type PlatformKey } from "@/components/app/ui";
import { CTA_OPTIONS } from "@/components/campaigns/publish/metaSteps";
import { GOALS, WIZARD_PLATFORMS, forecast, hasMeta, scheduleCheck, strength, type Draft, type LaunchMode } from "./model";
import { StepCard, fieldInput } from "./steps";

const fmtDate = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1000)}k` : Math.round(n).toLocaleString("en-US"));

function Row({ label, value, step, onEdit }: { label: string; value: ReactNode; step: number; onEdit: (s: number) => void }) {
  return (
    <div className="flex items-start gap-4 border-t border-line py-3 first:border-t-0">
      <span className="w-32 flex-none text-[13px] text-ink-2">{label}</span>
      <span className="min-w-0 flex-1 text-sm">{value}</span>
      <button type="button" onClick={() => onEdit(step)} className="flex-none text-[13px] font-semibold text-brand hover:text-brand-hover">
        Edit
      </button>
    </div>
  );
}

/* ── 5 · Review & launch ────────────────────────────────────────────────── */

export function ReviewStep({
  draft,
  patch,
  onEdit,
  accounts,
  minDailyBudget,
  currency,
}: {
  draft: Draft;
  patch: (p: Partial<Draft>) => void;
  onEdit: (step: number) => void;
  accounts: AdAccount[];
  minDailyBudget: number | null;
  currency: string | null;
}) {
  const s = scheduleCheck(draft, minDailyBudget);
  const goal = GOALS.find((g) => g.id === draft.goal);
  const m = draft.meta;
  const meta = hasMeta(draft);
  const others = draft.platforms.filter((p) => p !== "META");
  const asset = m.creativeType === "CAROUSEL" && m.carouselCards.length >= 2 ? `Carousel · ${m.carouselCards.length} cards` : m.videoId || m.videoUrl ? "Video" : m.imageHash || m.imageUrl ? "Image" : "—";
  const geo = [...m.countries, ...m.cities.map((c) => c.name)];
  const launchOpts: { id: LaunchMode; label: string; sub: string }[] = [
    { id: "paused", label: "Publish paused", sub: "Created on Meta, nothing spends until you start it. Recommended." },
    {
      id: "start",
      label: draft.startDate > new Date().toISOString().slice(0, 10) ? `Publish and start on ${fmtDate(draft.startDate)}` : "Publish and start now",
      sub: "Delivery begins after Meta's review, usually within an hour.",
    },
    { id: "draft", label: "Save as draft", sub: "Saved in Advertix only. Publish it later from the campaign." },
  ];

  return (
    <div className="flex flex-col gap-4">
      <StepCard title="Review and launch" sub="Check everything once more. You can change budget and status any time after publishing.">
        <div>
          <Row label="Goal" step={1} onEdit={onEdit} value={goal?.name ?? "—"} />
          <div className="flex items-center gap-4 border-t border-line py-3">
            <label htmlFor="review-name" className="w-32 flex-none text-[13px] text-ink-2">
              Name
            </label>
            <input id="review-name" value={draft.name} maxLength={200} onChange={(e) => patch({ name: e.target.value, nameTouched: true })} className={cn(fieldInput, "h-9 flex-1")} />
          </div>
          <Row
            label="Platforms"
            step={2}
            onEdit={onEdit}
            value={
              <span className="flex flex-wrap gap-2">
                {draft.platforms.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1.5">
                    <PlatformBadge platform={p as PlatformKey} size={20} />
                    {WIZARD_PLATFORMS.find((x) => x.id === p)?.name}
                    <span className="text-xs text-ink-3">· {accounts.find((a) => a.id === draft.accountIds[p])?.accountName}</span>
                  </span>
                ))}
              </span>
            }
          />
          <Row
            label="Budget"
            step={2}
            onEdit={onEdit}
            value={`${fmtMoney(s.amount, currency)} ${draft.budgetType === "DAILY" ? "per day" : "in total"} · from ${fmtDate(draft.startDate)}${draft.runContinuously ? ", no end date" : ` to ${fmtDate(draft.endDate)}`}`}
          />
          {meta && (
            <>
              <Row
                label="Audience"
                step={3}
                onEdit={onEdit}
                value={`${geo.length ? geo.slice(0, 4).join(", ") + (geo.length > 4 ? ` +${geo.length - 4}` : "") : "Saved / custom audience"} · ages ${m.ageMin}–${m.ageMax}${m.genders.length ? (m.genders[0] === 1 ? " · men" : " · women") : ""}${m.interests.length ? ` · ${m.interests.length} interest${m.interests.length === 1 ? "" : "s"}` : ""}`}
              />
              <Row label="Page" step={4} onEdit={onEdit} value={m.pageName || "—"} />
              <Row
                label="Ad"
                step={4}
                onEdit={onEdit}
                value={
                  <span className="flex flex-col gap-0.5">
                    <span>
                      {asset} · {CTA_OPTIONS.find((c) => c.value === m.callToAction)?.label}
                    </span>
                    {m.headline && <span className="font-semibold">{m.headline}</span>}
                    <span className="line-clamp-2 text-ink-2">{m.message}</span>
                    <span className="truncate text-xs text-ink-3">{m.linkUrl}</span>
                  </span>
                }
              />
            </>
          )}
        </div>
      </StepCard>

      <StepCard title="How should it launch?">
        {meta ? (
          <div role="radiogroup" aria-label="Launch" className="grid gap-3 min-[700px]:grid-cols-3">
            {launchOpts.map((o) => {
              const on = draft.launch === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => patch({ launch: o.id })}
                  className={cn(
                    "flex flex-col gap-1 rounded-menu border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-soft",
                    on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2"
                  )}
                >
                  <span className="font-semibold">{o.label}</span>
                  <span className="text-[13px] text-ink-2">{o.sub}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-ink-2">These platforms are saved as drafts in Advertix. Nothing is created on the platforms yet.</p>
        )}
        {meta && others.length > 0 && (
          <p className="rounded-ctl bg-surface-2 px-3.5 py-3 text-[13px] text-ink-2">
            {others.map((p) => WIZARD_PLATFORMS.find((x) => x.id === p)?.name).join(", ")} will be saved as draft{others.length === 1 ? "" : "s"} — publishing comes to {others.length === 1 ? "it" : "them"} later.
          </p>
        )}
      </StepCard>
    </div>
  );
}

/* ── Side panel: forecast + setup strength + tip ────────────────────────── */

const TIPS = [
  "Website visits work without a pixel, which makes them the safest place to start.",
  "Start with one platform and a budget you'd be fine spending for a week while it learns.",
  "Broad audiences give Meta room to learn. Add interests only when you're sure they matter.",
  "Keep the headline under 40 characters and put the offer in the first line of the text.",
  "Publishing paused lets you check the ad in Ads Manager before anything spends.",
];

export function SidePanel({
  draft,
  step,
  minDailyBudget,
  currency,
  history,
  historyLabel,
}: {
  draft: Draft;
  step: number;
  minDailyBudget: number | null;
  currency: string | null;
  history: AnalyticsOverview | null;
  historyLabel: string;
}) {
  const f = forecast(draft, minDailyBudget, history);
  const st = strength(draft, minDailyBudget);
  const goal = draft.goal;
  const tiles: { label: string; value: string }[] = f.based
    ? [
        { label: draft.runContinuously ? "Spend / 30 days" : "Total spend", value: fmtMoney(f.total, currency, { whole: true }) },
        { label: "Est. reach / day", value: `${compact(f.reachPerDay)} people` },
        goal === "conversions" && f.roas !== null
          ? { label: "Est. ROAS", value: `${f.roas.toFixed(2)}x` }
          : { label: goal === "leads" || goal === "conversions" ? "Est. results / day" : "Est. clicks / day", value: compact(goal === "leads" || goal === "conversions" ? f.conversionsPerDay : f.clicksPerDay) },
        { label: "Cost / 1,000 views", value: fmtMoney(f.cpm, currency) },
      ]
    : [{ label: draft.runContinuously ? "Spend / 30 days" : "Total spend", value: f.total > 0 ? fmtMoney(f.total, currency, { whole: true }) : "—" }];

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <AiMark size={32} />
        <span className="flex flex-col leading-tight">
          <span className="font-semibold">Forecast</span>
          <span className="text-xs text-ink-2">Updates as you build</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 tabular-nums">
        {tiles.map((t) => (
          <span key={t.label} className="flex flex-col rounded-menu bg-surface-2 p-3">
            <span className="text-xs text-ink-2">{t.label}</span>
            <span className="text-lg font-semibold">{t.value}</span>
          </span>
        ))}
      </div>
      <p className="-mt-1 text-xs text-ink-3">
        {f.based
          ? `Based on ${historyLabel}'s last 30 days. Estimates, not promises.`
          : !(f.daily > 0)
            ? "Add a budget to see reach and results estimates."
            : "No delivery history yet, so there's nothing honest to estimate reach from. It appears after your first campaigns run."}
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="flex justify-between text-xs text-ink-2">
          <span>Setup strength</span>
          <span className="font-semibold text-ink">{st.score}%</span>
        </span>
        <span className="h-2 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={st.score} aria-valuemin={0} aria-valuemax={100} aria-label="Setup strength">
          <span className="block h-full rounded-full bg-[image:var(--grad)] transition-[width] duration-300" style={{ width: `${st.score}%` }} />
        </span>
        {st.missing.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {st.missing.slice(0, 3).map((m) => (
              <li key={m} className="flex items-center gap-2 text-xs text-ink-2">
                <CircleDashed size={12} className="flex-none text-ink-3" aria-hidden="true" />
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="rounded-menu bg-brand-soft px-3.5 py-3 text-[13px] [text-wrap:pretty]">
        <span className="font-semibold text-brand-ink">Tip:</span> {TIPS[step - 1]}
      </p>
    </Card>
  );
}

/* ── Done ───────────────────────────────────────────────────────────────── */

export type LaunchResult = { campaignId: string; platform: string; name: string; state: "published-paused" | "published-live" | "draft"; adsManagerUrl?: string }[];

export function DoneScreen({ result }: { result: LaunchResult }) {
  const published = result.some((r) => r.state !== "draft");
  const live = result.some((r) => r.state === "published-live");
  const first = result.find((r) => r.state !== "draft") ?? result[0];
  return (
    <div className="flex justify-center px-[clamp(16px,4vw,32px)] py-12">
      <Card className="flex w-full max-w-[560px] flex-col items-start gap-[18px] p-9">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-pos-soft text-pos">
          <Check size={26} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div>
          <div className="text-2xl font-semibold tracking-[-0.02em]">{live ? "Your campaign is starting" : published ? "Your campaign is on Meta" : "Saved as a draft"}</div>
          <div className="mt-1 text-ink-2">
            {live
              ? "Meta reviews new ads before delivery, usually within an hour."
              : published
                ? "It's paused and not spending anything. Start it from the campaign when you're happy with it."
                : "Nothing was created on the platforms. Open it to publish when you're ready."}
          </div>
        </div>
        <div className="flex w-full flex-col gap-2">
          {result.map((r) => (
            <div key={r.campaignId} className="flex items-center gap-2.5 rounded-menu bg-surface-2 px-3 py-2.5">
              <PlatformBadge platform={r.platform as PlatformKey} size={24} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <span className={cn("rounded-full px-2 py-px text-xs font-semibold", r.state === "published-live" ? "bg-pos-soft text-pos" : r.state === "published-paused" ? "bg-warn-soft text-warn" : "bg-surface-3 text-ink-2")}>
                {r.state === "published-live" ? "In review" : r.state === "published-paused" ? "Paused on Meta" : "Draft"}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/campaigns/${first.campaignId}`} variant="primary">
            Open campaign
          </ButtonLink>
          {first.adsManagerUrl && (
            <ButtonLink href={first.adsManagerUrl} target="_blank" rel="noopener noreferrer" variant="secondary" icon={<ExternalLink size={16} />}>
              Ads Manager
            </ButtonLink>
          )}
          <Link href="/campaigns" className="inline-flex h-10 items-center px-2 text-sm font-semibold text-brand hover:text-brand-hover">
            All campaigns
          </Link>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          <Sparkles size={12} aria-hidden="true" /> Results show up after the first sync, usually within a day of delivery.
        </p>
      </Card>
    </div>
  );
}
