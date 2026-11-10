import { FabricImage, Textbox, type Canvas, type FabricObject } from "fabric";
import { fitScale } from "./canvas";
import { loadFont, nearestWeight } from "./fonts";
import { makeFrame } from "./frames";
import { makeShape } from "./shapes";
import { paint, type Palette, type StackItem, type TEl } from "./templates";

/**
 * Draw a template (templates.ts) onto the editor canvas as ordinary, editable
 * objects: text boxes, shapes, empty photo frames and the brand logo. Text in
 * a stack is measured after its font has loaded, so wrapped headlines push
 * the lines below down instead of overlapping them. The caller clears the
 * canvas first and records one undo step afterwards.
 */

type Opts = { W: number; H: number; pal: Palette; fonts: { heading: string; body: string }; logo: { id: string; url: string } | null };

const BTN_PAD_Y = 0.62;
const BTN_PAD_X = 1.35;

function familyOf(item: StackItem, fonts: Opts["fonts"]) {
  return item.t === "button" ? fonts.body : item.font === "heading" ? fonts.heading : fonts.body;
}
function weightOf(item: StackItem, family: string) {
  return nearestWeight(family, item.t === "button" ? 700 : item.weight);
}

/** Every font the template draws with, loaded before anything is measured. */
export async function loadTemplateFonts(els: TEl[], fonts: Opts["fonts"]) {
  const want = new Set<string>();
  for (const el of els) if (el.t === "stack") for (const it of el.items) {
    const f = familyOf(it, fonts);
    want.add(`${f}|${weightOf(it, f)}`);
  }
  await Promise.all([...want].map((k) => {
    const [f, w] = k.split("|");
    return loadFont(f, Number(w));
  }));
}

export async function renderTemplate(c: Canvas, els: TEl[], o: Opts) {
  const { W, H, pal, fonts } = o;
  const S = Math.min(W, H);
  const center = (b: { x: number; y: number; w: number; h: number }) => ({ left: (b.x + b.w / 2) * W, top: (b.y + b.h / 2) * H });
  await loadTemplateFonts(els, fonts);

  for (const el of els) {
    if (el.t === "bg") {
      c.backgroundColor = paint(pal, el.color);
    } else if (el.t === "shape") {
      const s = makeShape(el.shape, el.box.w * W, el.box.h * H, { fill: paint(pal, el.color), opacity: el.opacity ?? 1, ...(el.name ? { name: el.name } : {}) });
      s.set(center(el.box));
      c.add(s);
    } else if (el.t === "frame") {
      const f = makeFrame(el.shape, el.box.w * W, el.box.h * H);
      f.set(center(el.box));
      c.add(f);
    } else if (el.t === "logo") {
      if (!o.logo) continue;
      const img = await FabricImage.fromURL(o.logo.url, { crossOrigin: "anonymous" });
      const bw = el.box.w * W;
      const bh = el.box.h * H;
      const scale = fitScale(img.width ?? 1, img.height ?? 1, bw, bh, "contain");
      const w = (img.width ?? 1) * scale;
      const x = el.align === "left" ? el.box.x * W + w / 2 : el.align === "right" ? (el.box.x + el.box.w) * W - w / 2 : (el.box.x + el.box.w / 2) * W;
      img.set({ left: x, top: (el.box.y + el.box.h / 2) * H, scaleX: scale, scaleY: scale, assetId: o.logo.id, name: "Logo" } as Partial<FabricImage>);
      c.add(img);
    } else {
      // A stack: build, measure, then place top to bottom.
      const boxW = el.box.w * W;
      const parts: { objs: FabricObject[]; w: number; h: number }[] = el.items.map((it) => {
        const family = familyOf(it, fonts);
        const weight = weightOf(it, family);
        if (it.t === "text") {
          const tb = new Textbox(it.text, { width: boxW, fontSize: Math.round(it.size * S), fontWeight: weight, fontFamily: family, fill: paint(pal, it.color), textAlign: el.align, lineHeight: it.lineHeight ?? 1.2, charSpacing: it.spacing ?? 0, name: it.name ?? "Text" } as Partial<Textbox>);
          return { objs: [tb], w: boxW, h: tb.height ?? 0 };
        }
        const px = Math.round(it.size * S);
        const label = new Textbox(it.text, { width: boxW * 2, fontSize: px, fontWeight: weight, fontFamily: family, fill: paint(pal, it.fg), textAlign: "center", lineHeight: 1, name: `${it.name ?? "Button"} text` } as Partial<Textbox>);
        const tw = Math.ceil(label.calcTextWidth()) + 4;
        label.set({ width: tw });
        label.initDimensions();
        const bw = tw + px * BTN_PAD_X * 2;
        const bh = (label.height ?? px) + px * BTN_PAD_Y * 2;
        const rect = makeShape("rounded", bw, bh, { fill: paint(pal, it.bg), name: it.name ?? "Button" });
        rect.set({ rx: bh / 2, ry: bh / 2 } as Partial<FabricObject>);
        return { objs: [rect, label], w: bw, h: bh };
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
