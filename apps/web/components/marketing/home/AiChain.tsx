"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { SectionHead } from "@/components/marketing/ui/Heading";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const CLAUDE_TEXT =
  "Move $250/day from Google Generic Search to TikTok Spark Ads. TikTok’s next dollar earns 2.4× more, and Search costs 55% more after midnight.";

const NEVERS = [
  { t: "It never invents numbers.", b: "Every figure comes from your platform APIs." },
  { t: "It never trains on your data.", b: "Your accounts run your workspace, nothing else." },
  { t: "It never spends without you.", b: "Every change waits for a click, and can be undone for 7 days." },
];

const card = "flex flex-col gap-3.5 rounded-3xl p-[22px]";
const step = "text-xs font-semibold uppercase tracking-[.08em]";

export function AiChain() {
  const [approved, setApproved] = useState(false);
  const scope = useRef<HTMLElement>(null);
  const typeRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const te = typeRef.current;
      const chain = scope.current?.querySelector("[data-chain]");
      if (!te || !chain) return;
      const o = { n: 0 };
      te.textContent = "";
      gsap
        .timeline({ scrollTrigger: { trigger: chain, start: "top 75%", once: true } })
        .from("[data-link]", { y: 50, autoAlpha: 0, duration: 1, ease: "expo.out", stagger: 0.12 })
        .from("[data-code]", { x: -10, autoAlpha: 0, duration: 0.4, stagger: 0.25 }, 0.5)
        .to(
          o,
          {
            n: CLAUDE_TEXT.length,
            duration: 2.6,
            ease: "none",
            onUpdate: () => {
              te.textContent = CLAUDE_TEXT.slice(0, Math.round(o.n));
            },
          },
          1.6
        );
    },
    { scope }
  );

  return (
    <section id="ai" ref={scope} className="border-t-2 border-mk-rule bg-mk-s2 px-[clamp(16px,4vw,32px)] py-[clamp(72px,10vw,140px)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(32px,5vw,56px)]">
        <SectionHead
          eyebrow="HOW THE AI WORKS"
          lead="Maths finds it. Claude explains it."
          accent="You approve it."
          lede="The AI isn’t one black box. It’s three separate jobs, so the numbers can’t be invented and the decision stays yours."
        />
        <div data-chain className="grid grid-cols-1 items-stretch gap-3.5 mk-lg:grid-cols-3">
          <div data-link className={`${card} border border-mk-line bg-mk-paper2 shadow-mk-card`}>
            <span className={`${step} text-mk-ink3`}>1 · Statistical models</span>
            <span className="text-[21px] font-medium tracking-[-0.02em]">Find what changed</span>
            <div className="rounded-[14px] bg-mk-night p-3.5 font-mk-mono text-[13px] leading-[1.8] text-[#d9d4ff]">
              <div data-code>tiktok.next_dollar&nbsp;&nbsp;= $3.80</div>
              <div data-code>search.next_dollar&nbsp;&nbsp;= $1.58</div>
              <div data-code>search.night_cpa&nbsp;&nbsp;&nbsp;&nbsp;= +55%</div>
              <div data-code className="text-mk-pos-on-dark">
                → opportunity: +$3,100/wk
              </div>
            </div>
            <span className="mt-auto text-sm text-mk-ink2">
              Response curves, fatigue and anomaly detection run on your own platform data.
            </span>
          </div>

          <div data-link className={`${card} border border-mk-brand/20 bg-mk-soft`}>
            <span className={`${step} text-mk-brand-ink`}>2 · Claude</span>
            <span className="text-[21px] font-medium tracking-[-0.02em]">Explain it in plain English</span>
            <div className="min-h-[120px] rounded-[14px] bg-mk-paper2 p-4 text-[15px] leading-normal" aria-label={CLAUDE_TEXT}>
              <span ref={typeRef} aria-hidden="true">
                {CLAUDE_TEXT}
              </span>
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-[1em] w-0.5 animate-[mk-caret_1s_steps(1)_infinite] bg-mk-brand align-[-2px]"
              />
            </div>
            <span className="mt-auto text-sm text-mk-ink2">
              It writes the reason and the plan, and it cites the exact numbers it was given.
            </span>
          </div>

          <div data-link className={`${card} border border-mk-line bg-mk-paper2 shadow-mk-card`}>
            <span className={`${step} text-mk-ink3`}>3 · You</span>
            <span className="text-[21px] font-medium tracking-[-0.02em]">Decide what applies</span>
            <div className="flex flex-col gap-2.5 rounded-[14px] border border-mk-line p-3.5">
              <span className="flex justify-between text-[13px]">
                <span className="text-mk-ink3">Change size</span>
                <span className="font-semibold">12% of daily budget</span>
              </span>
              <span className="flex justify-between text-[13px]">
                <span className="text-mk-ink3">Undo</span>
                <span className="font-semibold">7 days</span>
              </span>
              <button
                type="button"
                aria-pressed={approved}
                onClick={() => setApproved((a) => !a)}
                className={`h-[42px] rounded-xl text-sm font-semibold text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
                  approved ? "bg-mk-pos" : "bg-mk-band hover:bg-mk-band/90"
                }`}
              >
                {approved ? "✓ Approved · applied at 06:00" : "Approve change"}
              </button>
            </div>
            <span className="mt-auto text-sm text-mk-ink2">
              Nothing applies until you approve it, and any change can be undone for 7 days. Coming soon: let small
              changes inside a guardrail you set apply on their own.
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-2.5">
          {NEVERS.map((n) => (
            <div
              key={n.t}
              data-reveal="up"
              className="flex items-start gap-3 rounded-[18px] border border-mk-line bg-mk-paper2 px-[18px] py-4"
            >
              <span
                aria-hidden="true"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-mk-soft text-xs font-bold text-mk-brand"
              >
                ✓
              </span>
              <span className="text-[15px]">
                <span className="font-semibold">{n.t}</span> <span className="text-mk-ink2">{n.b}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
