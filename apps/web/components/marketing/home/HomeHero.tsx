"use client";

import { useCallback, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SegmentedControl } from "@/components/marketing/ui/SegmentedControl";
import { PlatformMark } from "@/components/marketing/ui/PlatformMark";
import {
  EVEN,
  MONTHLY_BUDGET,
  PLATFORM_ROWS,
  SCENARIOS,
  allocationBus,
  money,
  nextColor,
  type Scenario,
} from "./allocation";

gsap.registerPlugin(useGSAP);

type Mode = "even" | "adv";

// Flow paths fan out from the budget tile to each platform row.
const FLOW_Y = [32, 106, 180, 254, 328];
const FLOW_BASE = [
  { stroke: "#1877f2", opacity: 0.22, dash: "#6ea8ff", dur: 1.2 },
  { stroke: "#ea4335", opacity: 0.22, dash: "#ff7b6e", dur: 1.4 },
  { stroke: "#f4f2fa", opacity: 0.16, dash: "#ffffff", dur: 1 },
  { stroke: "#fffc00", opacity: 0.2, dash: "#fffc00", dur: 1.8 },
  { stroke: "#3d8fe0", opacity: 0.24, dash: "#7fb6ef", dur: 1.6 },
];
const flowPath = (y: number) => `M0 180 C210 180 190 ${y} 400 ${y}`;

const S0 = SCENARIOS[0];
const deltaText = (rev: number) => {
  const dv = rev - EVEN.rev;
  return dv < 1 ? "Baseline" : `+${money(dv)} (+${Math.round((dv / EVEN.rev) * 100)}%)`;
};

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function HomeHero() {
  const [mode, setMode] = useState<Mode>("adv");

  const secRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLParagraphElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<HTMLDivElement>(null);

  const pct = useRef<(HTMLSpanElement | null)[]>([]);
  const amt = useRef<(HTMLSpanElement | null)[]>([]);
  const next = useRef<(HTMLSpanElement | null)[]>([]);
  const bar = useRef<(HTMLSpanElement | null)[]>([]);
  const sw = useRef<(SVGPathElement | null)[]>([]);
  const sf = useRef<(SVGPathElement | null)[]>([]);
  const revEl = useRef<HTMLSpanElement>(null);
  const deltaEl = useRef<HTMLSpanElement>(null);
  const noteEls = useRef<(HTMLSpanElement | null)[]>([]);

  // Tweened values; written to the DOM directly (60fps, no React renders).
  const cur = useRef({ a: [...S0.a], n: [...S0.n], rev: S0.rev });
  const loop = useRef<gsap.core.Timeline | null>(null);

  const paint = useCallback(() => {
    const c = cur.current;
    for (let i = 0; i < 5; i++) {
      const a = c.a[i];
      const n = c.n[i];
      if (pct.current[i]) pct.current[i]!.textContent = `${Math.round(a)}%`;
      if (amt.current[i]) amt.current[i]!.textContent = money((a / 100) * MONTHLY_BUDGET);
      if (next.current[i]) {
        next.current[i]!.textContent = `$${n.toFixed(2)}`;
        next.current[i]!.style.color = nextColor(n);
      }
      if (bar.current[i]) bar.current[i]!.style.width = `${(a / 40) * 100}%`;
      sw.current[i]?.setAttribute("stroke-width", (a * 0.95).toFixed(1));
    }
    if (revEl.current) revEl.current.textContent = money(c.rev);
    if (deltaEl.current) {
      deltaEl.current.textContent = deltaText(c.rev);
      deltaEl.current.style.color = c.rev - EVEN.rev < 1 ? "#9c98ae" : "#41d39a";
    }
    allocationBus.emit(c.a);
  }, []);

  const { contextSafe } = useGSAP(
    () => {
      paint();
      if (!reducedMotion()) startMode("adv");

      // No scroll takeover (2026-11): the panel scrolls with the page. Its loop pauses while it's off screen.
      const eng = engRef.current;
      let io: IntersectionObserver | null = null;
      if (eng && typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver(([e]) => {
          if (e.isIntersecting) loop.current?.resume();
          else loop.current?.pause();
        });
        io.observe(eng);
      }

      return () => {
        io?.disconnect();
        loop.current?.kill();
        loop.current = null;
      };
    },
    { scope: secRef }
  );

  // Tween the engine to a scenario and swap the narration line.
  const go = contextSafe((st: Scenario) => {
    if (reducedMotion()) {
      cur.current = { a: [...st.a], n: [...st.n], rev: st.rev };
      paint();
      noteEls.current[0] && (noteEls.current[0].textContent = st.title);
      noteEls.current[1] && (noteEls.current[1].textContent = st.body);
      return;
    }
    gsap.to(cur.current.a, { endArray: st.a, duration: 1.5, ease: "power3.inOut", overwrite: true, onUpdate: paint });
    gsap.to(cur.current.n, { endArray: st.n, duration: 1.5, ease: "power3.inOut", overwrite: true });
    gsap.to(cur.current, { rev: st.rev, duration: 1.5, ease: "power3.inOut", overwrite: true });
    // Faster dashes where the next dollar earns more.
    st.n.forEach((n, i) => {
      const el = sf.current[i];
      if (el) el.style.animationDuration = `${Math.max(0.6, 2.6 - n * 0.5).toFixed(2)}s`;
    });
    const notes = noteEls.current.filter(Boolean);
    gsap
      .timeline()
      .to(notes, { autoAlpha: 0, y: -6, duration: 0.25, ease: "power2.in" })
      .add(() => {
        if (noteEls.current[0]) noteEls.current[0].textContent = st.title;
        if (noteEls.current[1]) noteEls.current[1].textContent = st.body;
      })
      .to(notes, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.05 });
  });

  function startMode(m: Mode) {
    loop.current?.kill();
    loop.current = null;
    if (m === "even") return go(EVEN);
    go(SCENARIOS[0]);
    if (reducedMotion()) return;
    const tl = gsap.timeline({ repeat: -1, delay: 3.2 });
    [1, 2, 0].forEach((k) => tl.add(() => go(SCENARIOS[k])).to({}, { duration: 4.4 }));
    loop.current = tl;
  }

  const onMode = contextSafe((m: Mode) => {
    setMode(m);
    startMode(m);
  });

  return (
    <section
      ref={secRef}
      id="engine"
      className="relative scroll-mt-20 bg-mk-paper px-[clamp(12px,3vw,32px)] pb-[clamp(48px,7vw,88px)] pt-[clamp(28px,4vw,48px)]"
    >
      <div className="relative mx-auto max-w-[1280px]">
        <div ref={wrapRef} className="relative z-[2]">
          <div
            ref={engRef}
            data-reveal="up"
            className="relative overflow-hidden rounded-[clamp(20px,3vw,32px)] bg-mk-band text-mk-on-dark shadow-[0_50px_100px_-50px_rgba(40,24,120,.6)]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[20%] top-[-40%] h-[80%] w-[60%] rounded-full bg-[radial-gradient(closest-side,rgba(124,100,255,.32),transparent)]"
            />
            <span aria-hidden="true" className="mk-dot-grid pointer-events-none absolute inset-0" />

            {/* Top bar */}
            <div className="relative flex flex-wrap items-center gap-x-[18px] gap-y-3 border-b border-white/[.08] px-[clamp(16px,2.6vw,28px)] py-4">
              <span className="inline-flex items-center gap-2 font-mk-mono text-xs tracking-[.06em]">
                <span className="relative h-[7px] w-[7px]" aria-hidden="true">
                  <span className="absolute inset-0 rounded-full bg-mk-pos-on-dark" />
                  <span className="absolute inset-0 animate-mk-ping rounded-full bg-mk-pos-on-dark" />
                </span>
                LIVE ALLOCATION
              </span>
              <span className="whitespace-nowrap text-[13px] text-mk-on-dark2">
                Halden &amp; Pike · $50,000 / month
              </span>
              <span className="flex-1" />
              <SegmentedControl
                label="Allocation mode"
                tone="dark"
                size="sm"
                value={mode}
                onChange={onMode}
                options={[
                  { value: "even", label: "Even split" },
                  { value: "adv", label: "Advertix" },
                ]}
              />
            </div>

            {/* Budget → flow → platform rows */}
            <div className="relative grid grid-cols-1 items-center gap-x-[clamp(12px,2vw,24px)] p-[clamp(16px,2.6vw,28px)] mk-md:grid-cols-[150px_minmax(0,1fr)_320px] mk-xl:grid-cols-[200px_minmax(0,1fr)_380px]">
              <div className="hidden flex-col gap-2.5 rounded-[20px] border border-mk-lav-ink/25 bg-[linear-gradient(160deg,rgba(138,63,252,.28),rgba(45,140,255,.14))] p-5 mk-md:flex">
                <span className="text-[13px] text-[#b9b4cc]">Monthly budget</span>
                <span className="text-[clamp(28px,2.8vw,36px)] font-semibold leading-none tracking-[-0.04em]">
                  $50,000
                </span>
                <span className="text-[12.5px] leading-[1.4] text-[#b9b4cc]">
                  One pool. Advertix shows which platform earns most from each dollar.
                </span>
              </div>
              <svg
                viewBox="0 0 400 360"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="hidden h-[360px] w-full overflow-visible mk-md:block"
              >
                {FLOW_BASE.map((f, i) => (
                  <path
                    key={`w${i}`}
                    ref={(el) => {
                      sw.current[i] = el;
                    }}
                    d={flowPath(FLOW_Y[i])}
                    fill="none"
                    stroke={f.stroke}
                    strokeOpacity={f.opacity}
                    strokeWidth={(S0.a[i] * 0.95).toFixed(1)}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {FLOW_BASE.map((f, i) => (
                  <path
                    key={`f${i}`}
                    ref={(el) => {
                      sf.current[i] = el;
                    }}
                    d={flowPath(FLOW_Y[i])}
                    fill="none"
                    stroke={f.dash}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray="1 15"
                    vectorEffect="non-scaling-stroke"
                    className="animate-mk-flow"
                    style={{ animationDuration: `${f.dur}s` }}
                  />
                ))}
              </svg>
              <div className="flex flex-col gap-2.5">
                {PLATFORM_ROWS.map((r, i) => (
                  <div
                    key={r.key}
                    className="grid h-16 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[.09] bg-white/[.05] px-3.5"
                  >
                    <PlatformMark p={r.key} size={34} onDark />
                    <span className="flex min-w-0 flex-col gap-[7px]">
                      <span className="flex min-w-0 items-baseline gap-2 text-sm">
                        <span className="font-semibold">{r.name}</span>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-mk-on-dark2">
                          next $ returns{" "}
                          <span
                            ref={(el) => {
                              next.current[i] = el;
                            }}
                            className="font-semibold"
                            style={{ color: nextColor(S0.n[i]) }}
                          >
                            ${S0.n[i].toFixed(2)}
                          </span>
                        </span>
                      </span>
                      <span className="h-1 overflow-hidden rounded-full bg-white/[.08]">
                        <span
                          ref={(el) => {
                            bar.current[i] = el;
                          }}
                          className="block h-full rounded-full"
                          style={{ background: r.bar, width: `${(S0.a[i] / 40) * 100}%` }}
                        />
                      </span>
                    </span>
                    <span className="flex flex-col items-end leading-[1.2] tabular-nums">
                      <span
                        ref={(el) => {
                          pct.current[i] = el;
                        }}
                        className="text-lg font-semibold"
                      >
                        {S0.a[i]}%
                      </span>
                      <span
                        ref={(el) => {
                          amt.current[i] = el;
                        }}
                        className="text-xs text-mk-on-dark2"
                      >
                        {money((S0.a[i] / 100) * MONTHLY_BUDGET)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals + narration */}
            <div className="relative grid grid-cols-1 gap-px border-t border-white/[.08] bg-white/[.08] mk-sm:grid-cols-2 mk-lg:grid-cols-[1fr_1fr_1.6fr]">
              <div className="flex flex-col gap-1 bg-mk-band px-[clamp(16px,2.6vw,28px)] py-[18px]">
                <span className="text-[12.5px] text-mk-on-dark2">Projected revenue / month</span>
                <span
                  ref={revEl}
                  aria-live="polite"
                  className="text-[clamp(26px,3vw,34px)] font-semibold tabular-nums tracking-[-0.04em]"
                >
                  {money(S0.rev)}
                </span>
              </div>
              <div className="flex flex-col gap-1 bg-mk-band px-[clamp(16px,2.6vw,28px)] py-[18px]">
                <span className="text-[12.5px] text-mk-on-dark2">Compared with an even split</span>
                <span
                  ref={deltaEl}
                  className="text-[clamp(26px,3vw,34px)] font-semibold tabular-nums tracking-[-0.04em] text-mk-pos-on-dark"
                >
                  {deltaText(S0.rev)}
                </span>
              </div>
              <div className="flex items-start gap-3 bg-mk-band px-[clamp(16px,2.6vw,28px)] py-[18px]">
                <span
                  aria-hidden="true"
                  className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] bg-[linear-gradient(115deg,#8a3ffc,#5d5cff_50%,#2d8cff)] text-[13px]"
                >
                  ✦
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    ref={(el) => {
                      noteEls.current[0] = el;
                    }}
                    className="text-[14.5px] font-semibold leading-[1.35]"
                  >
                    {S0.title}
                  </span>
                  <span
                    ref={(el) => {
                      noteEls.current[1] = el;
                    }}
                    className="text-[13px] leading-[1.4] text-mk-on-dark2"
                  >
                    {S0.body}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <p ref={capRef} className="mx-1 mb-0 mt-3.5 text-[12.5px] text-mk-ink3">
          Illustrative account (Snapchat is coming soon). Toggle “Even split” to see what the same budget earns
          without cross-platform allocation.
        </p>
      </div>
    </section>
  );
}
