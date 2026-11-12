import { FabricImage, Textbox, type Canvas, type FabricObject } from "fabric";
import { formatColor, parseColor } from "./ColorPicker";
import { FrameImage } from "./frames";

/**
 * C19c layout suggestions ("Check design"): instant, free checks that catch
 * what usually hurts a static ad on a phone. Each finding points at the
 * object, so "Show" can select it.
 */

export type Finding = { id: string; level: "warn" | "tip"; title: string; detail: string; target: FabricObject | null };

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
function luminance(color: string) {
  const hex = formatColor({ ...parseColor(color), a: 1 });
  const [r, g, b] = rgb(hex).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const nameOf = (o: FabricObject) => (o as FabricObject & { name?: string }).name ?? "";
const short = (t: Textbox) => {
  const s = (t.text ?? "").replace(/\s+/g, " ").trim();
  return s.length > 28 ? `“${s.slice(0, 26)}…”` : `“${s}”`;
};
const overlap = (a: { left: number; top: number; width: number; height: number }, b: typeof a) => {
  const w = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const h = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? (w * h) / Math.min(a.width * a.height, b.width * b.height) : 0;
};

/** What's behind the middle of a text: the colour of the shape under it, "photo", or the background colour. */
function behind(c: Canvas, t: Textbox): string | "photo" {
  const objs = c.getObjects();
  const p = t.getCenterPoint();
  for (let i = objs.indexOf(t) - 1; i >= 0; i--) {
    const o = objs[i];
    if (o.visible === false || o instanceof Textbox || !o.containsPoint(p)) continue;
    if (o instanceof FrameImage) return o.empty ? "#eceef3" : "photo";
    if (o instanceof FabricImage) return "photo";
    if (typeof o.fill === "string" && o.fill && o.fill !== "transparent" && (o.opacity ?? 1) > 0.6) return o.fill;
  }
  return typeof c.backgroundColor === "string" && c.backgroundColor ? c.backgroundColor : "#ffffff";
}

export function checkDesign(c: Canvas, W: number, H: number, opts: { kitHasLogo: boolean }): Finding[] {
  const out: Finding[] = [];
  const S = Math.min(W, H);
  const story = H > W * 1.5;
  const objs = c.getObjects().filter((o) => o.visible !== false);
  const texts = objs.filter((o): o is Textbox => o instanceof Textbox && /\p{L}|\d/u.test(o.text ?? ""));
  const boxes = new Map(objs.map((o) => [o, o.getBoundingRect()]));

  for (const t of texts) {
    const b = boxes.get(t)!;
    const px = (t.fontSize ?? 40) * (t.scaleY ?? 1);
    if (px < S * 0.028) out.push({ id: `small-${out.length}`, level: "warn", title: `Small text: ${short(t)}`, detail: `About ${Math.round(px)} px. On a phone the ad shows at roughly a third of its size, so this is hard to read. Aim for ${Math.ceil(S * 0.035)} px or more.`, target: t });
    const bg = behind(c, t);
    const fill = typeof t.fill === "string" ? t.fill : "#000000";
    if (bg === "photo") out.push({ id: `photo-${out.length}`, level: "tip", title: `Text on a photo: ${short(t)}`, detail: "Check it reads everywhere on the photo; a colour band or a darker photo area behind it helps.", target: t });
    else if (contrast(fill, bg) < 3) out.push({ id: `contrast-${out.length}`, level: "warn", title: `Low contrast: ${short(t)}`, detail: `The text and what's behind it are too alike (${contrast(fill, bg).toFixed(1)}:1; aim for 4.5:1). Make one darker or lighter.`, target: t });
    const m = S * 0.025;
    if (b.left < m || b.top < m || b.left + b.width > W - m || b.top + b.height > H - m) out.push({ id: `edge-${out.length}`, level: "warn", title: `Too close to the edge: ${short(t)}`, detail: "Feeds crop and round the corners slightly; keep text a little further in.", target: t });
    if (story && (b.top < H * 0.14 || b.top + b.height > H * 0.8)) out.push({ id: `safe-${out.length}`, level: "warn", title: `Outside the Stories safe zone: ${short(t)}`, detail: "In Stories and Reels the top 14% and bottom 20% are covered by the profile name, caption and buttons. Move it towards the middle.", target: t });
  }

  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    if (overlap(boxes.get(texts[i])!, boxes.get(texts[j])!) > 0.15) out.push({ id: `overlap-${i}-${j}`, level: "warn", title: `Texts overlap: ${short(texts[i])} and ${short(texts[j])}`, detail: "Move one of them so both read clearly.", target: texts[j] });
  }

  const words = texts.reduce((n, t) => n + (t.text ?? "").split(/\s+/).filter(Boolean).length, 0);
  if (words > 30) out.push({ id: "words", level: "tip", title: `Lots of text (${words} words)`, detail: "Ads with a short headline and a few words usually do better; the rest can go in the ad's primary text on Meta.", target: null });

  for (const o of objs) if (o instanceof FrameImage && o.empty) out.push({ id: `frame-${out.length}`, level: "warn", title: "An empty photo frame", detail: "It shows “Drop an image” in the exported ad. Drop a photo into it, or delete it.", target: o });

  const hasLogo = objs.some((o) => nameOf(o) === "Logo");
  if (opts.kitHasLogo && !hasLogo) out.push({ id: "logo", level: "tip", title: "No logo yet", detail: "Click the logo in the Brand section to add it; ads with a visible brand are recognised faster.", target: null });
  if (!texts.length) out.push({ id: "notext", level: "tip", title: "No text on the ad", detail: "A short headline or offer usually helps people understand the ad at a glance.", target: null });
  return out;
}
