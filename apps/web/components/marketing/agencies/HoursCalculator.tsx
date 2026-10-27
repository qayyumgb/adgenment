"use client";

import { useId, useState } from "react";
import { AccentHeading, Eyebrow } from "@/components/marketing/ui/Heading";

// Hours per client per week: before → with Advertix (mockup estimates).
const HOURS = [
  { task: "Morning account checks", b: 3.5, a: 0.5, how: "One briefing ranks what matters across every client and platform." },
  { task: "Budget pacing and moves", b: 2, a: 0.3, how: "Monthly caps per client; the allocator proposes moves on response curves." },
  { task: "Weekly client report", b: 2.5, a: 0.2, how: "Coming soon: a live white-label link plus a scheduled PDF with an AI-drafted summary." },
  { task: "Creative refresh", b: 3, a: 1, how: "Fatigue flagged early; variants drafted from proven hooks." },
  { task: "Chasing tracking issues", b: 1.5, a: 0.2, how: "Pixel and access health checks today; CPA alerts grouped per campaign coming soon." },
];
const MAX = 3.5;
const RATE = 85;
const WEEKS_PER_MONTH = 4.3;
const FTE_HOURS = 40;

const hrs = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)} h/wk`;

export function HoursCalculator() {
  const [n, setN] = useState(12);
  const id = useId();

  const before = HOURS.reduce((s, h) => s + h.b, 0);
  const after = HOURS.reduce((s, h) => s + h.a, 0);
  const saved = (before - after) * n;
  const sums = [
    { v: `${Math.round(saved)} h`, l: "back every week" },
    { v: `${Math.round(((saved * WEEKS_PER_MONTH) / FTE_HOURS) * 10) / 10} FTE`, l: "of capacity, monthly" },
    { v: `$${Math.round(saved * WEEKS_PER_MONTH * RATE).toLocaleString("en-US")}`, l: `a month at $${RATE}/h` },
  ];

  return (
    <section className="px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,44px)]">
        <div className="flex flex-wrap items-end justify-between gap-x-14 gap-y-4">
          <div className="flex flex-[1_1_560px] flex-col gap-3">
            <Eyebrow>THE MONDAY PROBLEM</Eyebrow>
            <AccentHeading lead="Where agency hours go," accent="and where they come back." />
          </div>
          <label htmlFor={`${id}-n`} data-reveal="up" className="flex flex-[0_1_340px] flex-col gap-2">
            <span className="flex justify-between text-sm text-mk-ink2">
              <span>Clients you manage</span>
              <span className="font-mk-mono text-mk-ink">{n}</span>
            </span>
            <input
              id={`${id}-n`}
              type="range"
              min={2}
              max={40}
              value={n}
              onChange={(e) => setN(+e.target.value)}
              aria-valuetext={`${n} clients`}
              className="m-0 w-full [accent-color:#6448f2]"
            />
          </label>
        </div>

        <div className="border-t-2 border-mk-rule">
          {HOURS.map((h) => (
            <div
              key={h.task}
              data-reveal="rise"
              className="grid grid-cols-1 items-center gap-x-6 gap-y-2.5 border-b border-mk-hair py-[18px] mk-sm:grid-cols-2 min-[1000px]:grid-cols-[minmax(200px,1fr)_minmax(160px,.8fr)_minmax(160px,.8fr)_minmax(240px,1.3fr)]"
            >
              <span className="col-span-full text-[17px] font-medium tracking-[-0.015em] min-[1000px]:col-span-1">{h.task}</span>
              <span className="flex flex-col gap-1.5">
                <span className="flex justify-between font-mk-mono text-xs text-mk-ink3">
                  <span>BEFORE</span>
                  <span>{hrs(h.b * n)}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-mk-s3">
                  <span data-reveal="grow" className="block h-full rounded-full bg-[#c9a9ab]" style={{ width: `${(h.b / MAX) * 100}%` }} />
                </span>
              </span>
              <span className="flex flex-col gap-1.5">
                <span className="flex justify-between font-mk-mono text-xs text-mk-brand-ink">
                  <span>WITH ADVERTIX</span>
                  <span>{hrs(h.a * n)}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-mk-s3">
                  <span
                    data-reveal="grow"
                    className="block h-full rounded-full bg-[linear-gradient(115deg,#8a3ffc,#5d5cff_50%,#2d8cff)]"
                    style={{ width: `${(h.a / MAX) * 100}%` }}
                  />
                </span>
              </span>
              <span className="col-span-full text-sm text-mk-ink2 [text-wrap:pretty] min-[1000px]:col-span-1">{h.how}</span>
            </div>
          ))}
        </div>

        <div
          data-reveal="up"
          aria-live="polite"
          className="grid grid-cols-1 overflow-hidden rounded-3xl bg-mk-band text-mk-on-dark mk-sm:grid-cols-3"
        >
          {sums.map((s) => (
            <div
              key={s.l}
              className="flex flex-col gap-1.5 border-white/10 p-[clamp(18px,3vw,28px)] mk-sm:border-r mk-sm:last:border-r-0"
            >
              <span className="text-[clamp(34px,4.6vw,56px)] font-medium leading-none tabular-nums tracking-[-0.05em]">{s.v}</span>
              <span className="text-sm text-mk-on-dark2">{s.l}</span>
            </div>
          ))}
        </div>
        <span className="text-[13px] text-mk-ink3">
          Estimates per client per week, based on the workflows we design around, including features still coming.
          Your numbers will vary.
        </span>
      </div>
    </section>
  );
}
