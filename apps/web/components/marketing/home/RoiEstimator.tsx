"use client";

import { useId, useState } from "react";
import { money } from "./allocation";

const SPEND = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const SHARES = [5, 10, 15];
/** Mockup's assumption: 60% of the moved share is "put to better use". */
const EFFECT = 0.6;

export function RoiEstimator() {
  const [ix, setIx] = useState(2);
  const [pct, setPct] = useState(10);
  const id = useId();

  const spend = SPEND[ix];
  const spendLabel = money(spend) + (ix === SPEND.length - 1 ? "+" : "");
  const month = spend * (pct / 100) * EFFECT;

  return (
    <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-3xl border border-white/[.12] bg-white/[.06] p-[22px]">
      <span className="font-mk-mono text-xs tracking-[.06em] text-mk-lav-ink">WHAT IS BETTER ALLOCATION WORTH TO YOU?</span>
      <label htmlFor={`${id}-spend`} className="flex flex-col gap-2">
        <span className="flex justify-between text-sm text-[#c9c6d8]">
          <span>Monthly ad spend</span>
          <span className="font-semibold tabular-nums text-white">{spendLabel}</span>
        </span>
        <input
          id={`${id}-spend`}
          type="range"
          min={0}
          max={SPEND.length - 1}
          step={1}
          value={ix}
          onChange={(e) => setIx(+e.target.value)}
          aria-valuetext={`${spendLabel} per month`}
          className="m-0 w-full"
        />
      </label>
      <div className="flex flex-col gap-2">
        <span id={`${id}-share`} className="text-sm text-[#c9c6d8]">
          If Advertix moves this share to better-performing platforms
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-share`} className="flex gap-1.5">
          {SHARES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={p === pct}
              onClick={() => setPct(p)}
              className={`h-[38px] flex-1 rounded-full border text-sm font-semibold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                p === pct ? "border-white bg-white/[.14]" : "border-white/20 hover:bg-white/[.06]"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-0.5 border-t border-white/[.12] pt-3.5" aria-live="polite">
        <span className="text-[13px] text-mk-on-dark2">Budget put to better use</span>
        <span className="text-[clamp(30px,3.6vw,42px)] font-semibold tabular-nums tracking-[-0.04em]">
          {money(month)}{" "}
          <span className="text-[15px] font-medium tracking-normal text-mk-on-dark2">/ month</span>
        </span>
        <span className="text-[13px] text-mk-on-dark2">{money(month * 12)} a year · simple arithmetic, not a promise</span>
      </div>
    </div>
  );
}
