import type { Metadata } from "next";
import { AccentHeading, Eyebrow } from "@/components/marketing/ui/Heading";
import { CtaBand } from "@/components/marketing/ui/CtaBand";
import { FaqAccordion } from "@/components/marketing/ui/FaqAccordion";
import { PillButton } from "@/components/marketing/ui/PillButton";
import { PricingPlans } from "@/components/marketing/pricing/PricingPlans";
import { SIGN_UP_HREF } from "@/lib/marketing/nav";
import { PLANS } from "@/lib/marketing/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Flat monthly plans for founders, teams and agencies — not a cut of your ad spend. Free during beta, 30% off for beta workspaces after.",
};

const Y = "✓";
const N = "—";
const COMPARE: { t: string; rows: { l: string; c: string[] }[] }[] = [
  {
    t: "LIMITS",
    rows: [
      { l: "Brands or clients", c: ["1", "5", "10", "Unlimited"] },
      { l: "Managed spend / month", c: ["$25k", "$100k", "$250k", "Unlimited"] },
      { l: "Team seats", c: ["2", "5", "10", "Unlimited"] },
      { l: "Client viewer seats", c: [N, N, "Free", "Free"] },
    ],
  },
  {
    t: "AI",
    rows: [
      { l: "Planner and decision feed", c: [Y, Y, Y, Y] },
      { l: "Budget allocator", c: [Y, Y, Y, Y] },
      { l: "Smart hours · coming soon", c: [N, Y, Y, Y] },
      { l: "Experiments · coming soon", c: [N, Y, Y, Y] },
      { l: "Per-client autonomy · coming soon", c: [N, N, Y, Y] },
    ],
  },
  {
    t: "CONTROL & REPORTING",
    rows: [
      { l: "History and 7-day undo", c: [Y, Y, Y, Y] },
      { l: "Approvals and guardrails · coming soon", c: [N, Y, Y, Y] },
      { l: "White-label portal · coming soon", c: [N, N, Y, Y] },
      { l: "CSV and Excel export", c: [Y, Y, Y, Y] },
    ],
  },
];

const FAQS = [
  {
    q: "What counts as managed ad spend?",
    a: "Total spend across connected ad accounts in a calendar month. Going over never stops your ads; we suggest the next plan and you can stay put for a month.",
  },
  {
    q: "Is it really free during beta?",
    a: "Yes, every feature. We give 30 days’ notice before billing starts, and beta workspaces keep 30% off for their first year.",
  },
  {
    q: "Do you take a percentage of spend?",
    a: "No. You pay a flat monthly price. Platforms bill ad spend directly to your accounts.",
  },
  {
    q: "Can clients log in?",
    a: "On Agency and Enterprise, client viewer seats are free. Clients see only their own dashboards and data.",
  },
  {
    q: "Can I cancel any time?",
    a: "Monthly plans cancel at month end. Yearly plans can be refunded pro rata in the first 30 days.",
  },
];

function Cell({ v }: { v: string }) {
  if (v === Y)
    return (
      <span className="font-semibold text-mk-brand">
        <span aria-hidden="true">✓</span>
        <span className="sr-only">Included</span>
      </span>
    );
  if (v === N)
    return (
      <span className="text-mk-ink3">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not included</span>
      </span>
    );
  return <span className="font-semibold text-mk-ink">{v}</span>;
}

export default function PricingPage() {
  return (
    <>
      <PricingPlans />

      <section className="border-y-2 border-mk-rule bg-mk-s2 px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(24px,4vw,40px)]">
          <div className="flex flex-col gap-3">
            <Eyebrow>COMPARE</Eyebrow>
            <AccentHeading lead="Every plan," accent="line by line." className="!text-[clamp(34px,5vw,64px)]" />
          </div>
          {/* `relative` keeps the absolutely-positioned sr-only labels inside the scroller. */}
          <div className="relative overflow-x-auto border-t-2 border-mk-rule" tabIndex={0} aria-label="Plan comparison table">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-mk-hair font-semibold">
                  <td className="w-[34%] py-3.5" />
                  {PLANS.map((p) => (
                    <th key={p.name} scope="col" className={`py-3.5 font-semibold ${p.name === "Agency" ? "text-mk-brand-ink" : ""}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              {COMPARE.map((g) => (
                <tbody key={g.t}>
                  <tr>
                    <th
                      scope="colgroup"
                      colSpan={5}
                      className="pb-2 pt-[22px] font-mk-mono text-xs font-normal tracking-[.06em] text-mk-ink3"
                    >
                      {g.t}
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.l} className="border-b border-mk-hair text-[15px]">
                      <th scope="row" className="py-[13px] font-normal text-mk-ink2">
                        {r.l}
                      </th>
                      {r.c.map((v, j) => (
                        <td key={j} className="py-[13px]">
                          <Cell v={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </section>

      <section className="px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-[clamp(32px,5vw,64px)]">
          <div className="flex flex-[1_1_300px] flex-col gap-3">
            <Eyebrow>QUESTIONS</Eyebrow>
            <AccentHeading lead="Pricing," accent="plainly." className="!text-[clamp(34px,5vw,60px)]" />
          </div>
          <FaqAccordion items={FAQS} defaultOpen={0} className="min-w-0 flex-[2_1_480px]" />
        </div>
      </section>

      <div className="pt-[clamp(12px,3vw,24px)]">
        <CtaBand lead="Free while in beta." accent="30% off after.">
          <PillButton href={SIGN_UP_HREF} variant="white" className="px-[26px]">
            Start free
          </PillButton>
        </CtaBand>
      </div>
    </>
  );
}
