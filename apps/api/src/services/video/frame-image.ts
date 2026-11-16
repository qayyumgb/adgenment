import { Path2D } from "@napi-rs/canvas";

/**
 * The editor's photo frame ("FrameImage") for the server render (plan C20a).
 *
 * KEEP IN SYNC with apps/web/components/app/editor/frames.ts (layout and
 * drawing) and shapes.tsx (`shapePathD`): a frame must draw the same in the
 * editor and in the rendered video. Only what drawing needs is here; the
 * editing methods stay in the editor.
 *
 * One difference on purpose: an empty frame draws nothing (the editor shows
 * a "Drop an image" placeholder, which doesn't belong in a finished ad).
 */

type XY = [number, number];
const regular = (n: number, r = 0.5, start = -Math.PI / 2): XY[] => Array.from({ length: n }, (_, i) => [r * Math.cos(start + (i * 2 * Math.PI) / n), r * Math.sin(start + (i * 2 * Math.PI) / n)]);
const star = (): XY[] =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 0.2 : 0.5;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
const POLY: Record<string, XY[]> = {
  triangle: [[0, -0.5], [0.5, 0.5], [-0.5, 0.5]],
  diamond: [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]],
  pentagon: regular(5),
  hexagon: regular(6, 0.5, 0),
  star: star(),
  arrow: [[-0.5, -0.17], [0.1, -0.17], [0.1, -0.4], [0.5, 0], [0.1, 0.4], [0.1, 0.17], [-0.5, 0.17]],
  slanted: [[-0.25, -0.5], [0.5, -0.5], [0.25, 0.5], [-0.5, 0.5]],
};
const SQUARE = ["circle", "triangle", "diamond", "pentagon", "hexagon", "star", "heart"];

function pathFor(kind: "heart" | "arch", w: number, h: number) {
  const X = (v: number) => (v * w).toFixed(2);
  const Y = (v: number) => (v * h).toFixed(2);
  if (kind === "heart") {
    return `M ${X(0)} ${Y(0.42)} C ${X(-0.55)} ${Y(0.05)} ${X(-0.5)} ${Y(-0.38)} ${X(-0.25)} ${Y(-0.45)} C ${X(-0.1)} ${Y(-0.49)} ${X(0)} ${Y(-0.38)} ${X(0)} ${Y(-0.27)} C ${X(0)} ${Y(-0.38)} ${X(0.1)} ${Y(-0.49)} ${X(0.25)} ${Y(-0.45)} C ${X(0.5)} ${Y(-0.38)} ${X(0.55)} ${Y(0.05)} ${X(0)} ${Y(0.42)} Z`;
  }
  const r = w / 2;
  const top = -h / 2 + r;
  return `M ${(-w / 2).toFixed(2)} ${(h / 2).toFixed(2)} L ${(-w / 2).toFixed(2)} ${top.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${(w / 2).toFixed(2)} ${top.toFixed(2)} L ${(w / 2).toFixed(2)} ${(h / 2).toFixed(2)} Z`;
}

/** The shape's outline as an SVG path of size w×h centred on 0,0. */
export function shapePathD(kind: string, w: number, h: number): string {
  const s = Math.min(w, h);
  const f = (n: number) => n.toFixed(2);
  const box = `M ${f(-w / 2)} ${f(-h / 2)} H ${f(w / 2)} V ${f(h / 2)} H ${f(-w / 2)} Z`;
  if (kind === "rect") return box;
  if (kind === "rounded") {
    const r = Math.min(s * 0.18, w / 2, h / 2);
    return `M ${f(-w / 2 + r)} ${f(-h / 2)} H ${f(w / 2 - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(w / 2)} ${f(-h / 2 + r)} V ${f(h / 2 - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(w / 2 - r)} ${f(h / 2)} H ${f(-w / 2 + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(-w / 2)} ${f(h / 2 - r)} V ${f(-h / 2 + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(-w / 2 + r)} ${f(-h / 2)} Z`;
  }
  if (kind === "circle") return `M ${f(-s / 2)} 0 A ${f(s / 2)} ${f(s / 2)} 0 1 0 ${f(s / 2)} 0 A ${f(s / 2)} ${f(s / 2)} 0 1 0 ${f(-s / 2)} 0 Z`;
  if (kind === "oval") return `M ${f(-w / 2)} 0 A ${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(w / 2)} 0 A ${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(-w / 2)} 0 Z`;
  if (kind === "heart") return pathFor("heart", s, s);
  if (kind === "arch") return pathFor("arch", w, Math.max(h, w / 2));
  const square = SQUARE.includes(kind);
  const p = (POLY[kind] ?? []).map(([x, y]) => [x * (square ? s : w), y * (square ? s : h)]);
  return p.length ? `M ${p.map((q) => `${f(q[0])} ${f(q[1])}`).join(" L ")} Z` : box;
}

/** Add the FrameImage class to a Fabric set up for the server. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerFrameImage(fabric: any) {
  class FrameImage extends fabric.FabricImage {
    static type = "FrameImage";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(element: any, options: Record<string, unknown> = {}) {
      super(element, options);
      const self = this as unknown as Record<string, unknown>;
      self.frame = typeof options.frame === "string" ? options.frame : "rounded";
      self.empty = options.empty === undefined ? !element : Boolean(options.empty);
      self.focusX = typeof options.focusX === "number" ? options.focusX : 0.5;
      self.focusY = typeof options.focusY === "number" ? options.focusY : 0.5;
      self.zoom = typeof options.zoom === "number" ? options.zoom : 1;
      self.objectCaching = false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _render(ctx: any) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const me = this as any;
      if (me.empty) return;
      const sx = me.scaleX || 1;
      const sy = me.scaleY || 1;
      const bw = me.width * Math.abs(sx);
      const bh = me.height * Math.abs(sy);
      const el = me.getElement();
      const iw = el.naturalWidth || el.width || 1;
      const ih = el.naturalHeight || el.height || 1;
      const s = Math.max(bw / iw, bh / ih) * Math.max(1, me.zoom);
      const dw = iw * s;
      const dh = ih * s;
      const x = Math.min(-bw / 2, Math.max(bw / 2 - dw, -me.focusX * dw));
      const y = Math.min(-bh / 2, Math.max(bh / 2 - dh, -me.focusY * dh));
      ctx.save();
      // In the box's own pixels, so a non-uniform resize never stretches the photo.
      ctx.scale(1 / sx, 1 / sy);
      ctx.clip(new Path2D(shapePathD(me.frame, bw, bh)));
      ctx.drawImage(el, x, y, dw, dh);
      ctx.restore();
    }
  }
  fabric.classRegistry.setClass(FrameImage);
  fabric.classRegistry.setClass(FrameImage, "frameimage");
}
