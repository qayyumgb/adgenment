import type { Metadata } from "next";
import { AccentHeading, Accent, Eyebrow, HeroTitle } from "@/components/marketing/ui/Heading";
import { CtaBand } from "@/components/marketing/ui/CtaBand";
import { PillButton } from "@/components/marketing/ui/PillButton";
import { RolesExplorer } from "@/components/marketing/about/RolesExplorer";
import { DEMO_HREF } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why Advertix exists: give every advertiser a senior media buyer in their pocket, so great campaigns aren’t gated by team size.",
};

const H2_SM = "!text-[clamp(34px,5vw,64px)]";

const VALUES = [
  { t: "Decisions, not dashboards", b: "If a screen doesn’t help someone decide what to do next, it doesn’t ship." },
  { t: "Show the numbers", b: "Every suggestion carries the data behind it. No black boxes, no “trust us”." },
  { t: "Ask before spending", b: "AI touching real budgets earns autonomy through history, guardrails and undo." },
  { t: "Your data stays yours", b: "Encrypted tokens, no model training on your accounts, one-click disconnect." },
];

// TODO(copy): confirm dates — the previous About page said the project
// started in May 2026 (docs/MARKETING_REDESIGN_PLAN.md § 2, item 8).
const TIMELINE: { d: string; t: string; b: string; kind?: "now" | "next" }[] = [
  { d: "2025", t: "The first planner", b: "A prompt-to-plan prototype for Meta, built with a handful of founders." },
  { d: "Early 2026", t: "Four platforms, one workspace", b: "Google, TikTok and LinkedIn joined Meta: every campaign and result in one workspace." },
  { d: "Mid 2026", t: "Budget allocator and insights", b: "Cross-platform budget suggestions and AI insights went into beta." },
  { d: "Oct 2026", t: "Built for agencies", b: "Client switcher, roles, email alerts and the redesigned workspace.", kind: "now" },
  { d: "Next", t: "Approvals, auto-apply and client reports", b: "Then Snapchat and a white-label client portal for agencies.", kind: "next" },
];

export default function AboutPage() {
  return (
    <>
      <section className="mk-grid-bg border-b-2 border-mk-rule px-[clamp(16px,4vw,32px)] pb-[clamp(40px,6vw,72px)] pt-[clamp(48px,8vw,112px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
          <Eyebrow>ABOUT ADVERTIX</Eyebrow>
          <HeroTitle
            line1="Built so AI does the"
            line2="boring parts of running ads."
            className="max-w-[1100px] text-[clamp(44px,8.4vw,108px)] !leading-[.94]"
          />
        </div>
      </section>

      <section className="px-[clamp(16px,4vw,32px)] py-[clamp(56px,8vw,104px)]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 min-[900px]:grid-cols-2">
          <div
            data-reveal="rise"
            className="flex min-h-[360px] flex-col gap-[18px] rounded-[28px] border border-mk-hair bg-mk-paper2 p-[clamp(24px,4vw,44px)]"
          >
            <Eyebrow>OUR MISSION</Eyebrow>
            <h2 className="m-0 text-[clamp(30px,3.8vw,48px)] font-medium leading-[1.02] tracking-[-0.045em]">
              Give every advertiser a senior media buyer <Accent>in their pocket.</Accent>
            </h2>
            <p className="m-0 mt-auto text-[17px] text-mk-ink2">
              The best media buyers don’t guess — they pattern-match against thousands of campaigns. AI can do that too.
              Advertix bottles that intuition into a workspace anyone can use.
            </p>
          </div>
          <div
            data-reveal="rise"
            className="relative flex min-h-[360px] flex-col gap-[18px] overflow-hidden rounded-[28px] bg-mk-band p-[clamp(24px,4vw,44px)] text-mk-on-dark"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-[140px] -right-[120px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(124,100,255,.55),transparent_65%)]"
            />
            <span className="relative font-mk-mono text-xs tracking-[.06em] text-mk-lav">OUR VISION</span>
            <h2 className="relative m-0 text-[clamp(30px,3.8vw,48px)] font-medium leading-[1.02] tracking-[-0.045em]">
              A world where great campaigns aren’t gated by <Accent onDark>team size.</Accent>
            </h2>
            <p className="relative m-0 mt-auto text-[17px] text-[#b4b0c4]">
              You shouldn’t need a 12-person growth team to spend $50k a month well. Advertix exists so a one-person
              founder can compete with the people who do.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y-2 border-mk-rule bg-mk-s2 px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-[clamp(32px,5vw,64px)]">
          <div className="flex flex-[1_1_380px] flex-col gap-3.5">
            <Eyebrow>WHY WE BUILT IT</Eyebrow>
            <AccentHeading lead="Twelve roles." accent="One workspace." className={H2_SM} />
            <p data-reveal="up" className="m-0 max-w-[460px] text-mk-ink2">
              A well-run $50k-a-month account usually needs a team. Tap a role to see which part of Advertix covers it,
              and which part still needs a person.
            </p>
          </div>
          <RolesExplorer />
        </div>
      </section>

      <section className="px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,44px)]">
          <div className="flex flex-col gap-3">
            <Eyebrow>HOW WE BUILD</Eyebrow>
            <AccentHeading lead="Four rules" accent="we don’t break." className={H2_SM} />
          </div>
          <ol className="m-0 grid list-none grid-cols-1 border-t-2 border-mk-rule p-0 mk-sm:grid-cols-2 mk-xl:grid-cols-4">
            {VALUES.map((v, i) => (
              <li key={v.t} data-reveal="rise" className="flex flex-col gap-2.5 border-b border-mk-hair py-6 pr-6">
                <span className="font-mk-serif text-[52px] leading-none text-mk-brand">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[21px] font-medium tracking-[-0.025em]">{v.t}</span>
                <span className="text-[15px] text-mk-ink2 [text-wrap:pretty]">{v.b}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t-2 border-mk-rule px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-[clamp(32px,5vw,64px)]">
          <div className="flex flex-[1_1_320px] flex-col gap-3">
            <Eyebrow>THE ROAD SO FAR</Eyebrow>
            <AccentHeading lead="From one planner" accent="to one workspace." className={H2_SM} />
          </div>
          <ol className="m-0 flex min-w-0 flex-[1.4_1_480px] list-none flex-col border-t-2 border-mk-rule p-0">
            {TIMELINE.map((t) => (
              <li key={t.d} data-reveal="rise" className="grid grid-cols-[110px_minmax(0,1fr)] gap-[18px] border-b border-mk-hair py-[22px]">
                <span
                  className={`pt-[3px] font-mk-mono text-[13px] ${
                    t.kind === "now" ? "text-mk-brand" : t.kind === "next" ? "text-mk-ink3" : "text-mk-ink2"
                  }`}
                >
                  {t.d}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[19px] font-medium tracking-[-0.02em]">{t.t}</span>
                  <span className="text-[15px] text-mk-ink2">{t.b}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="pt-[clamp(12px,3vw,24px)]">
        <CtaBand lead="We’re small, and we" accent="read every message.">
          <PillButton href="/contact" variant="white" className="px-[26px]">
            Talk to us
          </PillButton>
          <PillButton href={DEMO_HREF} variant="ghost-dark">
            Book a demo
          </PillButton>
        </CtaBand>
      </div>
    </>
  );
}
