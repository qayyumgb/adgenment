import { FabricImage, StaticCanvas, Textbox, util, type Canvas, type FabricObject } from "fabric";
import type { BrandKit } from "@/lib/api";
import { dataUrlToBlob, fitScale, fontsIn, serialize } from "./canvas";
import { loadFont } from "./fonts";
import { FrameImage } from "./frames";
import { TEMPLATES, aspectOf, fontsFor, paletteFor } from "./templates";
import { TEXT_STYLE, renderTemplate, type FramePhoto } from "./templateRender";

/**
 * One-click resize (plan C19b): lay a design out again in another ad size.
 *
 * - **Made from a template** (objects carry a `slot`): the template is drawn
 *   again in the new size, then what the person changed is carried over:
 *   edited text, colours, fonts, the photos in frames (with their focus and
 *   zoom), the logo, the background colour. Parts they deleted stay deleted.
 * - **Anything else** (and objects they added to a template) is repositioned:
 *   a background photo covers the new size; full-width bands and frames
 *   stretch along that side; things near an edge keep their margin to it;
 *   the rest keeps its relative place. Everything scales with the shorter
 *   side, so text keeps its size relative to the ad.
 *
 * Works on an off-screen canvas; returns the design JSON (images as
 * "asset:<id>", copied into the new design by the API) and a thumbnail.
 */

type Json = Record<string, unknown>;
export type Size = { W: number; H: number };

const EDGE = 0.12;
const FULL = 0.95;

async function loadFonts(data: Json) {
  await Promise.all(fontsIn(data).map((f) => loadFont(f.family, f.weight, f.italic)));
}

/** Move and scale one object from the old size into the new one (it's already enlivened, not on a canvas). */
export function reposition(o: FabricObject, from: Size, to: Size) {
  o.setCoords();
  const b = o.getBoundingRect();
  const k = Math.min(to.W, to.H) / Math.min(from.W, from.H);
  const name = (o as FabricObject & { name?: string }).name;
  const fullW = b.width >= from.W * FULL;
  const fullH = b.height >= from.H * FULL;
  const background = name === "Background" || (fullW && fullH);
  const isFrame = o instanceof FrameImage;
  const isText = o instanceof Textbox;
  const isPhoto = o instanceof FabricImage && !isFrame;

  if (background) {
    if (isPhoto) {
      const s = fitScale(o.width ?? 1, o.height ?? 1, to.W, to.H, "cover");
      o.set({ scaleX: s, scaleY: s, left: to.W / 2, top: to.H / 2, angle: 0 });
    } else if (isFrame) {
      o.set({ width: to.W, height: to.H, scaleX: 1, scaleY: 1, left: to.W / 2, top: to.H / 2, angle: 0 });
    } else {
      o.set({ scaleX: (o.scaleX ?? 1) * (to.W / b.width), scaleY: (o.scaleY ?? 1) * (to.H / b.height), left: to.W / 2, top: to.H / 2 });
    }
    o.setCoords();
    return;
  }

  // Size.
  if (isText) {
    const t = o as Textbox;
    t.set({ fontSize: (t.fontSize ?? 40) * k, width: fullW ? to.W * (t.width / b.width) : t.width * k });
    t.initDimensions();
  } else if (isFrame) {
    const f = o as FrameImage;
    const bw = f.width * Math.abs(f.scaleX);
    const bh = f.height * Math.abs(f.scaleY);
    f.set({ width: fullW ? to.W * (bw / b.width) : bw * k, height: fullH ? to.H * (bh / b.height) : bh * k, scaleX: Math.sign(f.scaleX) || 1, scaleY: Math.sign(f.scaleY) || 1 });
  } else if (!isPhoto && (fullW || fullH)) {
    o.set({ scaleX: (o.scaleX ?? 1) * (fullW ? to.W / b.width : k), scaleY: (o.scaleY ?? 1) * (fullH ? to.H / b.height : k) });
  } else {
    o.set({ scaleX: (o.scaleX ?? 1) * k, scaleY: (o.scaleY ?? 1) * k });
  }
  o.setCoords();
  const nb = o.getBoundingRect();

  // Place: keep margins to near edges, else the relative position.
  const place = (start: number, size: number, total: number, newSize: number, newTotal: number, full: boolean) => {
    const before = start;
    const after = total - (start + size);
    if (full) return (newTotal - newSize) / 2 + (before - after) * (newTotal / total) / 2;
    // Centred on the ad stays centred (wide centred text is also "near" both edges).
    if (Math.abs(start + size / 2 - total / 2) <= total * 0.03) return (newTotal - newSize) / 2;
    if (before <= total * EDGE && before <= after) return Math.max(0, before * k);
    if (after <= total * EDGE) return newTotal - newSize - Math.max(0, after * k);
    return ((start + size / 2) / total) * newTotal - newSize / 2;
  };
  let left = place(b.left, b.width, from.W, nb.width, to.W, fullW);
  let top = place(b.top, b.height, from.H, nb.height, to.H, fullH);
  // Whatever was fully inside the ad stays inside.
  const inside = b.left >= -1 && b.top >= -1 && b.left + b.width <= from.W + 1 && b.top + b.height <= from.H + 1;
  if (inside) {
    left = Math.min(Math.max(0, left), Math.max(0, to.W - nb.width));
    top = Math.min(Math.max(0, top), Math.max(0, to.H - nb.height));
  }
  o.set({ left: (o.left ?? 0) + (left - nb.left), top: (o.top ?? 0) + (top - nb.top) });
  o.setCoords();
}

/** The new design (asset references) and a thumbnail, for one target size. */
export async function resizeDesign(source: Json, from: Size, to: Size, kit: BrandKit | null): Promise<{ data: Json; preview: Blob }> {
  await loadFonts(source);
  const sc = new StaticCanvas(undefined, { width: to.W, height: to.H, enableRetinaScaling: false, renderOnAddRemove: false });
  try {
    sc.backgroundColor = typeof source.background === "string" ? source.background : "#ffffff";
    const objects = (Array.isArray(source.objects) ? source.objects : []) as Json[];

    // Made from a template? Its id is the first part of any object's slot.
    const firstSlot = objects.find((x) => typeof x.slot === "string")?.slot as string | undefined;
    const tpl = firstSlot ? TEMPLATES.find((t) => t.id === firstSlot.split("|")[0]) : undefined;
    const bySlot = new Map<string, Json>();
    const extras: Json[] = [];
    for (const x of objects) {
      const slot = typeof x.slot === "string" ? x.slot : null;
      if (tpl && slot && slot.startsWith(`${tpl.id}|`) && !bySlot.has(slot)) bySlot.set(slot, x);
      else extras.push(x);
    }

    if (tpl) {
      const fromEls = tpl.build(aspectOf(from.W, from.H));
      const els = tpl.build(aspectOf(to.W, to.H));
      const overrides = new Map<string, Record<string, unknown>>();
      const photos = new Map<string, FramePhoto>();
      let logo: { id: string; url: string } | null = null;
      for (const [slot, x] of bySlot) {
        const [, ei, ii, part] = slot.split("|");
        if (part === "text" || part === "label") {
          const ov: Record<string, unknown> = {};
          for (const key of TEXT_STYLE) if (x[key] !== undefined) ov[key] = x[key];
          // Text they didn't edit keeps the new size's own wording (e.g. a line break that only suits one size).
          const el = fromEls[Number(ei)];
          const item = el?.t === "stack" ? el.items[Number(ii)] : undefined;
          if (item && x.text === item.text) delete ov.text;
          overrides.set(slot, ov);
        } else if (part === "shape" || part === "button") {
          overrides.set(slot, { fill: x.fill, opacity: x.opacity });
        } else if (part === "frame" && x.empty === false && typeof x.src === "string" && typeof x.assetId === "string") {
          photos.set(slot, { src: x.src, assetId: x.assetId, focusX: x.focusX as number, focusY: x.focusY as number, zoom: x.zoom as number });
        } else if (part === "logo" && typeof x.src === "string" && typeof x.assetId === "string") {
          logo = { id: x.assetId, url: x.src };
        }
      }
      const bg = sc.backgroundColor;
      await renderTemplate(sc, els, { W: to.W, H: to.H, pal: paletteFor(kit), fonts: fontsFor(tpl, kit), logo, tplId: tpl.id, overrides, photos, keep: (slot) => bySlot.has(slot) });
      sc.backgroundColor = bg; // their background colour, not the template's default
    }

    if (extras.length) {
      const objs = (await util.enlivenObjects(extras)) as FabricObject[];
      for (const o of objs) {
        reposition(o, from, to);
        sc.add(o);
      }
      // Keep the original stacking: a background photo stays at the back.
      for (const o of objs) if ((o as FabricObject & { name?: string }).name === "Background") sc.sendObjectToBack(o);
    }

    sc.renderAll();
    const url = sc.toDataURL({ format: "png", multiplier: 480 / Math.max(to.W, to.H), enableRetinaScaling: false });
    return { data: serialize(sc as unknown as Canvas), preview: await dataUrlToBlob(url) };
  } finally {
    void sc.dispose();
  }
}
