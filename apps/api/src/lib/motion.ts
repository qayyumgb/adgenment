/**
 * Motion for video ads (plan C20a): where a layer is at time t.
 *
 * KEEP IN SYNC: this file is identical in
 *   apps/api/src/lib/motion.ts                 (the server render)
 *   apps/web/components/app/editor/motion.ts   (the editor preview)
 * so the preview and the rendered MP4 can't drift apart. Pure maths, no
 * imports. Change one, copy it to the other.
 *
 * A design is a still (the "rest" layout the editor shows). Each layer may
 * carry an `anim`: how it comes in, what it does while on screen, how it
 * leaves. At any time the layer's rest position, scale and opacity are
 * adjusted by `frameAt`; nothing else about the layer changes.
 */

export type MotionIn = "none" | "appear" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "pop" | "zoom-in" | "typewriter";
export type MotionOut = "none" | "cut" | "fade" | "slide-up" | "slide-down" | "pop";
export type MotionHold = "none" | "zoom" | "float" | "pulse";

export type Anim = {
  /** Entrance, starting at `at` seconds and lasting `dur` seconds. Before `at` the layer is hidden ("appear": it is simply there from `at`). Footage in the layer starts playing at `at`. */
  in?: MotionIn;
  at?: number;
  dur?: number;
  /** While on screen. */
  hold?: MotionHold;
  /** Exit, ending at `outAt` seconds (default: no exit, the layer stays to the end). */
  out?: MotionOut;
  outAt?: number | null;
  outDur?: number;
};

/** Saved at the top of a design's data as `motion`. No `motion` = a still image design. */
export type DocMotion = { duration: number };

export const FPS = 30;
export const MIN_DURATION = 3;
export const MAX_DURATION = 60;
export const DEFAULT_DURATION = 8;
export const DEFAULT_IN_DUR = 0.6;
export const DEFAULT_OUT_DUR = 0.4;

export const IN_LABELS: Record<MotionIn, string> = {
  none: "None",
  appear: "Appear (cut)",
  fade: "Fade in",
  "slide-up": "Slide up",
  "slide-down": "Slide down",
  "slide-left": "Slide from right",
  "slide-right": "Slide from left",
  pop: "Pop",
  "zoom-in": "Zoom in",
  typewriter: "Typewriter",
};
export const HOLD_LABELS: Record<MotionHold, string> = { none: "None", zoom: "Slow zoom", float: "Float", pulse: "Pulse" };
export const OUT_LABELS: Record<MotionOut, string> = { none: "None", cut: "Disappear (cut)", fade: "Fade out", "slide-up": "Slide up", "slide-down": "Slide down", pop: "Shrink" };

export type Rest = { left: number; top: number; scaleX: number; scaleY: number; opacity: number };
export type Frame = Rest & {
  /** Typewriter: the share of the text's characters shown (0–1); null = all of it. */
  chars: number | null;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const inCubic = (t: number) => t * t * t;
/** Overshoots a little, then settles (the "pop"). */
const outBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const clampDuration = (v: unknown) => {
  const n = v == null || v === "" ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(n * 10) / 10)) : DEFAULT_DURATION;
};

/** A tidy copy of whatever was saved (old or hand-edited data never breaks a render). */
export function cleanAnim(raw: unknown, duration: number): Anim | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, dflt: number) => {
    const n = v == null || v === "" ? NaN : Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
  };
  const inn = (typeof a.in === "string" && a.in in IN_LABELS ? a.in : "none") as MotionIn;
  const hold = (typeof a.hold === "string" && a.hold in HOLD_LABELS ? a.hold : "none") as MotionHold;
  const out = (typeof a.out === "string" && a.out in OUT_LABELS ? a.out : "none") as MotionOut;
  if (inn === "none" && hold === "none" && out === "none") return null;
  const at = num(a.at, 0, Math.max(0, duration - 0.1), 0);
  return {
    in: inn,
    at,
    dur: num(a.dur, 0.1, 5, DEFAULT_IN_DUR),
    hold,
    out,
    outAt: out === "none" ? null : num(a.outAt, at + 0.2, duration, duration),
    outDur: num(a.outDur, 0.1, 5, DEFAULT_OUT_DUR),
  };
}

/**
 * The layer at time `t` (seconds). `w` and `h` are the design's size (slide
 * distances and float follow the design, so every size moves alike).
 */
export function frameAt(rest: Rest, anim: Anim | null, t: number, w: number, h: number, duration: number): Frame {
  const f: Frame = { ...rest, chars: null };
  if (!anim) return f;
  const dist = Math.min(w, h) * 0.09;
  const at = anim.at ?? 0;
  const dur = Math.max(0.01, anim.dur ?? DEFAULT_IN_DUR);

  // While on screen (measured over the whole video so it never restarts).
  const life = clamp01(t / Math.max(0.01, duration));
  if (anim.hold === "zoom") {
    const k = 1 + 0.08 * life;
    f.scaleX *= k;
    f.scaleY *= k;
  } else if (anim.hold === "float") {
    f.top += Math.sin(t * 1.6) * h * 0.006;
  } else if (anim.hold === "pulse") {
    const k = 1 + 0.025 * Math.sin(t * 3.2);
    f.scaleX *= k;
    f.scaleY *= k;
  }

  // Entrance.
  const type = anim.in ?? "none";
  if (type !== "none") {
    if (t < at) {
      f.opacity = 0;
      if (type === "typewriter") f.chars = 0;
      return f;
    }
    const p = clamp01((t - at) / dur);
    if (p < 1) {
      const e = outCubic(p);
      if (type === "fade") f.opacity *= e;
      else if (type === "slide-up") (f.top += (1 - e) * dist), (f.opacity *= clamp01(p * 2.5));
      else if (type === "slide-down") (f.top -= (1 - e) * dist), (f.opacity *= clamp01(p * 2.5));
      else if (type === "slide-left") (f.left += (1 - e) * dist), (f.opacity *= clamp01(p * 2.5));
      else if (type === "slide-right") (f.left -= (1 - e) * dist), (f.opacity *= clamp01(p * 2.5));
      else if (type === "pop") {
        const k = 0.6 + 0.4 * outBack(p);
        f.scaleX *= k;
        f.scaleY *= k;
        f.opacity *= clamp01(p * 3);
      } else if (type === "zoom-in") {
        const k = 1.18 - 0.18 * e;
        f.scaleX *= k;
        f.scaleY *= k;
        f.opacity *= e;
      } else if (type === "typewriter") f.chars = p;
    }
  }

  // Exit.
  const out = anim.out ?? "none";
  if (out !== "none" && anim.outAt != null) {
    const od = Math.max(0.01, anim.outDur ?? DEFAULT_OUT_DUR);
    const q = clamp01((t - (anim.outAt - od)) / od);
    if (q > 0) {
      const e = inCubic(q);
      if (out === "cut") f.opacity *= q >= 1 ? 0 : 1;
      else if (out === "fade") f.opacity *= 1 - e;
      else if (out === "slide-up") (f.top -= e * dist), (f.opacity *= 1 - e);
      else if (out === "slide-down") (f.top += e * dist), (f.opacity *= 1 - e);
      else if (out === "pop") {
        const k = 1 - 0.4 * e;
        f.scaleX *= k;
        f.scaleY *= k;
        f.opacity *= 1 - e;
      }
    }
  }
  return f;
}

/** When every entrance has finished: the moment used for the poster image. */
export function settledAt(anims: (Anim | null)[], duration: number) {
  let t = 0;
  for (const a of anims) if (a && (a.in ?? "none") !== "none") t = Math.max(t, (a.at ?? 0) + (a.dur ?? DEFAULT_IN_DUR));
  // Not during an exit.
  let firstOut = duration;
  for (const a of anims) if (a && (a.out ?? "none") !== "none" && a.outAt != null) firstOut = Math.min(firstOut, a.outAt - (a.outDur ?? DEFAULT_OUT_DUR));
  return Math.max(0, Math.min(t + 0.05, firstOut - 0.05, duration));
}
