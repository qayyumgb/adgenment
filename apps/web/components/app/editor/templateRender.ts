import { FabricImage, Textbox, util, type FabricObject, type StaticCanvas } from "fabric";
import { fitScale } from "./canvas";
import { loadFont, nearestWeight } from "./fonts";
import { makeFrame, type FrameImage } from "./frames";
import { makeShape } from "./shapes";
import { paint, type Palette, type StackItem, type TEl } from "./templates";

/**
 * Draw a template (templates.ts) onto a canvas as ordinary, editable objects:
 * text boxes, shapes, empty photo frames and the brand logo. Text in a stack
 * is measured after its font has loaded, so wrapped headlines push the lines
 * below down instead of overlapping them. The caller clears the canvas first
 * and records one undo step afterwards.
 *
 * Every object gets a `slot` ("<template>|<element>|<item>|<part>"), saved
 * with the design. One-click resize (resize.ts) re-draws the template in the
 * new size and passes what the person changed back in: `overrides` (text,
 * colours, fonts per slot), `photos` (frames' pictures) and `keep` (parts
 * they deleted stay deleted).
 */

export type FramePhoto = { src: string; assetId: string; focusX?: number; focusY?: number; zoom?: number };
type Opts = {
  W: number;
  H: number;
  pal: Palette;
  fonts: { heading: string; body: string };
  logo: { id: string; url: string } | null;
  tplId?: string;
  overrides?: Map<string, Record<string, unknown>>;
  photos?: Map<string, FramePhoto>;
  keep?: (slot: string) => boolean;
};

const BTN_PAD_Y = 0.62;
const BTN_PAD_X = 1.35;
/** What a person may have changed on a text and that resize carries over (never its size: that's the layout's). */
export const TEXT_STYLE = ["text", "fill", "fontFamily", "fontWeight", "fontStyle", "underline", "linethrough", "charSpacing"] as const;

export const slotOf = (tplId: string, el: number, item: number, part: string) => `${tplId}|${el}|${item}|${part}`;

function familyOf(item: StackItem, fonts: Opts["fonts"]) {
  return item.t === "button" ? fonts.body : item.font === "heading" ? fonts.heading : fonts.body;
}
function weightOf(item: StackItem, family: string) {
  return nearestWeight(family, item.t === "button" ? 700 : item.weight);
}

/** Every font the template draws with, loaded before anything is measured. */
export async function loadTemplateFonts(els: TEl[], fonts: Opts["fonts"], overrides?: Opts["overrides"]) {
  const want = new Set<string>();
  for (const el of els) if (el.t === "stack") for (const it of el.items) {
    const f = familyOf(it, fonts);
    want.add(`${f}|${weightOf(it, f)}|0`);
  }
  for (const o of overrides?.values() ?? []) if (typeof o.fontFamily === "string") want.add(`${o.fontFamily}|${o.fontWeight ?? 400}|${o.fontStyle === "italic" ? 1 : 0}`);
  await Promise.all([...want].map((k) => {
    const [f, w, i] = k.split("|");
    return loadFont(f, Number(w) || w, i === "1");
  }));
}

/** Only the style keys a text can take (ignores anything else in an override). */
function textStyle(o: Record<string, unknown> | undefined) {
  const out: Record<string, unknown> = {};
  if (o) for (const k of TEXT_STYLE) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

export async function renderTemplate(c: StaticCanvas, els: TEl[], o: Opts) {
  const { W, H, pal, fonts } = o;
  const S = Math.min(W, H);
  const id = o.tplId ?? "tpl";
  const keep = o.keep ?? (() => true);
  const center = (b: { x: number; y: number; w: number; h: number }) => ({ left: (b.x + b.w / 2) * W, top: (b.y + b.h / 2) * H });
  await loadTemplateFonts(els, fonts, o.overrides);

  for (let ei = 0; ei < els.length; ei++) {
    const el = els[ei];
    if (el.t === "bg") {
      c.backgroundColor = paint(pal, el.color);
    } else if (el.t === "shape") {
      const slot = slotOf(id, ei, 0, "shape");
      if (!keep(slot)) continue;
      const ov = o.overrides?.get(slot);
      const s = makeShape(el.shape, el.box.w * W, el.box.h * H, { fill: paint(pal, el.color), opacity: el.opacity ?? 1, ...(el.name ? { name: el.name } : {}), ...(ov?.fill !== undefined ? { fill: ov.fill } : {}), ...(typeof ov?.opacity === "number" ? { opacity: ov.opacity } : {}) });
      s.set({ ...center(el.box), slot } as Partial<FabricObject>);
      c.add(s);
    } else if (el.t === "frame") {
      const slot = slotOf(id, ei, 0, "frame");
      if (!keep(slot)) continue;
      const f: FrameImage = makeFrame(el.shape, el.box.w * W, el.box.h * H);
      f.set({ ...center(el.box), slot } as Partial<FabricObject>);
      const photo = o.photos?.get(slot);
      if (photo) {
        try {
          const img = await util.loadImage(photo.src, { crossOrigin: "anonymous" });
          f.setPhoto(img, photo.assetId);
          f.set({ focusX: photo.focusX ?? 0.5, focusY: photo.focusY ?? 0.5, zoom: photo.zoom ?? 1 } as Partial<FrameImage>);
        } catch {
          /* the frame stays empty rather than failing the whole layout */
        }
      }
      c.add(f);
    } else if (el.t === "logo") {
      const slot = slotOf(id, ei, 0, "logo");
      if (!o.logo || !keep(slot)) continue;
      const img = await FabricImage.fromURL(o.logo.url, { crossOrigin: "anonymous" });
      const bw = el.box.w * W;
      const bh = el.box.h * H;
      const scale = fitScale(img.width ?? 1, img.height ?? 1, bw, bh, "contain");
      const w = (img.width ?? 1) * scale;
      const x = el.align === "left" ? el.box.x * W + w / 2 : el.align === "right" ? (el.box.x + el.box.w) * W - w / 2 : (el.box.x + el.box.w / 2) * W;
      img.set({ left: x, top: (el.box.y + el.box.h / 2) * H, scaleX: scale, scaleY: scale, assetId: o.logo.id, name: "Logo", slot } as Partial<FabricImage>);
      c.add(img);
    } else {
      // A stack: build, measure, then place top to bottom.
      const boxW = el.box.w * W;
      const parts: { objs: FabricObject[]; w: number; h: number }[] = [];
      el.items.forEach((it, ii) => {
        const family = familyOf(it, fonts);
        const weight = weightOf(it, family);
        if (it.t === "text") {
          const slot = slotOf(id, ei, ii, "text");
          if (!keep(slot)) return;
          const style = textStyle(o.overrides?.get(slot));
          // Fabric takes the text from the first argument (an options.text is ignored), so an edited wording goes here.
          const tb = new Textbox(typeof style.text === "string" ? style.text : it.text, { width: boxW, fontSize: Math.round(it.size * S), fontWeight: weight, fontFamily: family, fill: paint(pal, it.color), textAlign: el.align, lineHeight: it.lineHeight ?? 1.2, charSpacing: it.spacing ?? 0, name: it.name ?? "Text", ...style, slot } as Partial<Textbox>);
          parts.push({ objs: [tb], w: boxW, h: tb.height ?? 0 });
          return;
        }
        const rectSlot = slotOf(id, ei, ii, "button");
        const labelSlot = slotOf(id, ei, ii, "label");
        if (!keep(rectSlot) && !keep(labelSlot)) return;
        const px = Math.round(it.size * S);
        const labelStyle = textStyle(o.overrides?.get(labelSlot));
        const label = new Textbox(typeof labelStyle.text === "string" ? labelStyle.text : it.text, { width: boxW * 2, fontSize: px, fontWeight: weight, fontFamily: family, fill: paint(pal, it.fg), textAlign: "center", lineHeight: 1, name: `${it.name ?? "Button"} text`, ...labelStyle, slot: labelSlot } as Partial<Textbox>);
        const tw = Math.ceil(label.calcTextWidth()) + 4;
        label.set({ width: tw });
        label.initDimensions();
        const bw = tw + px * BTN_PAD_X * 2;
        const bh = (label.height ?? px) + px * BTN_PAD_Y * 2;
        const rov = o.overrides?.get(rectSlot);
        const rect = makeShape("rounded", bw, bh, { fill: rov?.fill !== undefined ? rov.fill : paint(pal, it.bg), name: it.name ?? "Button" });
        rect.set({ rx: bh / 2, ry: bh / 2, slot: rectSlot } as Partial<FabricObject>);
        parts.push({ objs: [...(keep(rectSlot) ? [rect] : []), ...(keep(labelSlot) ? [label] : [])], w: bw, h: bh });
      });
      const gap = el.gap * S;
      const total = parts.reduce((s, p) => s + p.h, 0) + gap * Math.max(0, parts.length - 1);
      const boxTop = el.box.y * H;
      let y = el.valign === "center" ? boxTop + Math.max(0, (el.box.h * H - total) / 2) : boxTop;
      for (const p of parts) {
        const x = el.align === "center" ? (el.box.x + el.box.w / 2) * W : el.box.x * W + p.w / 2;
        for (const obj of p.objs) {
          obj.set({ left: x, top: y + p.h / 2 });
          obj.setCoords();
          c.add(obj);
        }
        y += p.h + gap;
      }
    }
  }
}
