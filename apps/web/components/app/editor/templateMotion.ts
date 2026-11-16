import type { Canvas, FabricObject, StaticCanvas } from "fabric";
import { cleanAnim, type Anim, type MotionIn } from "./motion";
import type { Box, Category, TEl } from "./templates";

/**
 * The animation a template comes with (plan C20a, step 3).
 *
 * Worked out from the template's own description, so the gallery preview
 * (TemplatePreview, CSS) and the canvas objects (by their `slot`) move the
 * same way, in every ad size:
 * - a full photo drifts; a smaller photo zooms in first;
 * - decoration fades in and floats; colour bands fade in; the logo fades in;
 * - the text arrives line by line in the template's style, the headline with
 *   the style's signature move; a button pops and then pulses gently;
 * - a badge (a small shape with text on it) pops in as one piece.
 *
 * Keys are "<element>|<item>|<part>": a slot without its template id.
 */

export type MotionStyle = "rise" | "slide" | "pop" | "type" | "zoom";
const BY_CATEGORY: Record<Category, MotionStyle> = { Sale: "pop", Product: "rise", Event: "slide", Testimonial: "type", Lead: "rise", Announcement: "zoom" };
/** Templates that move differently from the rest of their category, so the gallery isn't all alike. */
const BY_ID: Record<string, MotionStyle> = { "flash-sale": "slide", "last-chance": "type", "free-delivery": "rise", "new-arrival": "zoom", "split-classic": "slide", "save-the-date": "pop", "free-quote": "slide", minimal: "type", hiring: "rise" };

const area = (b: Box) => b.w * b.h;
const holds = (outer: Box, inner: Box) => {
  const cx = inner.x + inner.w / 2;
  const cy = inner.y + inner.h / 2;
  return cx >= outer.x && cx <= outer.x + outer.w && cy >= outer.y && cy <= outer.y + outer.h;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export function templateMotion(tpl: { id: string; category: Category }, els: TEl[]): Map<string, Anim> {
  const style = BY_ID[tpl.id] ?? BY_CATEGORY[tpl.category];
  const out = new Map<string, Anim>();
  const set = (ei: number, ii: number, part: string, a: Anim) => out.set(`${ei}|${ii}|${part}`, { hold: "none", out: "none", ...a });

  // The headline: the biggest text outside a badge.
  const badges = new Map<number, number>(); // stack element → its shape element
  els.forEach((el, ei) => {
    if (el.t !== "stack") return;
    for (let k = ei - 1; k >= 0; k--) {
      const s = els[k];
      if (s.t === "shape" && area(s.box) < 0.2 && (s.opacity ?? 1) === 1 && holds(s.box, el.box)) return void badges.set(ei, k);
    }
  });
  let top = 0;
  els.forEach((el, ei) => el.t === "stack" && !badges.has(ei) && el.items.forEach((it) => it.t === "text" && (top = Math.max(top, it.size))));

  const badgeShapes = new Set(badges.values());
  els.forEach((el, ei) => {
    if (el.t === "shape") {
      if (badgeShapes.has(ei)) return;
      if (el.name === "Decoration" || (el.opacity ?? 1) < 1) set(ei, 0, "shape", { in: "fade", at: 0, dur: 0.9, hold: "float" });
      else if (area(el.box) < 0.9) set(ei, 0, "shape", { in: "fade", at: 0.1, dur: 0.5 });
    } else if (el.t === "frame") {
      if (area(el.box) >= 0.9) set(ei, 0, "frame", { in: "none", hold: "zoom" });
      else set(ei, 0, "frame", { in: "zoom-in", at: 0, dur: 0.9 });
    } else if (el.t === "logo") set(ei, 0, "logo", { in: "fade", at: 0.15, dur: 0.5 });
  });

  // Text: line after line, top stack first.
  let t = 0.35;
  els
    .map((el, ei) => ({ el, ei }))
    .filter((x) => x.el.t === "stack" && !badges.has(x.ei))
    .sort((a, b) => (a.el as { box: Box }).box.y - (b.el as { box: Box }).box.y)
    .forEach(({ el, ei }) => {
      if (el.t !== "stack") return;
      el.items.forEach((it, ii) => {
        if (it.t === "button") {
          const a: Anim = { in: "pop", at: r2(t), dur: 0.6, hold: "pulse" };
          set(ei, ii, "button", a);
          set(ei, ii, "label", a);
          t += 0.3;
          return;
        }
        const headline = it.size === top;
        let type: MotionIn = style === "slide" ? "slide-right" : style === "rise" || style === "pop" ? "slide-up" : "fade";
        let dur = 0.6;
        if (headline && style === "pop") type = "pop";
        if (headline && style === "zoom") (type = "zoom-in"), (dur = 0.8);
        if (headline && style === "type") (type = "typewriter"), (dur = Math.min(1.8, Math.max(0.7, it.text.length * 0.04)));
        set(ei, ii, "text", { in: type, at: r2(t), dur: r2(dur) });
        t += type === "typewriter" ? dur * 0.8 : 0.3;
      });
    });

  // Badges pop in once the text has started.
  const at = r2(Math.min(t, 0.9));
  badges.forEach((shape, stack) => {
    const el = els[stack];
    set(shape, 0, "shape", { in: "pop", at, dur: 0.6 });
    if (el.t === "stack") el.items.forEach((it, ii) => (it.t === "button" ? (set(stack, ii, "button", { in: "pop", at, dur: 0.6 }), set(stack, ii, "label", { in: "pop", at, dur: 0.6 })) : set(stack, ii, "text", { in: "pop", at, dur: 0.6 })));
  });
  return out;
}

type Slotted = FabricObject & { slot?: string; anim?: Anim | null };

/** Give the template's objects on a canvas their animation (objects the person added are left alone). Returns how many now move. */
export function applyTemplateMotion(canvas: Canvas | StaticCanvas, tpl: { id: string; category: Category }, els: TEl[], duration: number) {
  const plan = templateMotion(tpl, els);
  let count = 0;
  for (const o of canvas.getObjects() as Slotted[]) {
    if (typeof o.slot !== "string" || !o.slot.startsWith(`${tpl.id}|`)) continue;
    const anim = cleanAnim(plan.get(o.slot.slice(tpl.id.length + 1)), duration);
    o.set({ anim: anim ?? undefined } as Partial<FabricObject>);
    if (anim) count++;
  }
  return count;
}
