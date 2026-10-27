"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AccentHeading, Eyebrow } from "@/components/marketing/ui/Heading";

/**
 * Guided tour of the workspace. The mockup embedded the dashboard mockups
 * in iframes; until the redesigned dashboard ships we show screenshots of
 * those mockups (public/marketing/tour, 2× retina).
 *
 * TODO(dashboard-redesign): swap for real screenshots / recordings of the
 * shipped dashboard, then restore the mockup's "THE REAL WORKSPACE" copy.
 */

const TOUR = [
  {
    key: "overview",
    label: "Overview",
    head: "Your morning, on one screen",
    body: "Every client’s spend, revenue and pacing, with the two or three decisions worth making today at the top.",
    points: ["KPIs with trend sparklines", "Suggestions you apply, snooze or undo", "Client table with October pacing"],
  },
  {
    key: "campaigns",
    label: "Campaigns",
    head: "Every campaign, every platform",
    body: "One grid for Meta, Google, TikTok and LinkedIn, with Advertix’s suggestion next to each row.",
    points: ["Sort, columns and row height", "Pause or resume Meta with one toggle", "Bulk pause, resume and budgets"],
  },
  {
    key: "campaign-detail",
    label: "Campaign detail",
    head: "Why a campaign moved",
    body: "The daily chart marks every change, so you can see exactly what happened and when.",
    points: ["Change markers on the chart", "Ask a question in plain English", "Ad fatigue bars on every creative"],
  },
  {
    key: "budgets",
    label: "Budgets",
    head: "Drag a budget, see the result",
    body: "Sliders on each platform’s response curve show what the next dollar earns before you move it.",
    points: ["Recommended split marked", "Live revenue projection", "Monthly pacing per client"],
  },
  {
    key: "ai-planner",
    label: "AI Planner",
    head: "From a brief to a launch plan",
    body: "Describe the goal; Advertix shows its working, then returns campaigns, a budget split and a forecast.",
    points: ["Visible reasoning steps", "Refine in one click", "Created as paused drafts"],
  },
  {
    key: "creatives",
    label: "Creatives",
    head: "Variants from what already works",
    body: "Brief a format and tone; drafts reuse the hooks that convert for each client.",
    points: ["Fatigue caught early", "A shape for every placement", "Detail drawer with AI read"],
  },
];

const ADVANCE_MS = 9000;
const src = (key: string, v: "desktop" | "mobile") => `/marketing/tour/${key}-${v}.webp`;

export function LiveTour() {
  const [tab, setTab] = useState(0);
  const [auto, setAuto] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const secRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = secRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = auto && inView && loaded;
  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => {
      setLoaded(false);
      setTab((x) => (x + 1) % TOUR.length);
    }, ADVANCE_MS);
    return () => clearTimeout(t);
  }, [running, tab]);

  const pick = (i: number) => {
    setAuto(false);
    if (i !== tab) {
      setLoaded(false);
      setTab(i);
    }
  };

  const T = TOUR[tab];
  const url = `app.advertix.io/${T.label.toLowerCase().replace(/ /g, "-")}`;
  const onLoad = () => setTimeout(() => setLoaded(true), 350);

  return (
    <section
      ref={secRef}
      id="tour"
      className="border-t-2 border-mk-rule px-[clamp(12px,3vw,32px)] py-[clamp(56px,8vw,112px)]"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(24px,3.6vw,40px)]">
        <div className="flex flex-wrap items-end justify-between gap-x-14 gap-y-4 px-[clamp(4px,1vw,0px)]">
          <div className="flex flex-[1_1_520px] flex-col gap-3">
            <Eyebrow>THE WORKSPACE · A GUIDED TOUR</Eyebrow>
            <AccentHeading lead="Take the tour." accent="Screen by screen." accentTone="ink" />
          </div>
          <p data-reveal="up" className="m-0 max-w-[420px] flex-[1_1_300px] text-mk-ink2">
            The Advertix interface on an example agency, Halden &amp; Pike: six clients and a month of example
            data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Workspace screens"
            className="flex flex-1 gap-1.5 overflow-x-auto px-[clamp(4px,1vw,0px)] pb-0.5 [-webkit-mask-image:linear-gradient(90deg,#000_88%,transparent)] [mask-image:linear-gradient(90deg,#000_88%,transparent)] [scrollbar-width:none]"
          >
            {TOUR.map((t, i) => {
              const on = i === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  id={`tour-tab-${t.key}`}
                  aria-selected={on}
                  aria-controls="tour-panel"
                  onClick={() => pick(i)}
                  className={`relative h-11 flex-none overflow-hidden whitespace-nowrap rounded-full border-[1.5px] px-[18px] text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand ${
                    on ? "border-mk-ink bg-mk-ink text-mk-paper" : "border-mk-hair text-mk-ink2 hover:text-mk-ink"
                  }`}
                >
                  {t.label}
                  {on && (
                    <span className="absolute bottom-1.5 left-4 right-4 h-0.5 overflow-hidden rounded-sm bg-mk-paper/25">
                      <span
                        key={`${tab}-${running}`}
                        className={`block h-full origin-left bg-mk-paper ${running ? "animate-mk-tab" : "scale-x-0"}`}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setAuto((a) => !a)}
            aria-label={auto ? "Pause tour" : "Play tour"}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-[1.5px] border-mk-hair text-mk-ink2 hover:text-mk-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-brand"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {auto ? (
                <>
                  <rect x="5" y="4" width="5" height="16" rx="1" />
                  <rect x="14" y="4" width="5" height="16" rx="1" />
                </>
              ) : (
                <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
              )}
            </svg>
          </button>
        </div>

        <div
          id="tour-panel"
          role="tabpanel"
          aria-labelledby={`tour-tab-${T.key}`}
          className="flex flex-wrap items-center gap-[clamp(20px,3vw,40px)]"
        >
          <div className="flex min-w-0 flex-[3_1_640px] justify-center">
            {/* Desktop: browser frame */}
            <div className="hidden w-full rounded-[22px] border border-mk-hair bg-white/60 p-2 shadow-[0_50px_100px_-50px_rgba(40,24,120,.5)] mk-md:block">
              <div className="overflow-hidden rounded-2xl border border-mk-hair bg-mk-paper2">
                <div className="flex h-[38px] items-center gap-[7px] border-b border-mk-hair bg-mk-paper2 px-3.5">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-2.5 w-2.5 rounded-full bg-mk-s3" />
                  ))}
                  <span className="flex-1" />
                  <span className="rounded-[7px] bg-mk-s2 px-3 py-[3px] font-mk-mono text-xs text-mk-ink3">{url}</span>
                  <span className="flex-1" />
                  <span className="font-mk-mono text-[11px] text-mk-pos">● EXAMPLE DATA</span>
                </div>
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-mk-paper">
                  <Image
                    key={`d-${T.key}`}
                    src={src(T.key, "desktop")}
                    alt={`Advertix ${T.label} screen`}
                    fill
                    sizes="(min-width: 1280px) 900px, 70vw"
                    onLoad={onLoad}
                    className={`object-cover object-top transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                  />
                  {!loaded && <TourLoading label={T.label} />}
                </div>
              </div>
            </div>
            {/* Mobile: phone frame */}
            <div className="w-[min(340px,88vw)] rounded-[46px] border border-mk-hair bg-mk-band p-2.5 shadow-[0_50px_100px_-50px_rgba(40,24,120,.5)] mk-md:hidden">
              <div className="relative aspect-[390/800] w-full overflow-hidden rounded-[36px] bg-mk-paper">
                <Image
                  key={`m-${T.key}`}
                  src={src(T.key, "mobile")}
                  alt={`Advertix ${T.label} screen on mobile`}
                  fill
                  sizes="340px"
                  onLoad={onLoad}
                  className={`object-cover object-top transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
                />
                {!loaded && <TourLoading label={T.label} />}
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5" aria-live="polite">
            <span className="font-mk-mono text-xs tracking-[.06em] text-mk-ink3">
              {String(tab + 1).padStart(2, "0")} / {String(TOUR.length).padStart(2, "0")} · {T.label.toUpperCase()}
            </span>
            <span className="text-[clamp(24px,2.6vw,32px)] font-medium leading-[1.1] tracking-[-0.03em]">{T.head}</span>
            <span className="text-mk-ink2 [text-wrap:pretty]">{T.body}</span>
            <div className="flex flex-col border-t border-mk-hair">
              {T.points.map((p) => (
                <span key={p} className="flex gap-2.5 border-b border-mk-hair py-[11px] text-[14.5px]">
                  <span className="font-bold text-mk-brand" aria-hidden="true">
                    →
                  </span>
                  {p}
                </span>
              ))}
            </div>
            <a
              href={src(T.key, "desktop")}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start text-[14.5px] font-semibold text-mk-brand hover:text-mk-brand-ink"
            >
              Open full screen ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function TourLoading({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center font-mk-mono text-xs text-mk-ink3">
      Loading {label}…
    </div>
  );
}
