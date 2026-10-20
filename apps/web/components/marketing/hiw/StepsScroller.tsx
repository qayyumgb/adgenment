"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { PlatformMark, type PlatformKey } from "@/components/marketing/ui/PlatformMark";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const STEPS = [
  {
    n: "01",
    k: "CONNECT",
    t: "Connect every ad account",
    b: "Sign in to Meta, Google, TikTok, Snapchat and LinkedIn with their official OAuth. Advertix reads 90 days of history and keeps it in sync both ways, every hour.",
    tags: ["Official APIs", "90-day backfill", "Read + manage scopes"],
  },
  {
    n: "02",
    k: "READ",
    t: "It reads the patterns",
    b: "Every six hours, statistical models check spend, cost by hour, creative fatigue, audience overlap, pacing and tracking health across every platform at once.",
    tags: ["Response curves", "Fatigue detection", "Anomaly alerts"],
  },
  {
    n: "03",
    k: "DECIDE",
    t: "You get a short list",
    b: "Not forty charts. Claude turns the signals into two or three decisions a day, each with the numbers behind it, the expected impact and one button.",
    tags: ["Ranked by money at stake", "Cites its numbers", "Apply · snooze · undo"],
  },
  {
    n: "04",
    k: "CONTROL",
    t: "You stay in control",
    b: "Small moves inside your guardrail apply on their own. Bigger ones wait for approval. Every change, by a person or the AI, is logged and reversible for 7 days.",
    tags: ["Per-client autonomy", "Daily guardrail", "7-day undo"],
  },
];

const CONNS: { p: PlatformKey; n: string; a: string }[] = [
  { p: "M", n: "Meta", a: "9 accounts" },
  { p: "G", n: "Google Ads", a: "6 accounts" },
  { p: "T", n: "TikTok", a: "4 accounts" },
  { p: "L", n: "LinkedIn", a: "3 accounts" },
  { p: "S", n: "Snapchat", a: "1 account" },
];

// 7 days × 24 hours of cost-per-purchase, coloured by tier (mockup formula).
const HEAT = Array.from({ length: 168 }, (_, k) => {
  const d = Math.floor(k / 24);
  const h = k % 24;
  let v = h < 6 ? 1.55 : h < 9 ? 1.05 : h < 12 ? 0.74 : h < 18 ? 0.98 : h < 23 ? 0.66 : 1.2;
  if (d >= 5 && h >= 9 && h <= 13) v *= 0.82;
  return v < 0.75 ? "#8b73ff" : v < 0.95 ? "#5a48b8" : v < 1.3 ? "#2a2638" : "#7a2c33";
});

const CHECKS = [
  { l: "Spend vs plan, per client", v: "ON PACE", c: "#41d39a" },
  { l: "Cost per result by hour", v: "−$290/WK", c: "#ff8a8e" },
  { l: "Creative frequency", v: "1 FATIGUED", c: "#f2b44e" },
  { l: "Audience overlap", v: "38% · 1 PAIR", c: "#f2b44e" },
  { l: "Pixel and API health", v: "ALL FIRING", c: "#41d39a" },
  { l: "Next-dollar return", v: "TIKTOK $3.80", c: "#41d39a" },
];

const DECISIONS: { p: PlatformKey; t: string; why: string; v: string }[] = [
  { p: "G", t: "Shift $250/day to TikTok Spark Ads", why: "CPA $14.20 vs $26.80 on Generic Search", v: "+$3.1K/WK" },
  { p: "M", t: "Rotate out “UGC v3”", why: "Frequency 4.8 · CTR down 38%", v: "$460/DAY" },
  { p: "L", t: "Narrow to Director+ titles", why: "72% of qualified leads", v: "−$38 CPL" },
];

const HISTORY = [
  { w: "09:12", t: "Rotated out “UGC v3” · rule" },
  { w: "06:00", t: "Moved $310/day to TikTok · in guardrail" },
  { w: "TUE", t: "Raised Broad ad set · Sara" },
];

const tile = "rounded-2xl border border-white/[.09] bg-white/[.05]";

export function StepsScroller() {
  const [step, setStep] = useState(0);
  const [approved, setApproved] = useState(false);
  const secRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef(0);
  stepRef.current = step;

  // Desktop: pin the section and let scroll progress pick the step.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 960px) and (prefers-reduced-motion: no-preference)", () => {
        ScrollTrigger.create({
          trigger: secRef.current,
          start: "top top",
          end: "+=2200",
          pin: pinRef.current,
          scrub: true,
          anticipatePin: 1,
          onUpdate: (s) => {
            const i = Math.min(3, Math.floor(s.progress * 4));
            if (i !== stepRef.current) setStep(i);
          },
        });
      });
    },
    { scope: secRef }
  );

  // Fade the new pane's rows in on every step change.
  useEffect(() => {
    if (!paneRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(
      paneRef.current.children,
      { y: 16, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, duration: 0.6, ease: "power3.out", stagger: 0.05 }
    );
    return () => {
      tween.kill();
    };
  }, [step]);

  const cur = STEPS[step];

  return (
    <section ref={secRef} className="relative" aria-label="Four steps">
      <div
        ref={pinRef}
        className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-[clamp(28px,5vw,64px)] px-[clamp(16px,4vw,32px)] py-[clamp(48px,7vw,88px)] mk-lg:min-h-screen"
      >
        <div className="flex min-w-0 flex-[1_1_360px] flex-col">
          {STEPS.map((s, i) => {
            const on = i === step;
            return (
              <button
                key={s.n}
                type="button"
                aria-pressed={on}
                onClick={() => setStep(i)}
                className={`relative grid grid-cols-[56px_minmax(0,1fr)] gap-3.5 border-t-2 border-mk-rule py-[22px] text-left text-mk-ink transition-opacity duration-[450ms] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
                  on ? "opacity-100" : "opacity-50 hover:opacity-75"
                }`}
              >
                <span className="pt-1.5 font-mk-mono text-[13px] text-mk-brand-ink">{s.n}</span>
                <span className="flex flex-col gap-2">
                  <span className="text-[clamp(22px,2.6vw,30px)] font-medium leading-[1.1] tracking-[-0.035em]">{s.t}</span>
                  <span className="text-[15.5px] text-mk-ink2 [text-wrap:pretty]">{s.b}</span>
                  {on && (
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {s.tags.map((g) => (
                        <span key={g} className="whitespace-nowrap rounded-full bg-mk-soft px-[9px] py-[3px] font-mk-mono text-[11.5px] text-mk-brand-ink">
                          {g}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 left-0 h-0.5 w-full origin-left bg-[linear-gradient(115deg,#8a3ffc,#5d5cff_50%,#2d8cff)] transition-transform duration-500 ease-[cubic-bezier(.2,.7,.2,1)]"
                  style={{ transform: `scaleX(${i <= step ? 1 : 0})` }}
                />
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-[1.15_1_460px]">
          <div
            aria-live="polite"
            className="relative min-h-[clamp(420px,46vw,540px)] overflow-hidden rounded-[28px] bg-mk-ink p-[clamp(18px,3vw,28px)] text-mk-on-dark shadow-[0_50px_100px_-50px_rgba(40,24,120,.6)]"
          >
            <span aria-hidden="true" className="mk-dot-grid absolute inset-0" />
            <div className="relative mb-[18px] flex items-center gap-2.5 font-mk-mono text-xs tracking-[.06em] text-mk-lav-ink">
              <span className="h-[7px] w-[7px] rounded-full bg-mk-pos-on-dark" aria-hidden="true" />
              STEP {cur.n} · {cur.k}
            </div>

            {step === 0 && (
              <div ref={paneRef} className="relative flex flex-col gap-2.5">
                {CONNS.map((c) => (
                  <div key={c.n} className={`grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 ${tile}`}>
                    <PlatformMark p={c.p} size={36} onDark />
                    <span className="flex min-w-0 flex-col gap-[7px]">
                      <span className="text-sm font-semibold">
                        {c.n} <span className="font-normal text-mk-on-dark2">· {c.a}</span>
                      </span>
                      <span className="h-1 overflow-hidden rounded-full bg-white/[.08]">
                        <span className="block h-full w-full rounded-full bg-[linear-gradient(115deg,#8a3ffc,#5d5cff_50%,#2d8cff)]" />
                      </span>
                    </span>
                    <span className="font-mk-mono text-xs text-mk-pos-on-dark">OAUTH ✓</span>
                  </div>
                ))}
                <span className="mt-1.5 text-[13px] text-mk-on-dark2">
                  Read 90 days of history · tokens encrypted with AES-256 · nothing changes on your accounts
                </span>
              </div>
            )}

            {step === 1 && (
              <div ref={paneRef} className="relative flex flex-col gap-3">
                <div className={`flex flex-col gap-2.5 p-3.5 ${tile}`}>
                  <span className="text-[12.5px] text-mk-on-dark2">Cost per purchase by hour · Fieldhouse · 45 days</span>
                  <div className="grid grid-cols-[repeat(24,minmax(0,1fr))] gap-0.5" aria-hidden="true">
                    {HEAT.map((c, k) => (
                      <span key={k} className="aspect-square rounded-sm" style={{ background: c }} />
                    ))}
                  </div>
                  <div className="flex justify-between font-mk-mono text-[11px] text-mk-on-dark3" aria-hidden="true">
                    <span>00</span>
                    <span>06</span>
                    <span>12</span>
                    <span>18</span>
                    <span>23</span>
                  </div>
                </div>
                {CHECKS.map((c) => (
                  <div key={c.l} className="flex items-center gap-2.5 text-sm">
                    <span
                      aria-hidden="true"
                      className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-[rgba(65,211,154,.16)] text-[10px] font-bold text-mk-pos-on-dark"
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">{c.l}</span>
                    <span className="whitespace-nowrap font-mk-mono text-xs" style={{ color: c.c }}>
                      {c.v}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div ref={paneRef} className="relative flex flex-col gap-2.5">
                {DECISIONS.map((d) => (
                  <div key={d.t} className={`flex gap-3 p-3.5 ${tile}`}>
                    <PlatformMark p={d.p} size={34} onDark />
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="text-[14.5px] font-semibold leading-[1.35]">{d.t}</span>
                      <span className="text-[13px] text-mk-on-dark2">{d.why}</span>
                    </span>
                    <span className="whitespace-nowrap font-mk-mono text-[12.5px] text-mk-pos-on-dark">{d.v}</span>
                  </div>
                ))}
                <div className="rounded-2xl border border-mk-lav-ink/25 bg-[linear-gradient(135deg,rgba(138,63,252,.3),rgba(45,140,255,.16))] p-3.5 text-sm leading-normal">
                  <span className="font-mk-mono text-[11.5px] tracking-[.06em] text-[#d9d2ff]">CLAUDE · WHY THIS ORDER</span>
                  <br />
                  Fieldhouse first: it has the most money at stake this week, and the TikTok move pays back within five days.
                </div>
              </div>
            )}

            {step === 3 && (
              <div ref={paneRef} className="relative flex flex-col gap-3">
                <div className="flex flex-col gap-3 rounded-[18px] bg-mk-paper2 p-4 text-mk-ink">
                  <span className="self-start whitespace-nowrap rounded-full bg-[#fff1dc] px-2.5 py-[3px] font-mk-mono text-[11.5px] text-mk-warn">
                    NEEDS APPROVAL · ABOVE 15%
                  </span>
                  <span className="text-base font-semibold">Raise Lumen’s TikTok budget</span>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className="rounded-xl bg-mk-s2 px-3 py-2.5">
                      <span className="block text-[11.5px] text-mk-ink3">Now</span>
                      <span className="font-semibold">$460/day</span>
                    </span>
                    <span className="text-mk-ink3" aria-hidden="true">
                      →
                    </span>
                    <span className="rounded-xl bg-mk-soft px-3 py-2.5 shadow-[inset_0_0_0_1.5px_#6448f2]">
                      <span className="block text-[11.5px] text-mk-brand-ink">Proposed</span>
                      <span className="font-semibold">$620/day</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-pressed={approved}
                    onClick={() => setApproved((a) => !a)}
                    className={`h-10 self-start rounded-full px-[18px] font-semibold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
                      approved ? "bg-mk-pos" : "bg-mk-ink hover:bg-[#2a2733]"
                    }`}
                  >
                    {approved ? "✓ Approved · applies 06:00" : "Approve change"}
                  </button>
                </div>
                {HISTORY.map((h) => (
                  <div key={h.w} className="grid grid-cols-[60px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl bg-white/[.05] px-3.5 py-2.5 text-[13px]">
                    <span className="font-mk-mono text-mk-on-dark3">{h.w}</span>
                    <span className="min-w-0 truncate">{h.t}</span>
                    <span className="font-mk-mono text-[11.5px] text-mk-lav-ink">UNDO</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
