"use client";

import { useState } from "react";

type Status = "ON TRACK" | "AHEAD" | "BEHIND" | "1 DECISION" | "ALERT";

const BOOK: { s: string; n: string; spent: number; roas: string; t: Status; note: string }[] = [
  { s: "LS", n: "Lumen Skincare", spent: 47, roas: "4.60x", t: "ON TRACK", note: "Founder-story hook is carrying TikTok. Raising Spark Ads by $160/day is waiting for your approval." },
  { s: "KC", n: "Kobo Coffee Co.", spent: 52, roas: "4.00x", t: "AHEAD", note: "At this pace October’s $32,000 runs out on the 26th. Lowering the daily cap by $430 keeps it live to the 31st." },
  { s: "FA", n: "Fieldhouse", spent: 44, roas: "3.11x", t: "1 DECISION", note: "Generic Search costs $26.80 per purchase against $14.20 on TikTok. Moving $250/day is worth about $3,100 a week." },
  { s: "MH", n: "Mara Home", spent: 41, roas: "4.35x", t: "ON TRACK", note: "Steady. The Snapchat pixel stopped firing 12 minutes ago; two campaigns are paused until it’s back." },
  { s: "OF", n: "Orbit Fintech", spent: 52, roas: "2.32x", t: "ALERT", note: "LinkedIn cost per lead is up 31%. Narrowing to Director+ titles is queued; this client is on suggest-only." },
  { s: "TF", n: "Tessel Furniture", spent: 33, roas: "4.10x", t: "BEHIND", note: "Underspending by $2,900 this month. Meta prospecting returns 4.30x and can absorb most of it." },
];

// [chip bg, chip fg, pacing bar]
const TONE: Record<Status, [string, string, string]> = {
  "ON TRACK": ["rgba(65,211,154,.16)", "#41d39a", "#8b73ff"],
  AHEAD: ["rgba(242,180,78,.16)", "#f2b44e", "#f2b44e"],
  BEHIND: ["rgba(242,180,78,.16)", "#f2b44e", "#f2b44e"],
  "1 DECISION": ["rgba(185,171,255,.18)", "#c7bcff", "#8b73ff"],
  ALERT: ["rgba(255,113,117,.16)", "#ff8a8e", "#ff7175"],
};

/** Hero demo: an agency's client book, pick a client to read its note. */
export function ClientBook() {
  const [pick, setPick] = useState(2);
  const sel = BOOK[pick];

  return (
    <div
      data-reveal="up"
      className="flex min-w-0 flex-[1_1_440px] flex-col gap-3 rounded-[28px] bg-mk-ink p-[clamp(16px,2.4vw,22px)] text-mk-on-dark shadow-[0_50px_100px_-50px_rgba(40,24,120,.6)]"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[linear-gradient(115deg,#8a3ffc,#5d5cff_50%,#2d8cff)] text-[10px] font-bold">
          H&amp;P
        </span>
        <span className="font-semibold">Halden &amp; Pike</span>
        <span className="flex-1" />
        <span className="flex-none whitespace-nowrap font-mk-mono text-[11.5px] text-mk-on-dark2">OCT · DAY 14 OF 31</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {BOOK.map((c, i) => {
          const on = i === pick;
          const [tb, tf, bar] = TONE[c.t];
          return (
            <button
              key={c.s}
              type="button"
              aria-pressed={on}
              onClick={() => setPick(i)}
              className={`grid grid-cols-[32px_minmax(0,1fr)_58px] items-center gap-3 rounded-[14px] border p-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-mk-lav mk-sm:grid-cols-[32px_minmax(0,1fr)_58px_96px] ${
                on ? "border-mk-lav-ink/45 bg-white/[.08]" : "border-transparent bg-white/[.03] hover:bg-white/[.06]"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-white/[.08] text-[11px] font-bold">{c.s}</span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="truncate text-sm font-semibold">{c.n}</span>
                <span className="relative h-1 rounded-full bg-white/10" aria-label={`${c.spent}% of budget spent`}>
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${c.spent}%`, background: bar }} />
                  <span className="absolute -bottom-[3px] -top-[3px] left-[45%] w-0.5 bg-white" />
                </span>
              </span>
              <span className="text-right font-mk-mono text-[13px]">{c.roas}</span>
              <span
                className="hidden justify-self-end whitespace-nowrap rounded-full px-2 py-[3px] font-mk-mono text-[11px] tracking-[.03em] mk-sm:inline"
                style={{ background: tb, color: tf }}
              >
                {c.t}
              </span>
            </button>
          );
        })}
      </div>
      <div
        aria-live="polite"
        className="min-h-[68px] rounded-[14px] border border-mk-lav-ink/25 bg-[linear-gradient(135deg,rgba(138,63,252,.3),rgba(45,140,255,.16))] px-3.5 py-3 text-sm leading-normal"
      >
        <span className="font-mk-mono text-[11.5px] tracking-[.06em] text-[#d9d2ff]">✦ {sel.n.toUpperCase()} ·</span> {sel.note}
      </div>
    </div>
  );
}
