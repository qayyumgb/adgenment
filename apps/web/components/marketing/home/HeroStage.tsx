"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PillButton } from "@/components/marketing/ui/PillButton";
import { PLATFORMS, PlatformMark } from "@/components/marketing/ui/PlatformMark";
import { DEMO_HREF, SIGN_UP_HREF } from "@/lib/marketing/nav";

/**
 * Home hero (2026-11, "four dashboards → one workspace"). Text on the left;
 * on the right the story of Advertix plays as you scroll:
 *
 *   0 Connect  four platform dashboards, each counting results its own way
 *   1 Unify    they fly into one Advertix table with one set of numbers
 *   2 Decide   the AI reads every row and tags it
 *   3          a suggestion comes out, with the reason and the gain
 *   4 Approve  the cursor approves it; logged, undo for 7 days
 *
 * Desktop (≥ 960 px): the section is tall and the hero sticks while the page
 * scrolls; scroll position drives the story, smoothed with a lerp so it
 * glides. Only transforms and opacity change per frame (no layout).
 * Phones / tablets: no pinning; the story plays on a loop while on screen.
 * Reduced motion: the finished state, still.
 */

type Key = "M" | "G" | "T" | "L";
type Mode = "scroll" | "auto" | "still";

const KEYS: Key[] = ["M", "G", "T", "L"];
const ACCENT: Record<Key, string> = { M: "#1877f2", G: "#ea4335", T: "#25c9d0", L: "#0a66c2" };

// Each platform's own dashboard: its own words for a result.
const NATIVE: Record<Key, [string, string][]> = {
  M: [["Results", "412"], ["Cost per result", "$18.20"], ["Amount spent", "$7,498"]],
  G: [["Conversions", "286"], ["Cost / conv.", "$31.40"], ["Cost", "$8,980"]],
  T: [["Conversions", "190"], ["CPA", "$24.11"], ["Total cost", "$4,580"]],
  L: [["Leads", "38"], ["Cost per lead", "$96.05"], ["Spent", "$3,650"]],
};
const SPARK: Record<Key, string> = {
  M: "0,10 8,8 16,9 24,5 32,6 40,3",
  G: "0,4 8,6 16,5 24,8 32,9 40,10",
  T: "0,12 8,10 16,8 24,6 32,3 40,1",
  L: "0,7 8,8 16,6 24,7 32,6 40,7",
};

// The same accounts in Advertix: one set of numbers.
type Tone = "pos" | "neg" | "mid";
const ROWS: Record<Key, { spend: string; rev: string; roas: string; tag: string; tone: Tone; after?: string }> = {
  M: { spend: "$7,498", rev: "$20,300", roas: "2.71×", tag: "Steady", tone: "mid" },
  G: { spend: "$8,980", rev: "$18,400", roas: "2.05×", tag: "Saturating", tone: "neg", after: "−$3,000/mo" },
  T: { spend: "$4,580", rev: "$17,400", roas: "3.80×", tag: "Room to scale", tone: "pos", after: "+$3,000/mo" },
  L: { spend: "$3,650", rev: "$7,100", roas: "1.95×", tag: "Long cycle", tone: "mid" },
};

const STEPS = ["Connect", "Unify", "Decide", "Approve"];
const stageOf = (p: number) => (p < 0.3 ? 0 : p < 0.44 ? 1 : p < 0.56 ? 2 : p < 0.78 ? 3 : 4);
const stepOf = (st: number) => (st === 0 ? 0 : st === 1 ? 1 : st < 4 ? 2 : 3);

// Scene geometry in design pixels; the scene is scaled to fit its column.
function geometry(narrow: boolean) {
  const W = narrow ? 440 : 600;
  const H = 490;
  const card = { x: narrow ? 14 : 30, y: 22, w: narrow ? 412 : 540, h: 318 };
  const rowY = (i: number) => card.y + 92 + i * 54 + 23; // row centres
  const win = { w: narrow ? 196 : 250, h: 132 };
  const from = narrow
    ? [{ x: 112, y: 94, r: -7 }, { x: 330, y: 80, r: 6 }, { x: 118, y: 300, r: 5 }, { x: 326, y: 318, r: -5 }]
    : [{ x: 152, y: 100, r: -7 }, { x: 450, y: 84, r: 6 }, { x: 160, y: 330, r: 5 }, { x: 442, y: 350, r: -5 }];
  const sug = { x: narrow ? 14 : 150, y: 356, w: narrow ? 412 : 420, h: 120 };
  const approve = { x: sug.x + sug.w - 14 - 46, y: sug.y + sug.h - 14 - 15 };
  const caption = narrow ? 196 : 214;
  return { W, H, card, rowY, win, from, sug, approve, caption };
}

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Phones / tablets: the story on a loop (seconds → progress), rewinding at the end.
const LOOP: [number, number][] = [
  [0, 0], [1.6, 0], [3.4, 0.4], [4.6, 0.4], [5.2, 0.5], [6.6, 0.5], [7.1, 0.66], [8.8, 0.66],
  [9.3, 0.86], [12.6, 0.86], [14, 0], [14.4, 0],
];
const LOOP_LEN = LOOP[LOOP.length - 1][0];
function loopAt(t: number) {
  const x = t % LOOP_LEN;
  for (let i = 1; i < LOOP.length; i++) {
    const [t1, p1] = LOOP[i];
    const [t0, p0] = LOOP[i - 1];
    if (x <= t1) return lerp(p0, p1, ease((x - t0) / (t1 - t0 || 1)));
  }
  return 0;
}

export function HeroStage() {
  const [mode, setMode] = useState<Mode>("auto");
  const [narrow, setNarrow] = useState(false);
  const [stage, setStage] = useState(0);
  const [scale, setScale] = useState(1);
  const g = geometry(narrow);

  const secRef = useRef<HTMLElement>(null);
  const fitRef = useRef<HTMLDivElement>(null);
  const winRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const geoRef = useRef(g);
  geoRef.current = g;

  // Which way to drive the story.
  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const lg = window.matchMedia("(min-width: 960px)");
    const pick = () => setMode(rm.matches ? "still" : lg.matches ? "scroll" : "auto");
    pick();
    rm.addEventListener("change", pick);
    lg.addEventListener("change", pick);
    return () => {
      rm.removeEventListener("change", pick);
      lg.removeEventListener("change", pick);
    };
  }, []);

  // Scale the scene to its column.
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      const n = w < 520;
      setNarrow(n);
      setScale(w / geometry(n).W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Paint one frame of the story at progress p (transforms + opacity only).
  const paint = useRef((p: number) => {
    const G = geoRef.current;
    const a = ease(clamp((p - 0.04) / 0.32)); // scattered → unified
    winRefs.current.forEach((el, i) => {
      if (!el) return;
      const f = G.from[i];
      const x = lerp(f.x, G.W / 2, a) - G.win.w / 2;
      const y = lerp(f.y, G.rowY(i), a) - G.win.h / 2;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${lerp(f.r, 0, a)}deg) scale(${lerp(1, 0.42, a)})`;
      el.style.opacity = String(1 - clamp((a - 0.5) / 0.4));
      el.style.visibility = a > 0.95 ? "hidden" : "visible";
    });
    const c = clamp((a - 0.2) / 0.5);
    if (cardRef.current) {
      cardRef.current.style.opacity = String(c);
      cardRef.current.style.transform = `scale(${0.94 + 0.06 * c})`;
    }
    if (rowsRef.current) rowsRef.current.style.opacity = String(clamp((a - 0.6) / 0.4));
    if (capRef.current) capRef.current.style.opacity = String(1 - clamp(a * 2.5));
    if (barRef.current) barRef.current.style.transform = `scaleX(${clamp(p / 0.86)})`;
    if (hintRef.current) hintRef.current.style.opacity = String(1 - clamp(p * 12));
    setStage(stageOf(p));
  }).current;

  // Re-paint when the geometry changes (resize) without moving progress.
  const progress = useRef(0);
  useEffect(() => {
    paint(progress.current);
  }, [narrow, paint]);

  // Drive it.
  useEffect(() => {
    if (mode === "still") {
      progress.current = 1;
      paint(1);
      return;
    }

    let raf = 0;
    if (mode === "scroll") {
      let target = 0;
      let running = false;
      const read = () => {
        const sec = secRef.current;
        if (!sec) return 0;
        const r = sec.getBoundingClientRect();
        const travel = r.height - (window.innerHeight - 60);
        return travel > 0 ? clamp((60 - r.top) / travel) : 0;
      };
      const tick = () => {
        const cur = progress.current;
        const next = Math.abs(target - cur) < 0.0005 ? target : cur + (target - cur) * 0.12;
        progress.current = next;
        paint(next);
        if (next !== target) raf = requestAnimationFrame(tick);
        else running = false;
      };
      const onScroll = () => {
        target = read();
        if (!running) {
          running = true;
          raf = requestAnimationFrame(tick);
        }
      };
      progress.current = target = read();
      paint(target);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
      };
    }

    // auto: loop while on screen
    let visible = false;
    let t0 = 0;
    let elapsed = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now - elapsed * 1000;
      elapsed = (now - t0) / 1000;
      progress.current = loopAt(elapsed);
      paint(progress.current);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === visible) return;
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        t0 = 0;
        raf = requestAnimationFrame(tick);
      }
    }, { threshold: 0.2 });
    if (fitRef.current) io.observe(fitRef.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [mode, paint]);

  const step = stepOf(stage);
  const pinned = mode === "scroll";
  const abs = (x: number, y: number, w?: number, h?: number): CSSProperties => ({ position: "absolute", left: x, top: y, width: w, height: h });

  return (
    <section ref={secRef} className={`mk-grid-bg relative border-b-2 border-mk-rule bg-mk-paper ${pinned ? "h-[230vh]" : ""}`}>
      <div className={`overflow-clip px-[clamp(16px,4vw,32px)] ${pinned ? "sticky top-[60px] h-[calc(100svh_-_60px)]" : ""}`}>
        <span aria-hidden="true" className="pointer-events-none absolute right-[-10%] top-[8%] h-[720px] w-[min(1000px,110vw)] rounded-full bg-[radial-gradient(closest-side,rgba(124,100,255,.16),transparent)]" />

        <div className="relative mx-auto grid h-full max-w-[1280px] items-center gap-[clamp(28px,4vw,56px)] py-[clamp(32px,6vw,56px)] mk-lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] mk-lg:py-4">
          {/* Text */}
          <div className="flex flex-col items-start">
            <a
              data-reveal="up"
              href="/product"
              className="group inline-flex items-center gap-2 rounded-full border border-mk-hair bg-mk-paper2 py-1 pl-1 pr-3.5 text-[13px] text-mk-ink2 shadow-[0_1px_2px_rgba(20,16,40,.06)] transition-colors hover:text-mk-ink"
            >
              <span className="rounded-full bg-mk-brand px-2 py-0.5 text-[11.5px] font-semibold text-white">New</span>
              Creative editor with brand kits and templates
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </a>
            {/* Two lines exactly: each line is nowrap and the size keeps it inside the column. */}
            <h1 className="m-0 mt-5 whitespace-nowrap text-[clamp(34px,7vw,60px)] font-semibold leading-[1] tracking-[-0.05em] mk-lg:text-[clamp(38px,4.6vw,72px)]">
              <span className="-mb-[.1em] block overflow-hidden pb-[.1em]">
                <span data-reveal="line" className="inline-block">
                  One AI for every
                </span>
              </span>
              <span className="-mb-[.1em] block overflow-hidden pb-[.14em]">
                <span data-reveal="line" className="mk-grad-text inline-block pr-[.04em]">
                  ad platform.
                </span>
              </span>
            </h1>
            <p data-reveal="up" className="m-0 mt-5 max-w-[520px] text-[clamp(16px,1.4vw,18px)] leading-relaxed text-mk-ink2 [text-wrap:pretty]">
              Meta, Google, TikTok and LinkedIn each count results their own way. Advertix puts them in one view, finds
              where your next dollar earns most and suggests the move. You approve it, and any change can be undone for 7
              days.
            </p>
            <div data-reveal="up" className="mt-7 flex flex-wrap gap-2.5">
              <PillButton href={SIGN_UP_HREF} variant="brand" className="h-[52px] px-7">
                Start free trial
              </PillButton>
              <PillButton href={DEMO_HREF} variant="outline" className="h-[52px] px-7">
                Book a demo
              </PillButton>
            </div>
            <span data-reveal="up" className="mt-3 text-[13px] text-mk-ink3">
              14-day free trial · No card needed · Cancel any time
            </span>
          </div>

          {/* The story */}
          <div className="flex min-w-0 flex-col items-center gap-4">
            <div ref={fitRef} className="relative w-full mk-lg:w-[min(100%,calc((100svh_-_190px)_*_1.22))]" style={{ height: g.H * scale }} aria-hidden="true">
              <div className="absolute left-0 top-0 origin-top-left" style={{ width: g.W, height: g.H, transform: `scale(${scale})` }}>
                {/* Advertix workspace */}
                <div ref={cardRef} className="origin-center rounded-[20px] border border-mk-hair bg-mk-paper2 shadow-[0_40px_90px_-40px_rgba(40,24,120,.45)]" style={{ ...abs(g.card.x, g.card.y, g.card.w, g.card.h), opacity: 0 }}>
                  <div className="flex h-[54px] items-center gap-2.5 border-b border-mk-hair px-[18px]">
                    <Image src="/brand/advertix-icon.png" alt="" width={22} height={22} />
                    <span className="text-[14px] font-semibold text-mk-ink">All platforms</span>
                    <span className="text-[12.5px] text-mk-ink3">Last 30 days</span>
                    <span className="ml-auto flex items-baseline gap-2 text-[12.5px] text-mk-ink3">
                      ROAS <b className="text-[15px] font-semibold tabular-nums text-mk-ink">2.56×</b>
                      <span className={`font-semibold tabular-nums text-mk-pos transition-all duration-500 ${stage >= 4 ? "opacity-100" : "translate-y-1 opacity-0"}`}>+$4,800/mo</span>
                    </span>
                  </div>
                  <div ref={rowsRef} style={{ opacity: 0 }}>
                    <div className="flex h-[38px] items-center px-[18px] text-[11px] font-semibold uppercase tracking-[.08em] text-mk-ink3">
                      <span className="flex-1">Platform</span>
                      <span className="w-[76px] text-right">Spend</span>
                      {!narrow && <span className="w-[86px] text-right">Revenue</span>}
                      <span className="w-[64px] text-right">ROAS</span>
                      <span className={`${narrow ? "w-[118px]" : "w-[136px]"} text-right`}>Advertix</span>
                    </div>
                    {KEYS.map((k, i) => {
                      const r = ROWS[k];
                      const tagged = stage >= 2;
                      const moved = stage >= 4 && r.after;
                      const tone = moved ? (r.tone === "pos" ? "pos" : "neg") : r.tone;
                      return (
                        <div
                          key={k}
                          className={`mx-2 flex h-[46px] items-center rounded-xl px-[10px] text-[13.5px] transition-colors duration-500 ${
                            tagged && r.tone === "pos" ? "bg-mk-pos-soft/60" : ""
                          }`}
                          style={{ marginTop: i ? 8 : 0 }}
                        >
                          <span className="flex flex-1 items-center gap-2.5 font-semibold text-mk-ink">
                            <PlatformMark p={k} size={26} className="ring-1 ring-mk-line2" />
                            {PLATFORMS[k].name}
                          </span>
                          <span className="w-[76px] text-right tabular-nums text-mk-ink2">{r.spend}</span>
                          {!narrow && <span className="w-[86px] text-right tabular-nums text-mk-ink2">{r.rev}</span>}
                          <span className="w-[64px] text-right font-semibold tabular-nums text-mk-ink">{r.roas}</span>
                          <span className={`${narrow ? "w-[118px]" : "w-[136px]"} flex justify-end`}>
                            <span
                              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold transition-all duration-500 ${
                                tone === "pos" ? "bg-mk-pos-soft text-mk-pos" : tone === "neg" ? "bg-mk-neg-soft text-mk-neg" : "bg-mk-s2 text-mk-ink2"
                              } ${tagged ? "opacity-100" : "translate-x-2 opacity-0"}`}
                              style={{ transitionDelay: tagged && stage === 2 ? `${300 + i * 110}ms` : "0ms" }}
                            >
                              {moved ? r.after : r.tag}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* AI reading the rows */}
                  {stage === 2 && <span key="scan" className="adx-scan pointer-events-none absolute inset-x-2 top-[92px] h-[44px] rounded-xl" />}
                </div>

                {/* Before: four dashboards */}
                <div ref={capRef} className="absolute flex justify-center" style={{ left: 0, top: g.caption - 14, width: g.W }}>
                  <span className="rounded-full border border-mk-hair bg-mk-paper px-3.5 py-1.5 text-[12.5px] font-medium text-mk-ink2 shadow-[0_6px_20px_-12px_rgba(30,20,80,.35)]">
                    Every platform measures success differently
                  </span>
                </div>
                {KEYS.map((k, i) => (
                  <div
                    key={k}
                    ref={(el) => {
                      winRefs.current[i] = el;
                    }}
                    className="absolute left-0 top-0 origin-center will-change-transform"
                    style={{ width: g.win.w, height: g.win.h, transform: `translate3d(${g.from[i].x - g.win.w / 2}px, ${g.from[i].y - g.win.h / 2}px, 0) rotate(${g.from[i].r}deg)` }}
                  >
                    <div className={`h-full rounded-2xl border border-mk-hair bg-mk-paper2 p-3 shadow-[0_24px_50px_-26px_rgba(30,20,80,.5)]`}>
                      <div className="flex items-center gap-2">
                        <PlatformMark p={k} size={22} className="ring-1 ring-mk-line2" />
                        <span className="text-[13px] font-semibold text-mk-ink">{PLATFORMS[k].name}</span>
                        <svg viewBox="0 0 40 13" className="ml-auto h-[13px] w-[40px] overflow-visible">
                          <polyline points={SPARK[k]} fill="none" stroke={ACCENT[k]} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="mt-2.5 flex flex-col gap-[5px]">
                        {NATIVE[k].map(([l, v]) => (
                          <span key={l} className="flex items-baseline justify-between gap-2 border-t border-mk-hair pt-[5px] text-[12px]">
                            <span className="truncate text-mk-ink3">{l}</span>
                            <span className="font-semibold tabular-nums text-mk-ink">{v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {/* The suggestion */}
                <div
                  className={`rounded-2xl border bg-mk-paper2 p-3.5 shadow-[0_30px_60px_-28px_rgba(30,20,80,.55)] transition-all duration-700 ease-[cubic-bezier(.2,.7,.2,1)] ${
                    stage >= 3 ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-5 opacity-0"
                  } ${stage >= 4 ? "border-mk-pos/40" : "border-mk-brand/40"}`}
                  style={abs(g.sug.x, g.sug.y, g.sug.w, g.sug.h)}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-[#7c64ff] to-[#5b8cff] text-[12px] text-white">✦</span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[13.5px] font-semibold leading-snug text-mk-ink">Move $3,000/mo from Google Search to TikTok</span>
                      <span className="text-[12px] leading-snug text-mk-ink3">TikTok earns $3.80 a dollar with room to scale; Search is flat at $2.05.</span>
                    </span>
                  </div>
                  <div className="absolute inset-x-3.5 bottom-3.5 flex h-[30px] items-center gap-2 text-[12px]">
                    {stage >= 4 ? (
                      <span className="text-mk-ink3">
                        <b className="font-semibold text-mk-pos">Applied</b> · logged · undo for 7 days
                      </span>
                    ) : (
                      <span className="font-semibold tabular-nums text-mk-pos">+$4,800 / mo expected</span>
                    )}
                    <span className="ml-auto rounded-full border border-mk-hair px-3 py-1 font-semibold text-mk-ink2">{stage >= 4 ? "Undo" : "Snooze"}</span>
                    <span
                      className={`w-[92px] rounded-full py-1 text-center font-semibold text-white transition-colors duration-300 ${stage >= 4 ? "bg-mk-pos" : "bg-mk-brand"}`}
                    >
                      {stage >= 4 ? "✓ Approved" : "Approve"}
                    </span>
                  </div>
                </div>

                {/* The click */}
                <div
                  className={`pointer-events-none absolute left-0 top-0 transition-all ease-[cubic-bezier(.3,.7,.2,1)] ${stage >= 3 ? "opacity-100" : "opacity-0"}`}
                  style={{
                    transitionDuration: "900ms",
                    transform: stage >= 3 ? `translate(${g.approve.x}px, ${g.approve.y}px)` : `translate(${g.W - 30}px, ${g.H + 10}px)`,
                  }}
                >
                  {stage >= 4 && <span key="ripple" className="adx-ripple absolute -left-4 -top-4 h-8 w-8 rounded-full bg-mk-pos/40" />}
                  <svg width="20" height="22" viewBox="0 0 20 22" className={`drop-shadow-md transition-transform duration-150 ${stage >= 4 ? "scale-90" : ""}`}>
                    <path d="M1.5 1.5v16.2l4.4-4.1 2.9 6.6 3-1.3-2.9-6.5 6.1-.2z" fill="#15131a" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Progress through the story */}
            <div className="w-full max-w-[560px]">
              <div className="relative h-[3px] overflow-hidden rounded-full bg-mk-hair">
                <span ref={barRef} className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-[#7c64ff] to-[#41d39a]" style={{ transform: "scaleX(0)" }} />
              </div>
              <div className="mt-2.5 grid grid-cols-4 text-[12.5px]">
                {STEPS.map((s, i) => (
                  <span key={s} className={`transition-colors duration-300 ${i === 0 ? "text-left" : i === 3 ? "text-right" : "text-center"} ${i <= step ? "font-semibold text-mk-ink" : "text-mk-ink3"}`}>
                    <span className="mr-1 tabular-nums text-mk-ink3">{String(i + 1).padStart(2, "0")}</span>
                    {s}
                  </span>
                ))}
              </div>
              <p className="m-0 mt-3 flex items-center justify-between text-[12px] text-mk-ink3">
                <span>Illustrative example.</span>
                {pinned && (
                  <span ref={hintRef} className="inline-flex items-center gap-1.5">
                    Scroll to see it work
                    <span aria-hidden="true" className="adx-nudge">↓</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        .adx-scan {
          background: linear-gradient(90deg, transparent, rgba(124,100,255,.16) 30%, rgba(91,140,255,.22) 50%, rgba(124,100,255,.16) 70%, transparent);
          box-shadow: 0 0 0 1px rgba(124,100,255,.25);
          animation: adx-scan 1.15s cubic-bezier(.5,0,.3,1) both;
        }
        @keyframes adx-scan { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(162px); opacity: 0; } }
        .adx-ripple { animation: adx-ripple .7s ease-out both; }
        @keyframes adx-ripple { from { transform: scale(.3); opacity: 1; } to { transform: scale(2.2); opacity: 0; } }
        .adx-nudge { display: inline-block; animation: adx-nudge 1.6s ease-in-out infinite; }
        @keyframes adx-nudge { 50% { transform: translateY(3px); } }
        @media (prefers-reduced-motion: reduce) { .adx-scan, .adx-ripple, .adx-nudge { animation: none; } }
      `}</style>
    </section>
  );
}
