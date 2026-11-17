import { FabricObject, type Canvas, type StaticCanvas } from "fabric";
import { DEFAULT_IN_DUR, DEFAULT_OUT_DUR, cleanAnim, type Anim } from "./motion";

/**
 * Editing a video at one moment (plan C20b).
 *
 * A video design is still edited as a still, but the canvas shows only the
 * layers that are on screen at the editing moment: a second clip that comes
 * in later no longer covers the first, and an end card no longer covers the
 * whole ad. Hidden layers keep their place and can't be clicked; selecting
 * one (from the timeline or Layers) moves the editing moment to when it's on
 * screen.
 *
 * Nothing here is saved: the flag is our own, and Fabric doesn't save
 * \`evented\` / \`selectable\`. Exports run with everything shown (\`withAllShown\`).
 */

type O = FabricObject & { anim?: Anim | null; __offscreen?: boolean };

// Fabric skips drawing anything that says it isn't visible: an off-screen layer says so (once, for every object).
const proto = FabricObject.prototype as unknown as { isNotVisible: () => boolean; __editMoment?: boolean };
if (!proto.__editMoment) {
  const original = proto.isNotVisible;
  proto.isNotVisible = function (this: O) {
    return Boolean(this.__offscreen) || original.call(this);
  };
  proto.__editMoment = true;
}

/** What the layer's own click settings were before it was hidden. */
const saved = new WeakMap<FabricObject, { evented: boolean; selectable: boolean }>();

export const isOffscreen = (o: FabricObject | null | undefined) => Boolean((o as O | null | undefined)?.__offscreen);

/** Is the layer on screen at \`t\` (ignoring how far its entrance has got)? */
export function onScreenAt(anim: unknown, t: number, duration: number) {
  const a = cleanAnim(anim, duration);
  if (!a) return true;
  if (a.in && a.in !== "none" && t < (a.at ?? 0)) return false;
  if (a.out && a.out !== "none" && a.outAt != null && t >= a.outAt) return false;
  return true;
}

/** The first moment the layer is fully on screen (its entrance done, its exit not started). */
export function settleTime(anim: unknown, duration: number) {
  const a = cleanAnim(anim, duration);
  if (!a) return 0;
  const start = a.in && a.in !== "none" ? (a.at ?? 0) + (a.in === "appear" ? 0 : a.dur ?? DEFAULT_IN_DUR) : 0;
  const end = a.out && a.out !== "none" && a.outAt != null ? a.outAt - (a.out === "cut" ? 0 : a.outDur ?? DEFAULT_OUT_DUR) - 0.05 : duration;
  return Math.round(Math.max(0, Math.min(start, end, duration - 0.05)) * 100) / 100;
}

/**
 * Where editing starts: once the opening has come in (every layer that starts in
 * the first 2 seconds), before anything that arrives later.
 */
export function defaultEditMoment(canvas: Canvas | StaticCanvas, duration: number) {
  let t = 0;
  for (const o of canvas.getObjects() as O[]) {
    const a = cleanAnim(o.anim, duration);
    if (!a || !a.in || a.in === "none" || (a.at ?? 0) > 2) continue;
    t = Math.max(t, (a.at ?? 0) + (a.in === "appear" ? 0 : a.dur ?? DEFAULT_IN_DUR));
  }
  return Math.round(Math.max(0, Math.min(t, duration - 0.05)) * 100) / 100;
}

function hide(o: O, off: boolean) {
  if (Boolean(o.__offscreen) === off) return false;
  if (off) {
    saved.set(o, { evented: o.evented !== false, selectable: o.selectable !== false });
    o.__offscreen = true;
    o.set({ evented: false, selectable: false });
  } else {
    const before = saved.get(o) ?? { evented: true, selectable: true };
    o.__offscreen = false;
    o.set({ evented: before.evented, selectable: before.selectable });
    saved.delete(o);
  }
  return true;
}

/** Show the layers on screen at \`t\`, hide the rest. Returns true when something changed. */
export function applyEditMoment(canvas: Canvas | StaticCanvas, t: number, duration: number) {
  let changed = false;
  for (const o of canvas.getObjects() as O[]) changed = hide(o, !onScreenAt(o.anim, t, duration)) || changed;
  return changed;
}

/** Everything shown again (a still design, or a preview about to play). Returns true when something changed. */
export function clearEditMoment(canvas: Canvas | StaticCanvas) {
  let changed = false;
  for (const o of canvas.getObjects() as O[]) changed = hide(o, false) || changed;
  return changed;
}

/** Run \`fn\` (an export, a thumbnail) with every layer shown, then hide again what was hidden. */
export function withAllShown<T>(canvas: Canvas | StaticCanvas, fn: () => T): T {
  const hidden = (canvas.getObjects() as O[]).filter((o) => o.__offscreen);
  if (!hidden.length) return fn();
  hidden.forEach((o) => (o.__offscreen = false));
  try {
    return fn();
  } finally {
    hidden.forEach((o) => (o.__offscreen = true));
  }
}
