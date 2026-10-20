import { AccentHeading, Eyebrow } from "@/components/marketing/ui/Heading";
import { PlatformMark, type PlatformKey } from "@/components/marketing/ui/PlatformMark";
import { AllocationBar } from "./AllocationBar";

const LANES: { p: PlatformKey; w: string; note: string }[] = [
  { p: "M", w: "72%", note: "optimizes Meta" },
  { p: "G", w: "58%", note: "optimizes Google" },
  { p: "T", w: "44%", note: "optimizes TikTok" },
  { p: "S", w: "22%", note: "optimizes Snap" },
  { p: "L", w: "30%", note: "optimizes LinkedIn" },
];
const LANE_COLOR: Record<PlatformKey, string> = {
  M: "#1877f2",
  G: "#ea4335",
  T: "#111",
  S: "#fffc00",
  L: "#0a66c2",
};

const FACTS = [
  { v: "Daily", l: "budget moves between platforms" },
  { v: "$3.80", l: "vs $1.58: the gap it found" },
  { v: "7 days", l: "to undo any move" },
];

export function ProblemSection() {
  return (
    <section className="border-t-2 border-mk-rule px-[clamp(16px,4vw,32px)] py-[clamp(72px,10vw,140px)]">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(32px,5vw,56px)]">
        <div className="flex flex-col gap-3">
          <Eyebrow>THE PROBLEM</Eyebrow>
          <AccentHeading
            lead="Every platform has AI."
            accent="None of them can see the others."
            className="max-w-[900px]"
          />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
          <div
            data-reveal="up"
            className="flex flex-col gap-[18px] rounded-[28px] border border-mk-line bg-mk-s2 p-[clamp(20px,3vw,32px)]"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-mk-ink3">Platform AI</span>
              <span className="text-[22px] font-medium tracking-[-0.02em]">Five optimizers, five separate goals</span>
            </div>
            {LANES.map((l) => (
              <div key={l.p} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3">
                <PlatformMark p={l.p} size={28} />
                <span className="relative h-2.5 rounded-full border border-dashed border-mk-line2 bg-white">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full opacity-45"
                    style={{ width: l.w, background: LANE_COLOR[l.p] }}
                  />
                </span>
                <span className="whitespace-nowrap text-[12.5px] text-mk-ink3">{l.note}</span>
              </div>
            ))}
            <span className="mt-auto text-[15px] text-mk-ink2">
              Each one spends its own budget as well as it can. None of them can move a dollar to a platform
              that would earn more.
            </span>
          </div>

          <div
            data-reveal="up"
            className="relative flex flex-col gap-[18px] overflow-hidden rounded-[28px] bg-mk-night p-[clamp(20px,3vw,32px)] text-[#f4f3fa]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-[140px] -right-[120px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(124,100,255,.45),transparent_65%)]"
            />
            <div className="relative flex flex-col gap-1">
              <span className="text-[13px] font-semibold text-mk-lav-ink">Advertix</span>
              <span className="text-[22px] font-medium tracking-[-0.02em]">One budget, sent where it earns most</span>
            </div>
            <AllocationBar />
            <div className="relative flex flex-wrap gap-x-[18px] gap-y-2 text-[13px] text-mk-on-dark2">
              <span>■ Meta</span>
              <span>■ Google</span>
              <span>■ TikTok</span>
              <span>■ Snapchat</span>
              <span>■ LinkedIn</span>
            </div>
            <div className="relative mt-auto grid grid-cols-3 gap-2">
              {FACTS.map((f) => (
                <div
                  key={f.v}
                  className="flex flex-col gap-0.5 rounded-2xl border border-white/10 bg-white/[.06] p-3.5"
                >
                  <span className="text-[clamp(20px,2.4vw,26px)] font-semibold tracking-[-0.03em]">{f.v}</span>
                  <span className="text-[12.5px] leading-[1.35] text-mk-on-dark2">{f.l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
