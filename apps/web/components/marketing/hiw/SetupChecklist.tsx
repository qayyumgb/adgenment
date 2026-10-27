"use client";

import { useState } from "react";
import { AccentHeading, Eyebrow } from "@/components/marketing/ui/Heading";

const SETUP = [
  { t: "Create your workspace", b: "Agency name, website and industry.", min: 2 },
  { t: "Connect ad accounts", b: "OAuth for each platform; pick the accounts you manage.", min: 5 },
  { t: "Assign accounts to clients", b: "Advertix suggests matches from account names.", min: 3 },
  { t: "Set monthly caps", b: "One number per client. Pacing starts immediately.", min: 4 },
  { t: "Review the first suggestions", b: "Advertix lists what it found after the first sync.", min: 2 },
  { t: "Invite your team", b: "Buyers, analysts and free client viewers.", min: 2 },
];

export function SetupChecklist() {
  const [done, setDone] = useState<Record<number, boolean>>({ 0: true, 1: true });

  const doneN = SETUP.filter((_, i) => done[i]).length;
  const pct = (doneN / SETUP.length) * 100;
  const left = SETUP.reduce((a, s, i) => a + (done[i] ? 0 : s.min), 0);

  return (
    <section className="px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap gap-[clamp(28px,5vw,64px)]">
        <div className="flex flex-[1_1_360px] flex-col gap-3.5">
          <Eyebrow>YOUR FIRST DAY</Eyebrow>
          <AccentHeading lead="Live by lunch." accent="First decisions the same day." />
          <p data-reveal="up" className="m-0 max-w-[440px] text-mk-ink2">
            Most agencies connect their accounts in one sitting. Tick through it to see how long each part takes.
          </p>
          <div
            data-reveal="up"
            aria-live="polite"
            className="mt-2 flex flex-col gap-2 rounded-[20px] bg-mk-band p-[18px] text-mk-on-dark"
          >
            <span className="font-mk-mono text-xs tracking-[.06em] text-mk-lav-ink">SETUP PROGRESS</span>
            <span className="text-[clamp(34px,4vw,48px)] font-medium tracking-[-0.04em]">{Math.round(pct)}%</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-[linear-gradient(115deg,#8a3ffc,#5d5cff_50%,#2d8cff)] transition-[width] duration-500 ease-[cubic-bezier(.2,.7,.2,1)]"
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-[13px] text-mk-on-dark2">
              {left
                ? `About ${left} minutes left · first suggestions follow the first sync`
                : "Done. Your first suggestions are waiting on the Overview."}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 flex-[1.3_1_460px] flex-col border-t-2 border-mk-rule">
          {SETUP.map((s, i) => {
            const on = !!done[i];
            return (
              <button
                key={s.t}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setDone((d) => ({ ...d, [i]: !on }))}
                className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3.5 border-b border-mk-hair py-[18px] text-left text-mk-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand"
              >
                <span
                  aria-hidden="true"
                  className={`mt-px flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] text-xs font-bold text-white transition-colors duration-[250ms] ${
                    on ? "border-mk-brand bg-mk-brand" : "border-mk-line2"
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={`text-base font-semibold ${on ? "text-mk-ink3 line-through" : ""}`}>{s.t}</span>
                  <span className="text-sm text-mk-ink2">{s.b}</span>
                </span>
                <span className="whitespace-nowrap pt-[3px] font-mk-mono text-xs text-mk-ink3">{s.min} min</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
