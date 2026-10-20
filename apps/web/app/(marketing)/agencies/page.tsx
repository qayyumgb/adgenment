import type { Metadata } from "next";
import { AccentHeading, Eyebrow, HeroTitle } from "@/components/marketing/ui/Heading";
import { CtaBand } from "@/components/marketing/ui/CtaBand";
import { PillButton } from "@/components/marketing/ui/PillButton";
import { ClientBook } from "@/components/marketing/agencies/ClientBook";
import { HoursCalculator } from "@/components/marketing/agencies/HoursCalculator";
import { AutonomyCards } from "@/components/marketing/agencies/AutonomyCards";
import { PortalPreview } from "@/components/marketing/agencies/PortalPreview";
import { DEMO_HREF } from "@/lib/marketing/nav";
import { planByName } from "@/lib/marketing/pricing";

export const metadata: Metadata = {
  title: "For agencies",
  description:
    "Twenty clients, one morning. Per-client caps and AI autonomy, white-label client reports and one briefing across every client and platform.",
};

const H2_SM = "!text-[clamp(34px,5vw,64px)]";

const PILLARS = [
  { t: "Client switcher everywhere", b: "Every page filters by client. Jump between clients with ⌘K in two keystrokes." },
  { t: "Monthly caps and pacing", b: "Set each client’s budget once. Advertix warns days before anyone overspends or underspends." },
  { t: "Approvals and history", b: "Changes above a guardrail wait for sign-off. Every change records who or what made it, and why." },
  { t: "Roles that fit agencies", b: "Buyers see their clients, analysts view everything, client viewers see only their own account." },
  { t: "Free client seats", b: "Invite every client stakeholder at no extra cost on the Agency plan." },
  { t: "Reports on autopilot", b: "Weekly PDFs per client with KPIs, top ads and a summary your team edits before it sends." },
];

const ONBOARD = [
  { t: "0:00", h: "Connect three clients", b: "OAuth for each platform; assign accounts to clients together." },
  { t: "0:10", h: "Set caps and autonomy", b: "One monthly budget per client and an AI level for each." },
  { t: "0:20", h: "Invite your team", b: "Buyers, analysts and client viewers with the right access." },
  { t: "Next day", h: "First briefing at 08:00", b: "Three decisions across all three clients, ready with your coffee." },
];

export default function AgenciesPage() {
  const agency = planByName("Agency");

  return (
    <>
      <section className="border-b-2 border-mk-rule px-[clamp(16px,4vw,32px)] pb-[clamp(40px,6vw,72px)] pt-[clamp(48px,8vw,104px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-[clamp(32px,5vw,64px)]">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
            {/* TODO(copy): "5 to 50 clients" vs the Agency plan's 10-client limit — confirm (plan § 2, item 8). */}
            <Eyebrow>FOR AGENCIES · 5 TO 50 CLIENTS</Eyebrow>
            <HeroTitle line1="Twenty clients." line2="One morning." className="text-[clamp(46px,8.6vw,108px)]" />
            <p data-reveal="up" className="m-0 max-w-[520px] text-[clamp(16px,1.6vw,18px)] text-mk-ink2">
              One briefing across every client and platform, a monthly cap per client, AI autonomy set per client, and
              reports that send themselves. Your team spends its week on strategy instead of spreadsheets.
            </p>
            <div data-reveal="up" className="flex flex-wrap gap-2.5">
              <PillButton href={DEMO_HREF} variant="ink" className="px-[26px]">
                Book an agency demo
              </PillButton>
              <PillButton href="/pricing" variant="outline-soft">
                Agency plan · ${agency.monthly}/mo
              </PillButton>
            </div>
          </div>
          <ClientBook />
        </div>
      </section>

      <HoursCalculator />

      <section className="border-y-2 border-mk-rule bg-mk-s2 px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-[clamp(32px,5vw,64px)]">
          <div className="flex flex-[1_1_380px] flex-col gap-3.5">
            <Eyebrow>AUTONOMY, PER CLIENT</Eyebrow>
            <AccentHeading lead="Your cautious client" accent="and your hands-off one." className={H2_SM} />
            <p data-reveal="up" className="m-0 max-w-[460px] text-mk-ink2">
              A regulated fintech can stay on suggest-only while a DTC brand runs on autopilot inside a 15% daily limit.
              Change it any time; every action stays logged and reversible.
            </p>
          </div>
          <AutonomyCards />
        </div>
      </section>

      <PortalPreview />

      <section className="border-t-2 border-mk-rule px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,44px)]">
          <div className="flex max-w-[820px] flex-col gap-3">
            <Eyebrow>BUILT FOR HOW AGENCIES WORK</Eyebrow>
            <AccentHeading lead="Roles, caps and approvals" accent="out of the box." className={H2_SM} />
          </div>
          <div className="grid grid-cols-1 border-t-2 border-mk-rule mk-sm:grid-cols-2 mk-xl:grid-cols-3">
            {PILLARS.map((p, i) => (
              <div key={p.t} data-reveal="rise" className="flex flex-col gap-2.5 border-b border-mk-hair py-6 pr-6">
                <span className="font-mk-mono text-xs text-mk-ink3">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[21px] font-medium tracking-[-0.025em]">{p.t}</span>
                <span className="text-[15px] text-mk-ink2 [text-wrap:pretty]">{p.b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y-2 border-mk-rule bg-mk-s2 px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-[clamp(32px,5vw,64px)]">
          <div className="flex flex-[1_1_360px] flex-col gap-3.5">
            <Eyebrow>ONBOARDING</Eyebrow>
            <AccentHeading lead="Bring three clients." accent="We set them up with you." className={H2_SM} />
            <p data-reveal="up" className="m-0 max-w-[440px] text-mk-ink2">
              One 30-minute call. By the end, three clients are connected, capped and briefed, and the rest of your book
              takes an afternoon.
            </p>
          </div>
          <ol className="m-0 flex min-w-0 flex-[1.2_1_460px] list-none flex-col border-t-2 border-mk-rule p-0">
            {ONBOARD.map((o) => (
              <li key={o.t} data-reveal="rise" className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 border-b border-mk-hair py-5">
                <span className="pt-[3px] font-mk-mono text-[13px] text-mk-brand-ink">{o.t}</span>
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-medium tracking-[-0.02em]">{o.h}</span>
                  <span className="text-[14.5px] text-mk-ink2">{o.b}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="pt-[clamp(12px,3vw,24px)]">
        <CtaBand lead="Get your Mondays" accent="back.">
          <PillButton href={DEMO_HREF} variant="white" className="px-[26px]">
            Book onboarding
          </PillButton>
          <PillButton href="/pricing" variant="ghost-dark">
            See agency pricing
          </PillButton>
        </CtaBand>
      </div>
    </>
  );
}
