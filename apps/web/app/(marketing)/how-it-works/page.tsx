import type { Metadata } from "next";
import { Eyebrow, HeroTitle, SectionHead } from "@/components/marketing/ui/Heading";
import { CtaBand } from "@/components/marketing/ui/CtaBand";
import { PillButton } from "@/components/marketing/ui/PillButton";
import { StepsScroller } from "@/components/marketing/hiw/StepsScroller";
import { SetupChecklist } from "@/components/marketing/hiw/SetupChecklist";
import { SIGN_UP_HREF } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Connect once, decide in minutes. How Advertix reads your ad accounts, finds the decisions worth making and keeps you in control.",
};

const FACTS = [
  { v: "90 days", l: "of history, at most" },
  { v: "6 h", l: "between checks" },
  { v: "3", l: "decisions a day" },
  { v: "7 days", l: "to undo" },
];

const PIPE = [
  { n: "01", t: "Platform APIs", b: "Spend, conversions and delivery straight from each platform, synced every few hours or on demand.", ex: "meta.spend_7d = 14,260\ntiktok.cpa_7d = 14.20" },
  { n: "02", t: "Normalise", b: "Every platform mapped to one model: campaign, ad set, ad, client.", ex: "objective: purchase\nclient: fieldhouse" },
  { n: "03", t: "Models", b: "Response curves, fatigue and pacing today; anomaly alerts and significance tests next. Maths, not guesses.", ex: "marginal_roas(tiktok)\n= 3.80" },
  { n: "04", t: "Claude", b: "Turns signals into a plain-English decision and cites the numbers.", ex: "“next dollar earns\n2.4× more on TikTok”" },
  { n: "05", t: "You decide", b: "Every change waits for your click and can be undone for 7 days. Guardrails for automatic moves are coming.", ex: "apply → logged\nundo ≤ 7 days" },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="mk-grid-bg border-b-2 border-mk-rule px-[clamp(16px,4vw,32px)] pb-[clamp(40px,6vw,72px)] pt-[clamp(48px,8vw,104px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-x-16 gap-y-7">
          <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-[18px]">
            <Eyebrow>HOW IT WORKS</Eyebrow>
            <HeroTitle line1="Connect once." line2="Decide in minutes." />
          </div>
          <div className="flex max-w-[420px] flex-[1_1_320px] flex-col gap-[18px]">
            <p data-reveal="up" className="m-0 text-[clamp(16px,1.6vw,18px)] text-mk-ink2">
              Four steps between your ad accounts and a short list of decisions. Here is what happens at each one,
              what Advertix reads, and where you stay in charge.
            </p>
            <div data-reveal="up" className="grid grid-cols-4 border-t-2 border-mk-rule">
              {FACTS.map((f) => (
                <div key={f.v} className="flex flex-col pr-2 pt-3">
                  <span className="text-[clamp(20px,2.4vw,26px)] font-medium tracking-[-0.03em]">{f.v}</span>
                  <span className="text-xs leading-[1.35] text-mk-ink3">{f.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <StepsScroller />

      <section className="border-y-2 border-mk-rule bg-mk-s2 px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,48px)]">
          <SectionHead
            eyebrow="THE PIPELINE"
            lead="Where every number"
            accent="comes from."
            lede="Five stages, each one doing a single job. The language model never invents a number; it only explains numbers the stages before it produced."
          />
          <ol className="m-0 grid list-none grid-cols-1 border-t-2 border-mk-rule p-0 mk-sm:grid-cols-2 mk-xl:grid-cols-5">
            {PIPE.map((p) => (
              <li
                key={p.n}
                data-reveal="rise"
                className="relative flex flex-col gap-3 py-6 pr-5 mk-xl:border-r mk-xl:border-mk-hair mk-xl:last:border-r-0 mk-xl:[&:not(:first-child)]:pl-5"
              >
                <span className="font-mk-mono text-xs text-mk-ink3">{p.n}</span>
                <span className="text-[21px] font-medium tracking-[-0.025em]">{p.t}</span>
                <span className="text-[14.5px] text-mk-ink2 [text-wrap:pretty]">{p.b}</span>
                <span className="mt-auto whitespace-pre-line rounded-xl border border-mk-hair bg-mk-paper2 px-3 py-2.5 font-mk-mono text-xs leading-normal text-mk-ink">
                  {p.ex}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <SetupChecklist />

      <CtaBand lead="Connect one account." accent="See tomorrow’s briefing.">
        <PillButton href={SIGN_UP_HREF} variant="white" className="px-[26px]">
          Start free
        </PillButton>
        <PillButton href="/#ai" variant="ghost-dark">
          How the AI decides
        </PillButton>
      </CtaBand>
    </>
  );
}
