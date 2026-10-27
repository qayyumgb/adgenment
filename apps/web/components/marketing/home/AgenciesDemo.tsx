"use client";

import { useState } from "react";
import { SectionHead } from "@/components/marketing/ui/Heading";
import { SegmentedControl } from "@/components/marketing/ui/SegmentedControl";
import { money } from "./allocation";

type Level = "suggest" | "small" | "auto";

const CLIENTS: {
  s: string;
  n: string;
  vertical: string;
  cap: number;
  spent: number;
  roas: string;
  status: "On track" | "Ahead" | "Behind";
  level: Level;
  decision: string;
  why: string;
  action: string;
}[] = [
  { s: "LS", n: "Lumen Skincare", vertical: "Beauty · DTC", cap: 52000, spent: 47, roas: "4.60x", status: "On track", level: "auto", decision: "Rotate “UGC v3” for two fresh variants", why: "Frequency 4.8 · CTR down 38% in five days", action: "Review variants" },
  { s: "KC", n: "Kobo Coffee Co.", vertical: "Food & beverage", cap: 32000, spent: 52, roas: "4.00x", status: "Ahead", level: "small", decision: "Lower the daily cap by $430", why: "At this pace October’s budget runs out on the 26th", action: "Lower cap" },
  { s: "FA", n: "Fieldhouse Athletics", vertical: "Sportswear", cap: 44000, spent: 44, roas: "3.11x", status: "On track", level: "small", decision: "Move $250/day from Search to TikTok", why: "TikTok’s next dollar earns 2.4× more", action: "Shift budget" },
  { s: "OF", n: "Orbit Fintech", vertical: "B2B SaaS · lead gen", cap: 18000, spent: 52, roas: "2.32x", status: "Ahead", level: "suggest", decision: "Narrow LinkedIn to Director+ titles", why: "Cost per lead is up 31% to $142", action: "Apply" },
  { s: "TF", n: "Tessel Furniture", vertical: "Furniture", cap: 23000, spent: 33, roas: "4.10x", status: "Behind", level: "small", decision: "Raise Meta by $95/day", why: "$2,900 would otherwise go unspent this month", action: "Raise budget" },
];

const LEVELS: { value: Level; label: string; desc: string }[] = [
  { value: "suggest", label: "Suggest only", desc: "Every change waits for a person. Good for regulated or cautious clients." },
  { value: "small", label: "Small changes", desc: "Coming soon. Budget moves under 15% a day apply on their own; bigger ones wait." },
  { value: "auto", label: "Autopilot", desc: "Coming soon. Advertix manages budgets inside the guardrail and sends a daily summary." },
];

export function AgenciesDemo() {
  const [pick, setPick] = useState(2);
  const [levels, setLevels] = useState<Record<number, Level>>({});
  const [applied, setApplied] = useState<Record<number, boolean>>({});

  const c = CLIENTS[pick];
  const level = levels[pick] ?? c.level;
  const done = !!applied[pick];
  const btnLabel = done ? "✓ Done · undo" : level === "auto" ? "Applied automatically" : c.action;

  return (
    <section id="agencies" className="border-t-2 border-mk-rule px-[clamp(16px,4vw,32px)] py-[clamp(72px,10vw,136px)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,48px)]">
        <SectionHead
          eyebrow="FOR AGENCIES"
          lead="Twenty clients."
          accent="Each with its own rules."
          accentTone="ink"
          lede="Every client gets a monthly cap, its own level of AI autonomy and its own decisions. Pick a client to see how Advertix treats it."
        />
        <div className="flex flex-wrap items-stretch gap-4">
          <div className="flex min-w-0 flex-[1_1_340px] flex-col border-t-2 border-mk-rule">
            {CLIENTS.map((x, i) => {
              const on = i === pick;
              const onTrack = x.status === "On track";
              return (
                <button
                  key={x.s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPick(i)}
                  className={`-mx-3 grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-mk-hair px-3 py-4 text-left text-mk-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-mk-brand ${
                    on ? "rounded-[14px] bg-mk-paper2" : "hover:bg-mk-paper2/60"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold ${
                      on ? "bg-mk-ink text-mk-paper" : "bg-mk-s3 text-mk-ink"
                    }`}
                  >
                    {x.s}
                  </span>
                  <span className="flex min-w-0 flex-col gap-2">
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold">{x.n}</span>
                    <span className="relative h-[5px] rounded-full bg-mk-s3" aria-label={`${x.spent}% of October budget spent`}>
                      <span
                        className={`absolute inset-y-0 left-0 rounded-full ${onTrack ? "bg-mk-brand" : "bg-mk-warn"}`}
                        style={{ width: `${x.spent}%` }}
                      />
                      <span className="absolute -bottom-[3px] -top-[3px] left-[45%] w-0.5 bg-mk-ink" />
                    </span>
                  </span>
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold ${
                      onTrack ? "bg-mk-pos-soft text-mk-pos" : "bg-mk-warn-soft text-mk-warn"
                    }`}
                  >
                    {x.status}
                  </span>
                </button>
              );
            })}
            <span className="pt-3 text-[12.5px] text-mk-ink3">
              Bar shows October budget spent · line marks today, day 14 of 31
            </span>
          </div>

          <div
            data-reveal="up"
            aria-live="polite"
            className="flex min-w-0 flex-[1.3_1_420px] flex-col gap-5 rounded-[28px] border border-mk-hair bg-mk-paper2 p-[clamp(20px,3vw,32px)] shadow-mk-card"
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[14px] bg-[linear-gradient(115deg,#8a3ffc,#5d5cff_50%,#2d8cff)] font-bold text-white">
                {c.s}
              </span>
              <span className="flex min-w-0 flex-col leading-[1.25]">
                <span className="text-[clamp(22px,2.4vw,28px)] font-semibold tracking-[-0.025em]">{c.n}</span>
                <span className="text-[13.5px] text-mk-ink2">{c.vertical} · day 14 of 31</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 tabular-nums">
              {[
                { l: "October cap", v: money(c.cap) },
                { l: "Spent", v: `${c.spent}%` },
                { l: "ROAS", v: c.roas },
              ].map((s) => (
                <span key={s.l} className="flex flex-col rounded-[14px] bg-mk-s2 px-3.5 py-3">
                  <span className="text-xs text-mk-ink3">{s.l}</span>
                  <span className="text-[clamp(17px,2vw,21px)] font-semibold tracking-[-0.02em]">{s.v}</span>
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="font-mk-mono text-xs tracking-[.06em] text-mk-ink3">AI AUTONOMY FOR THIS CLIENT</span>
              <SegmentedControl
                label={`AI autonomy for ${c.n}`}
                value={level}
                onChange={(v) => setLevels((s) => ({ ...s, [pick]: v }))}
                options={LEVELS}
                className="flex w-full"
                itemClassName="flex-auto justify-center"
              />
              <span className="text-sm text-mk-ink2">{LEVELS.find((l) => l.value === level)!.desc}</span>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[18px] bg-mk-band p-4 text-mk-on-dark">
              <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-[3px]">
                <span className="font-mk-mono text-[11.5px] tracking-[.06em] text-mk-lav-ink">NEXT DECISION</span>
                <span className="font-semibold leading-[1.35]">{c.decision}</span>
                <span className="text-[13px] text-mk-on-dark2">{c.why}</span>
              </span>
              <button
                type="button"
                aria-pressed={done}
                onClick={() => setApplied((s) => ({ ...s, [pick]: !done }))}
                className={`h-10 whitespace-nowrap rounded-full px-4 text-[13.5px] font-semibold text-mk-on-light transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                  done || level === "auto" ? "bg-mk-pos-on-dark" : "bg-white hover:bg-[#efebff]"
                }`}
              >
                {btnLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
