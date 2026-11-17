import type { Canvas, FabricObject } from "fabric";
import { cleanAnim, frameAt, type Anim, type MotionIn, type Rest } from "./motion";

/**
 * The video preview on the editor's own canvas (plan C20a).
 *
 * The design stays a still. While previewing, every animated layer is moved
 * to where `frameAt` puts it at time t (the same maths the server render
 * uses), and nothing can be selected. Leaving the preview puts every layer
 * back exactly where it was, so a preview can never change the design.
 *
 * Anything that reads the canvas (saving, undo history, export) must see the
 * still: `atRest` and `exit` are for that.
 */

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);

export type AnimObj = FabricObject & { anim?: Anim | null; name?: string; slot?: string; text?: string; styles?: Json };

/** Typewriter: the characters not yet "typed" are drawn transparent, so the text never re-flows. KEEP IN SYNC with the server's render.ts. */
function typeStyles(text: string, rest: Json, shown: number): Json {
  const out: Json = {};
  let n = 0;
  text.split("\n").forEach((line, li) => {
    const chars = Array.from(line);
    const base = (isObj(rest[li]) ? rest[li] : {}) as Json;
    const row: Json = { ...base };
    chars.forEach((_, ci) => {
      if (n >= shown) row[ci] = { ...(isObj(base[ci]) ? (base[ci] as Json) : {}), fill: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)" };
      n++;
    });
    n++; // the line break
    if (Object.keys(row).length) out[li] = row;
  });
  return out;
}

type Layer = { o: AnimObj; anim: Anim | null; rest: Rest; text: string | null; styles: Json; total: number; lastShown: number };
/** A frame holding footage (frames.ts), as far as the preview needs it. */
type ClipObj = AnimObj & { clip?: boolean; clipStart?: number; clipEnd?: number; muted?: boolean; volume?: number; getElement?: () => unknown };
type Clip = { v: HTMLVideoElement; /** When it starts playing in the video: when its layer comes in. */ at: number; start: number; end: number; muted: boolean; volume: number };

export class MotionPreview {
  private layers: Layer[] | null = null;
  private clips: Clip[] = [];
  private W = 0;
  private H = 0;
  private duration = 0;
  private last = 0;
  private was = { selection: true, skipTargetFind: false };
  private picked: FabricObject | null = null;
  /** True while the preview itself drops and restores the selection: the editor keeps showing the selected layer's panels. */
  quiet = false;
  /** Told when the preview starts and ends (the timeline follows it). */
  onChange: ((active: boolean) => void) | null = null;

  constructor(private canvas: Canvas) {}

  get active() {
    return this.layers !== null;
  }

  /** Start previewing: remember where everything is, and stop the canvas from being edited. */
  enter(W: number, H: number, duration: number) {
    if (this.layers) this.exit();
    const c = this.canvas;
    // One selected layer stays "selected" for the editor (its handles are hidden while the video plays) and is picked again afterwards.
    const picked = c.getActiveObject();
    this.picked = picked && (picked.type ?? "").toLowerCase() !== "activeselection" && !(picked as FabricObject & { isEditing?: boolean }).isEditing ? picked : null;
    this.quiet = Boolean(this.picked);
    try {
      c.discardActiveObject();
    } finally {
      this.quiet = false;
    }
    this.W = W;
    this.H = H;
    this.duration = duration;
    this.layers = (c.getObjects() as AnimObj[]).map((o) => {
      const anim = cleanAnim(o.anim, duration);
      const text = typeof o.text === "string" && anim?.in === "typewriter" ? o.text : null;
      return {
        o,
        anim,
        rest: { left: o.left ?? 0, top: o.top ?? 0, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1, opacity: o.opacity ?? 1 },
        text,
        styles: (isObj(o.styles) ? o.styles : {}) as Json,
        total: text ? Array.from(text).length : 0,
        lastShown: -1,
      };
    });
    this.clips = (c.getObjects() as ClipObj[]).flatMap((o) => {
      const v = o.clip && o.visible !== false ? o.getElement?.() : null;
      if (!(v instanceof HTMLVideoElement)) return [];
      const start = o.clipStart ?? 0;
      const a = cleanAnim(o.anim, duration);
      return [{ v, at: a && a.in !== "none" ? a.at ?? 0 : 0, start, end: Math.max(start + 0.1, o.clipEnd ?? v.duration ?? start + 0.1), muted: Boolean(o.muted), volume: Math.min(1, Math.max(0, o.volume ?? 1)) }];
    });
    this.was = { selection: c.selection, skipTargetFind: c.skipTargetFind };
    c.selection = false;
    c.skipTargetFind = true;
    this.onChange?.(true);
  }

  private apply(t: number) {
    if (!this.layers) return;
    for (const l of this.layers) {
      if (!l.anim) continue;
      const f = frameAt(l.rest, l.anim, t, this.W, this.H, this.duration);
      l.o.set({ left: f.left, top: f.top, scaleX: f.scaleX, scaleY: f.scaleY, opacity: f.opacity });
      if (l.text !== null) {
        const shown = f.chars === null ? l.total : Math.floor(f.chars * l.total);
        if (shown !== l.lastShown) {
          l.o.set({ styles: shown >= l.total ? l.styles : typeStyles(l.text, l.styles, shown), dirty: true } as Partial<FabricObject>);
          l.lastShown = shown;
        }
      }
    }
  }

  private rest() {
    if (!this.layers) return;
    for (const l of this.layers) {
      if (!l.anim) continue;
      l.o.set(l.rest);
      if (l.text !== null) {
        l.o.set({ styles: l.styles, dirty: true } as Partial<FabricObject>);
        l.lastShown = -1;
      }
      l.o.setCoords();
    }
  }

  /** Footage follows the clock: playing along (with its sound) while the preview plays, parked on the right frame otherwise. */
  private sync(t: number, playing: boolean) {
    for (const c of this.clips) {
      const local = t - c.at;
      const over = c.start + local >= c.end;
      const target = Math.min(c.end - 0.04, c.start + Math.max(0, local));
      if (playing && !over && local >= 0) {
        c.v.muted = c.muted || c.volume === 0;
        c.v.volume = c.volume;
        if (c.v.paused) {
          c.v.currentTime = target;
          void c.v.play().catch(() => undefined);
        } else if (Math.abs(c.v.currentTime - target) > 0.3) c.v.currentTime = target;
      } else {
        if (!c.v.paused) c.v.pause();
        if (Math.abs(c.v.currentTime - target) > 0.03) c.v.currentTime = target;
      }
    }
  }

  /** Show the video at time t (seconds). `playing`: the clock is running (footage plays along, with sound). */
  draw(t: number, playing = false) {
    if (!this.layers) return;
    this.last = t;
    this.apply(t);
    this.sync(t, playing);
    this.canvas.requestRenderAll();
  }

  /** Stop previewing: everything back where it was, the canvas editable again. */
  exit() {
    if (!this.layers) return;
    this.rest();
    this.layers = null;
    // Footage goes back to the still the editor shows: the first frame of its chosen part.
    for (const k of this.clips) {
      k.v.pause();
      if (Math.abs(k.v.currentTime - k.start) > 0.02) k.v.currentTime = k.start;
    }
    this.clips = [];
    const c = this.canvas;
    c.selection = this.was.selection;
    c.skipTargetFind = this.was.skipTargetFind;
    const picked = this.picked;
    this.picked = null;
    if (picked && c.getObjects().includes(picked) && !c.getActiveObject()) {
      this.quiet = true;
      try {
        c.setActiveObject(picked);
      } finally {
        this.quiet = false;
      }
    }
    c.requestRenderAll();
    this.onChange?.(false);
  }

  /** Read the canvas as the still it is (saving while a preview plays), then carry on previewing. */
  atRest<T>(fn: () => T): T {
    if (!this.layers) return fn();
    this.rest();
    try {
      return fn();
    } finally {
      this.apply(this.last);
    }
  }
}

/**
 * "Animate for me": a sensible animation for every layer, from what it is
 * and where it sits. Backgrounds drift, everything else arrives top to
 * bottom a moment apart; a shape under a text (a button, a badge) arrives
 * with its text.
 */
export function autoAnimate(canvas: Canvas, W: number, H: number, duration: number): Map<AnimObj, Anim | null> {
  const out = new Map<AnimObj, Anim | null>();
  const area = W * H;
  const all = (canvas.getObjects() as AnimObj[]).map((o, z) => {
    o.setCoords();
    const b = o.getBoundingRect();
    const kind = (o.type ?? "").toLowerCase();
    return { o, z, b, cx: b.left + b.width / 2, cy: b.top + b.height / 2, share: (b.width * b.height) / area, isText: typeof o.text === "string", isImage: kind === "image" || kind === "frameimage" };
  });
  const backdrop = (x: (typeof all)[number]) => x.o.name === "Background" || (x.b.width >= W * 0.95 && x.b.height >= H * 0.95) || (!x.isText && !x.isImage && x.share > 0.45);
  const moving = all.filter((x) => x.o.visible !== false && !backdrop(x));
  for (const x of all) out.set(x.o, null);
  // Photos behind everything drift slowly; plain panels stay still.
  for (const x of all) if (x.o.visible !== false && backdrop(x) && x.isImage) out.set(x.o, { in: "none", hold: "zoom", out: "none" });

  // A shape directly under a text's centre comes in with that text.
  const partner = new Map<AnimObj, AnimObj>();
  for (const t of moving.filter((x) => x.isText)) {
    const under = moving
      .filter((s) => !s.isText && !s.isImage && s.z < t.z && s.share < 0.3 && t.cx >= s.b.left && t.cx <= s.b.left + s.b.width && t.cy >= s.b.top && t.cy <= s.b.top + s.b.height)
      .sort((a, b) => b.z - a.z)[0];
    if (under && !partner.has(under.o)) partner.set(under.o, t.o);
  }
  const paired = new Set(partner.keys());
  const leads = moving.filter((x) => !paired.has(x.o)).sort((a, b) => a.b.top - b.b.top || a.b.left - b.b.left);
  const gap = Math.min(0.35, (duration * 0.4) / Math.max(1, leads.length));
  leads.forEach((x, i) => {
    const mate = [...partner.entries()].find(([, text]) => text === x.o)?.[0];
    const mateShare = mate ? all.find((a) => a.o === mate)!.share : 1;
    const type: MotionIn = mate && mateShare < 0.08 ? "pop" : x.isText ? "slide-up" : x.isImage && x.o.name !== "Logo" ? "zoom-in" : "fade";
    const anim: Anim = { in: type, at: Math.round((0.2 + i * gap) * 100) / 100, dur: type === "zoom-in" ? 0.8 : 0.6, hold: "none", out: "none" };
    out.set(x.o, anim);
    if (mate) out.set(mate, { ...anim });
  });
  return out;
}
