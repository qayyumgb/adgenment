import { SectionHead } from "@/components/marketing/ui/Heading";

// TODO(copy): the eyebrow says "updated weekly" — keep these items in sync
// with the real roadmap (docs/MARKETING_REDESIGN_PLAN.md § 2, item 8).
const ROAD: { t: string; s: string; c: string; items: { t: string; p: number; b: string; why: string }[] }[] = [
  {
    t: "Now",
    s: "ROLLING OUT",
    c: "#41d39a",
    items: [
      { t: "Snapchat, fully live", p: 92, b: "Story and Spotlight ads join the shared budget.", why: "the fifth platform in the pool" },
      { t: "Alerts inbox", p: 84, b: "Broken pixels and CPA spikes, fixed from the alert.", why: "a dead pixel overnight is the costliest bug" },
      { t: "Approvals & 7-day undo", p: 96, b: "Sign-off above your guardrail, full history.", why: "what makes automation safe to switch on" },
    ],
  },
  {
    t: "Next",
    s: "THIS QUARTER",
    c: "#b9abff",
    items: [
      { t: "Smart hours", p: 46, b: "Bids follow the hours each client’s buyers buy.", why: "cuts wasted night spend on Search" },
      { t: "Experiments", p: 38, b: "Tests that call a winner with a confidence level.", why: "proof a client can see" },
      { t: "Client portal", p: 31, b: "White-label live link plus a weekly AI summary.", why: "status updates stop eating Fridays" },
    ],
  },
  {
    t: "Later",
    s: "IN DESIGN",
    c: "#8e8a9f",
    items: [
      { t: "Command palette", p: 12, b: "Any client, campaign or action in two keystrokes.", why: "speed with twenty accounts" },
      { t: "Warehouse revenue", p: 8, b: "Your own revenue data instead of pixels.", why: "truer ROAS on long sales cycles" },
    ],
  },
];

export function ReleaseBoard() {
  return (
    <section className="relative overflow-hidden bg-mk-ink px-[clamp(16px,4vw,32px)] py-[clamp(72px,10vw,136px)] text-mk-on-dark">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[200px] -top-[200px] h-[640px] w-[640px] rounded-full bg-[radial-gradient(closest-side,rgba(124,100,255,.3),transparent)]"
      />
      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,48px)]">
        <SectionHead
          onDark
          eyebrow="RELEASE BOARD · UPDATED WEEKLY"
          lead="What’s being built"
          accent="right now."
          lede="Every item was requested by an agency in the beta. The bar shows how far along it is."
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
                  <div className="flex items-baseline justify-between gap-2.5">
                    <span className="text-lg font-semibold tracking-[-0.02em]">{it.t}</span>
                    <span className="font-mk-mono text-xs text-mk-on-dark2">{it.p}%</span>
                  </div>
                  <span className="text-sm text-mk-on-dark2 [text-wrap:pretty]">{it.b}</span>
                  <span
                    role="progressbar"
                    aria-valuenow={it.p}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${it.t} progress`}
                    className="h-1 overflow-hidden rounded-full bg-white/[.08]"
                  >
                    <span
                      data-reveal="grow"
                      className="block h-full rounded-full"
                      style={{ width: `${it.p}%`, background: col.c }}
                    />
                  </span>
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
