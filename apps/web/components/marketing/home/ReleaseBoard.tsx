import { SectionHead } from "@/components/marketing/ui/Heading";

// The real roadmap, in build order (docs/DASHBOARD_REDESIGN_PLAN.md, Track C).
// Keep it in step with the plan; no dates or progress numbers we can't stand behind.
const ROAD: { t: string; s: string; c: string; items: { t: string; b: string; why: string }[] }[] = [
  {
    t: "Just shipped",
    s: "LIVE",
    c: "#41d39a",
    items: [
      { t: "Approvals and auto-apply", b: "Big changes wait for sign-off; small Meta budget moves inside your limit apply on their own, with undo.", why: "routine changes stop needing you" },
      { t: "Alerts inbox and safety rules", b: "Tracking and CPA problems grouped per campaign; pause when a pixel stops firing.", why: "a dead pixel overnight is the costliest bug" },
      { t: "Client reports", b: "A live link per client and scheduled email reports with an optional PDF.", why: "status updates stop eating Fridays" },
      { t: "Smart hours, experiments, creative editor", b: "Hour-by-hour results, A/B tests with a confidence level, and ads finished inside Advertix.", why: "fewer tools, faster decisions" },
    ],
  },
  {
    t: "Next up",
    s: "PLANNED",
    c: "#b9abff",
    items: [
      { t: "Shopify & GA4 revenue", b: "Your own revenue data instead of pixels.", why: "truer ROAS on long sales cycles" },
      { t: "Branded client reports", b: "Your logo on the client link and the email reports.", why: "your brand, not ours" },
      { t: "Slack alerts", b: "The alerts inbox in the channel your team already reads.", why: "problems seen sooner" },
    ],
  },
  {
    t: "Later",
    s: "IN DESIGN",
    c: "#8e8a9f",
    items: [
      { t: "Snapchat", b: "The fifth platform, in the same workspace.", why: "every channel in one view" },
      { t: "Publishing beyond Meta", b: "Launch and change campaigns on Google, TikTok and LinkedIn from Advertix.", why: "one place to act, not just to watch" },
      { t: "Autopilot", b: "Advertix runs budgets inside the monthly cap and your guardrails, with a daily summary.", why: "hands-off clients stay on track" },
    ],
  },
];

export function ReleaseBoard() {
  return (
    <section className="relative overflow-hidden bg-mk-band px-[clamp(16px,4vw,32px)] py-[clamp(72px,10vw,136px)] text-mk-on-dark">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[200px] -top-[200px] h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(124,100,255,.3),transparent)]"
      />
      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,48px)]">
        <SectionHead
          onDark
          eyebrow="ROADMAP"
          lead="Shipped, and"
          accent="what’s next."
          lede="What went live recently, and what we’re building next, in that order. What our users ask for moves up the list."
        />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-[clamp(20px,3vw,32px)]">
          {ROAD.map((col) => (
            <div key={col.t} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5 border-b border-white/[.14] pb-2.5">
                <span className="h-2 w-2 rounded-full" style={{ background: col.c }} aria-hidden="true" />
                <h3 className="m-0 text-base font-semibold">{col.t}</h3>
                <span className="font-mk-mono text-xs text-mk-on-dark3">{col.s}</span>
              </div>
              {col.items.map((it) => (
                <div
                  key={it.t}
                  data-reveal="rise"
                  className="flex flex-col gap-2.5 rounded-[20px] border border-white/[.09] bg-white/[.05] p-[18px]"
                >
                  <span className="text-lg font-semibold tracking-[-0.02em]">{it.t}</span>
                  <span className="text-sm text-mk-on-dark2 [text-wrap:pretty]">{it.b}</span>
                  <span className="text-[13px] text-[#d9d2ff]">
                    <span className="text-mk-on-dark3">Why it matters · </span>
                    {it.why}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
