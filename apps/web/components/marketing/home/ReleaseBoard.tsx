import { SectionHead } from "@/components/marketing/ui/Heading";

// The real roadmap, in build order (docs/DASHBOARD_REDESIGN_PLAN.md, Track C).
// Keep it in step with the plan; no dates or progress numbers we can't stand behind.
const ROAD: { t: string; s: string; c: string; items: { t: string; b: string; why: string }[] }[] = [
  {
    t: "Next up",
    s: "IN PROGRESS",
    c: "#41d39a",
    items: [
      { t: "Command palette", b: "Any client, campaign or action in two keystrokes.", why: "speed with twenty accounts" },
      { t: "Approvals", b: "Big changes wait for sign-off; everything stays in the history with undo.", why: "a second pair of eyes on real budgets" },
      { t: "Morning briefing email", b: "The day’s top decisions across every client, before your first coffee.", why: "the morning check in one email" },
    ],
  },
  {
    t: "After that",
    s: "PLANNED",
    c: "#b9abff",
    items: [
      { t: "Auto-apply with guardrails", b: "Small budget moves inside a limit you set apply on their own, with undo.", why: "the routine changes stop needing you" },
      { t: "Safety rules", b: "Pause campaigns when a pixel stops firing; slow down before a client overspends.", why: "a dead pixel overnight is the costliest bug" },
      { t: "Alerts inbox", b: "CPA spikes and tracking problems, grouped per campaign, fixed from the alert.", why: "one problem, one alert" },
      { t: "Client portal & reports", b: "A live link per client and a weekly PDF with an AI summary you edit.", why: "status updates stop eating Fridays" },
    ],
  },
  {
    t: "Later",
    s: "IN DESIGN",
    c: "#8e8a9f",
    items: [
      { t: "Snapchat", b: "The fifth platform, in the same workspace.", why: "every channel in one view" },
      { t: "Smart hours", b: "Budgets follow the hours each client’s buyers buy.", why: "less wasted night spend" },
      { t: "Experiments", b: "Tests that call a winner with a confidence level.", why: "proof a client can see" },
      { t: "Shopify & GA4 revenue", b: "Your own revenue data instead of pixels.", why: "truer ROAS on long sales cycles" },
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
          lead="What we’re building"
          accent="next."
          lede="In the order we’re building it. What our users ask for moves up the list."
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
