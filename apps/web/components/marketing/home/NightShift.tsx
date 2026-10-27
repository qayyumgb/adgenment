"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { AccentHeading, Eyebrow } from "@/components/marketing/ui/Heading";
import { PlatformMark, type PlatformKey } from "@/components/marketing/ui/PlatformMark";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Tag = "Synced" | "Found" | "Flagged" | "Proposed" | "Ready";
const TAG: Record<Tag, string> = {
  Found: "bg-mk-neg-soft text-mk-neg",
  Flagged: "bg-mk-soft text-mk-brand-ink",
  Proposed: "bg-mk-warn-soft text-mk-warn",
  Synced: "bg-mk-s3 text-mk-ink2",
  Ready: "bg-mk-ink text-mk-paper",
};

// What Advertix does today: it finds and proposes; you apply. `soon` names
// the automatic version that's coming (plan C12–C14).
const EVENTS: { time: string; tag: Tag; t: string; b: string; soon?: string; p: PlatformKey | "A"; client: string; v: string }[] = [
  { time: "00:12", tag: "Synced", t: "Read every account", b: "23 ad accounts across four platforms and 412 live ads, with the latest results refreshed.", p: "A", client: "All clients", v: "23 / 23" },
  { time: "02:14", tag: "Found", t: "Spotted a broken pixel", b: "Mara’s Meta pixel stopped firing. Pausing its two sales campaigns is waiting for you.", soon: "Safety rules pause them for you", p: "M", client: "Mara Home", v: "$85 at risk" },
  { time: "03:40", tag: "Flagged", t: "Caught creative fatigue", b: "Lumen’s best ad reached frequency 4.8. Fresh variants from the same hook are one click away in the Creative studio.", p: "M", client: "Lumen Skincare", v: "CTR −38%" },
  { time: "04:55", tag: "Proposed", t: "Flagged a pacing problem", b: "Kobo will run out of budget on the 26th. A lower daily budget is waiting for you.", p: "G", client: "Kobo Coffee", v: "5 days" },
  { time: "06:00", tag: "Proposed", t: "Found $310 a day for TikTok", b: "TikTok’s next dollar earns 2.4× more than Search. Moving it is one click.", soon: "Auto-apply makes moves inside your 15% limit on its own", p: "T", client: "Fieldhouse", v: "+$3.1k / wk" },
  { time: "07:00", tag: "Ready", t: "Your briefing is ready", b: "Three decisions, each with the numbers behind it, at the top of your Overview.", soon: "A morning briefing email", p: "A", client: "For Sara", v: "3 open" },
];

/** 00:00 → 07:00 across the scroll. */
const clockText = (p: number) => {
  const m = Math.round(Math.min(1, Math.max(0, p)) * 420);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function NightShift() {
  const secRef = useRef<HTMLElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLOListElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);

  const setClock = (p: number) => {
    if (clockRef.current) clockRef.current.textContent = clockText(p);
  };

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      // Desktop: pin the section and scrub the track sideways.
      mm.add("(min-width: 760px) and (prefers-reduced-motion: no-preference)", () => {
        const sec = secRef.current;
        const track = trackRef.current;
        if (!sec || !track) return;
        const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
        const len = () => Math.max(window.innerHeight * 0.8, dist() * 1.05);

        const horiz = gsap.to(track, {
          x: () => -dist(),
          ease: "none",
          force3D: true,
          scrollTrigger: {
            trigger: sec,
            pin: sec,
            start: "top top",
            end: () => `+=${len()}`,
            scrub: true,
            invalidateOnRefresh: true,
            onUpdate: (s) => setClock(s.progress),
          },
        });
        // Scroll deepens the section to the theme's second surface: an overlay in
        // that token (so it follows light / dark), faded in by opacity.
        gsap.to(shadeRef.current, {
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: sec, start: "top top", end: () => `+=${len()}`, scrub: true, invalidateOnRefresh: true },
        });
        gsap.utils.toArray<HTMLElement>("[data-ev]", sec).forEach((card) =>
          gsap.fromTo(
            card,
            { opacity: 0.35, scale: 0.94, y: 18 },
            {
              opacity: 1,
              scale: 1,
              y: 0,
              ease: "power2.out",
              scrollTrigger: { trigger: card, containerAnimation: horiz, start: "left 92%", end: "left 58%", scrub: true },
            }
          )
        );
      });
    },
    { scope: secRef }
  );

  // Mobile: native horizontal swipe drives the clock instead.
  const onScroll = () => {
    const w = wrapRef.current;
    if (!w || window.matchMedia("(min-width: 760px)").matches) return;
    const max = w.scrollWidth - w.clientWidth;
    setClock(max > 0 ? w.scrollLeft / max : 0);
  };

  return (
    <section
      ref={secRef}
      id="night"
      className="relative overflow-x-clip border-y-2 border-mk-rule bg-mk-paper"
    >
      <div ref={shadeRef} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-mk-s2 opacity-0" />
      <div className="relative flex flex-col justify-center gap-[clamp(24px,4vw,40px)] py-[clamp(56px,8vw,96px)] mk-md:min-h-[100svh]">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-end justify-between gap-x-12 gap-y-3 px-[clamp(16px,4vw,32px)]">
          <div className="flex flex-col gap-2.5">
            <Eyebrow>THE NIGHT SHIFT</Eyebrow>
            <AccentHeading lead="What Advertix found" accent="while you slept." />
          </div>
          <span
            ref={clockRef}
            aria-hidden="true"
            className="font-mk-mono text-[clamp(40px,6vw,76px)] font-medium tabular-nums tracking-[-0.04em]"
          >
            00:00
          </span>
        </div>
        <div
          ref={wrapRef}
          onScroll={onScroll}
          className="w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] mk-md:snap-none mk-md:overflow-visible"
        >
          <ol
            ref={trackRef}
            aria-label="Overnight activity, 00:12 to 07:00"
            className="m-0 flex w-max list-none gap-4 px-[clamp(16px,4vw,32px)] will-change-transform"
          >
            {EVENTS.map((e) => (
              <li
                key={e.time}
                data-ev
                className="flex w-[min(300px,78vw)] flex-none snap-start flex-col gap-3 rounded-md border border-mk-hair bg-mk-paper2 p-5 shadow-[0_20px_40px_-26px_rgba(40,30,80,.35)] mk-lg:w-[360px]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mk-mono text-[13px] font-medium">{e.time}</span>
                  <span className="h-px flex-1 bg-mk-hair" />
                  <span className={`rounded-full px-[9px] py-0.5 text-[11.5px] font-semibold ${TAG[e.tag]}`}>{e.tag}</span>
                </div>
                <span className="text-[clamp(18px,1.8vw,21px)] font-semibold leading-[1.25] tracking-[-0.02em]">{e.t}</span>
                <span className="text-[14.5px] text-mk-ink2 [text-wrap:pretty]">{e.b}</span>
                {e.soon && (
                  <span className="flex items-start gap-2 text-[13px] text-mk-ink2">
                    <span className="flex-none rounded-full bg-mk-soft px-2 py-px text-[11px] font-semibold text-mk-brand-ink">Coming soon</span>
                    <span className="[text-wrap:pretty]">{e.soon}</span>
                  </span>
                )}
                <div className="mt-auto flex items-center gap-2.5 border-t border-mk-hair pt-3">
                  {e.p === "A" ? (
                    <span
                      role="img"
                      aria-label="Advertix"
                      className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] bg-mk-brand text-[10px] font-bold text-white"
                    >
                      ✦
                    </span>
                  ) : (
                    <PlatformMark p={e.p} size={26} />
                  )}
                  <span className="min-w-0 flex-1 text-[13px] text-mk-ink2">{e.client}</span>
                  <span
                    className={`whitespace-nowrap font-mk-mono text-[12.5px] font-medium ${
                      e.v.startsWith("+") || e.v.startsWith("Saved") ? "text-mk-pos" : "text-mk-ink"
                    }`}
                  >
                    {e.v}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
