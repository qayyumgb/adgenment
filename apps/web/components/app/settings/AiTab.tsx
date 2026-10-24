"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, Pill } from "@/components/app/ui";

/**
 * Settings › AI & automation (plan A14, decision 11): "Suggest only" is how
 * Advertix works today. Auto-apply and Autopilot (with their guardrails,
 * ask-first clients and automated rules) aren't built yet, so they show as
 * coming soon instead of switches that do nothing.
 */

const LEVELS = [
  { id: "suggest", name: "Suggest only", desc: "Advertix recommends; every change waits for a person to approve it.", active: true },
  { id: "small", name: "Auto-apply small changes", desc: "Budget moves within a guardrail and creative rotations apply on their own. Everything else asks first.", active: false },
  { id: "auto", name: "Autopilot", desc: "Advertix manages budgets, bids and creative rotation within your guardrails, and sends a daily summary.", active: false },
];

const TODAY = [
  "Suggestions (in Campaigns, the Overview and Budgets) change nothing until someone clicks Apply.",
  "Every change is recorded in the change log with who made it, and can be undone for 7 days.",
  "Budget suggestions stay between half and double the current daily budget.",
  "Changes reach Meta directly; Google, TikTok and LinkedIn are read-only for now.",
  "Analysts and client viewers can't apply anything.",
];

export function AiTab() {
  return (
    <>
      <Card padded={false} className="flex flex-col gap-[18px] p-[22px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">How much should Advertix do on its own?</span>
          <span className="text-[13px] text-ink-2">Every change is logged and can be undone for 7 days.</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3" role="radiogroup" aria-label="Autonomy">
          {LEVELS.map((l) => (
            <div
              key={l.id}
              role="radio"
              aria-checked={l.active}
              aria-disabled={!l.active}
              className={cn("flex flex-col gap-1.5 rounded-[14px] p-[18px]", l.active ? "border-[1.5px] border-brand bg-brand-soft shadow-[0_0_0_3px_rgb(var(--c-brand-soft))]" : "border border-line bg-surface opacity-70")}
            >
              <span className="flex items-center gap-2">
                <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full border-[1.5px]", l.active ? "border-brand bg-brand text-white" : "border-line-2")} aria-hidden="true">
                  {l.active && <Check size={10} strokeWidth={4} />}
                </span>
                <span className="font-semibold">{l.name}</span>
                {l.active ? <Pill tone="pos" className="ml-auto">Active</Pill> : <Pill tone="neutral" className="ml-auto">Coming soon</Pill>}
              </span>
              <span className="text-[13px] text-ink-2">{l.desc}</span>
            </div>
          ))}
        </div>
        <p className="border-t border-line pt-4 text-[13px] text-ink-2">
          Guardrails (the largest automatic budget change), clients that always need approval, and automated rules arrive with auto-apply. Until then nothing changes without a click.
        </p>
      </Card>

      <Card padded={false} className="flex flex-col gap-3 p-[22px]">
        <span className="text-base font-semibold">What Advertix does today</span>
        <ul className="flex flex-col gap-2">
          {TODAY.map((t) => (
            <li key={t} className="flex gap-2.5 text-sm text-ink-2">
              <Check size={16} className="mt-0.5 flex-none text-pos" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
