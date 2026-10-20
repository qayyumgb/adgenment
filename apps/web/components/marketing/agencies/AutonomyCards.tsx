"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/marketing/ui/SegmentedControl";

type Level = "suggest" | "small" | "auto";

const LEVELS: { value: Level; label: string; tag: string; text: string; box: string; tagColor: string }[] = [
  { value: "suggest", label: "Suggest", tag: "WAITS FOR YOU", text: "Every change is a suggestion. Nothing moves until someone on your team approves it.", box: "bg-mk-s2", tagColor: "text-mk-ink3" },
  { value: "small", label: "Small changes", tag: "AUTO ≤ 15%/DAY", text: "Budget moves under 15% a day and creative rotations apply on their own. Bigger moves wait.", box: "bg-mk-soft", tagColor: "text-mk-brand-ink" },
  { value: "auto", label: "Autopilot", tag: "RUNS ITSELF", text: "Advertix manages budgets, bids and rotation inside the monthly cap, and sends a daily summary.", box: "bg-[#e5f4ec]", tagColor: "text-mk-pos" },
];

const CLIENTS = [
  { s: "OF", c: "Orbit Fintech", k: "Regulated B2B · cautious", level: "suggest" as Level },
  { s: "LS", c: "Lumen Skincare", k: "DTC · growing fast", level: "small" as Level },
  { s: "MH", c: "Mara Home", k: "Steady · hands-off", level: "auto" as Level },
];

export function AutonomyCards() {
  const [lv, setLv] = useState<Level[]>(CLIENTS.map((c) => c.level));

  return (
    <div className="flex min-w-0 flex-[1.2_1_460px] flex-col gap-2.5">
      {CLIENTS.map((c, i) => {
        const cur = LEVELS.find((l) => l.value === lv[i])!;
        return (
          <div key={c.s} data-reveal="rise" className="flex flex-col gap-3.5 rounded-[22px] border border-mk-hair bg-mk-paper2 p-[18px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-mk-s3 text-xs font-bold">{c.s}</span>
              <span className="flex flex-[1_1_140px] flex-col leading-[1.3]">
                <span className="font-semibold">{c.c}</span>
                <span className="text-[13px] text-mk-ink3">{c.k}</span>
              </span>
              <SegmentedControl
                label={`AI autonomy for ${c.c}`}
                tone="paper"
                size="sm"
                value={lv[i]}
                onChange={(v) => setLv((s) => s.map((x, j) => (j === i ? v : x)))}
                options={LEVELS.map((l) => ({ value: l.value, label: l.label }))}
              />
            </div>
            <div aria-live="polite" className={`flex items-start gap-3 rounded-[14px] px-3.5 py-3 transition-colors duration-300 ${cur.box}`}>
              <span className={`whitespace-nowrap pt-0.5 font-mk-mono text-[11.5px] tracking-[.04em] ${cur.tagColor}`}>{cur.tag}</span>
              <span className="text-sm leading-[1.45]">{cur.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
