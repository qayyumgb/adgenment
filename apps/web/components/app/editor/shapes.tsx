import { Circle, Ellipse, Line, Path, Polygon, Rect, type FabricObject } from "fabric";

/**
 * Shapes for the creative editor (plan C19a): drawn as layers, or used as a
 * crop for an image ("Crop to shape": the image is clipped to the shape and
 * keeps moving, scaling and rotating with it). Every shape is defined in a
 * unit box (−0.5…0.5) and scaled to size, so previews and canvas match.
 */

export type ShapeKind =
  | "rect"
  | "rounded"
  | "circle"
  | "oval"
  | "triangle"
  | "diamond"
  | "pentagon"
  | "hexagon"
  | "star"
  | "heart"
  | "arch"
  | "arrow"
  | "slanted"
  | "line"
  | "diagonal";

type XY = { x: number; y: number };
const regular = (n: number, r = 0.5, start = -Math.PI / 2): [number, number][] => Array.from({ length: n }, (_, i) => [r * Math.cos(start + (i * 2 * Math.PI) / n), r * Math.sin(start + (i * 2 * Math.PI) / n)]);
const star = (): [number, number][] => Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 0.2 : 0.5;
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  return [r * Math.cos(a), r * Math.sin(a)];
});

/** Polygon corners in the unit box. */
const POLY: Partial<Record<ShapeKind, [number, number][]>> = {
  triangle: [[0, -0.5], [0.5, 0.5], [-0.5, 0.5]],
  diamond: [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]],
  pentagon: regular(5),
  hexagon: regular(6, 0.5, 0),
  star: star(),
  arrow: [[-0.5, -0.17], [0.1, -0.17], [0.1, -0.4], [0.5, 0], [0.1, 0.4], [0.1, 0.17], [-0.5, 0.17]],
  slanted: [[-0.25, -0.5], [0.5, -0.5], [0.25, 0.5], [-0.5, 0.5]],
};

/** Curved shapes as SVG paths, scaled to w×h. */
function pathFor(kind: "heart" | "arch", w: number, h: number) {
  const X = (v: number) => (v * w).toFixed(2);
  const Y = (v: number) => (v * h).toFixed(2);
  if (kind === "heart") {
    return `M ${X(0)} ${Y(0.42)} C ${X(-0.55)} ${Y(0.05)} ${X(-0.5)} ${Y(-0.38)} ${X(-0.25)} ${Y(-0.45)} C ${X(-0.1)} ${Y(-0.49)} ${X(0)} ${Y(-0.38)} ${X(0)} ${Y(-0.27)} C ${X(0)} ${Y(-0.38)} ${X(0.1)} ${Y(-0.49)} ${X(0.25)} ${Y(-0.45)} C ${X(0.5)} ${Y(-0.38)} ${X(0.55)} ${Y(0.05)} ${X(0)} ${Y(0.42)} Z`;
  }
  // Arch: a half-circle top on straight sides (needs h ≥ w/2).
  const r = w / 2;
  const top = -h / 2 + r;
  return `M ${(-w / 2).toFixed(2)} ${(h / 2).toFixed(2)} L ${(-w / 2).toFixed(2)} ${top.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${(w / 2).toFixed(2)} ${top.toFixed(2)} L ${(w / 2).toFixed(2)} ${(h / 2).toFixed(2)} Z`;
}

const pts = (kind: ShapeKind, w: number, h: number): XY[] => (POLY[kind] ?? []).map(([x, y]) => ({ x: x * w, y: y * h }));

export const SHAPES: { kind: ShapeKind; label: string }[] = [
  { kind: "rect", label: "Rectangle" },
  { kind: "rounded", label: "Rounded box (button)" },
  { kind: "circle", label: "Circle" },
  { kind: "oval", label: "Oval" },
  { kind: "triangle", label: "Triangle" },
  { kind: "diamond", label: "Diamond" },
  { kind: "pentagon", label: "Pentagon" },
  { kind: "hexagon", label: "Hexagon" },
  { kind: "star", label: "Star" },
  { kind: "heart", label: "Heart" },
  { kind: "arch", label: "Arch" },
  { kind: "arrow", label: "Arrow" },
  { kind: "slanted", label: "Slanted banner" },
  { kind: "line", label: "Line" },
  { kind: "diagonal", label: "Diagonal line" },
];
/** Shapes an image can be cropped to (lines can't hold an image). */
export const CROP_SHAPES = SHAPES.filter((s) => s.kind !== "line" && s.kind !== "diagonal" && s.kind !== "rect");
const SQUARE: ShapeKind[] = ["circle", "triangle", "diamond", "pentagon", "hexagon", "star", "heart"];

/** A shape layer of size w×h (lines: length w), placed by the caller. */
export function makeShape(kind: ShapeKind, w: number, h: number, props: Record<string, unknown> = {}): FabricObject {
  const label = SHAPES.find((s) => s.kind === kind)?.label ?? "Shape";
  const base = { fill: "#6448f2", name: kind === "rounded" ? "Button" : label, ...props };
  const s = Math.min(w, h);
  switch (kind) {
    case "rect":
      return new Rect({ width: w, height: h, ...base });
    case "rounded":
      return new Rect({ width: w, height: h, rx: s * 0.18, ry: s * 0.18, ...base, fill: (props.fill as string) ?? "#111827" });
    case "circle":
      return new Circle({ radius: s / 2, ...base });
    case "oval":
      return new Ellipse({ rx: w / 2, ry: h / 2, ...base });
    case "heart":
    case "arch":
      return new Path(pathFor(kind, kind === "arch" ? w : s, kind === "arch" ? Math.max(h, w / 2) : s), base);
    case "line":
      return new Line([-w / 2, 0, w / 2, 0], { stroke: "#111827", strokeWidth: Math.max(4, w * 0.012), ...props, name: label, fill: undefined });
    case "diagonal":
      return new Line([-w / 2, h / 2, w / 2, -h / 2], { stroke: "#111827", strokeWidth: Math.max(4, w * 0.012), ...props, name: label, fill: undefined });
    default:
      return new Polygon(pts(kind, SQUARE.includes(kind) ? s : w, SQUARE.includes(kind) ? s : h), base);
  }
}

/**
 * The crop for an image of (unscaled) size w×h, in the image's own space, so
 * it moves, scales and rotates with the image. Symmetric shapes take the
 * largest centred square; boxes, ovals, arches and banners use the whole image.
 */
export function makeClip(kind: ShapeKind, w: number, h: number): FabricObject {
  const o = makeShape(kind, w, h, { fill: "#000", left: 0, top: 0 });
  o.set({ left: 0, top: 0, originX: "center", originY: "center" });
  return o;
}

/** Shapes a frame can take (a photo fills it). */
export const FRAME_SHAPES = SHAPES.filter((s) => s.kind !== "line" && s.kind !== "diagonal");

/**
 * The shape's outline as an SVG path of size w×h centred on 0,0 (frames clip
 * their photo to it). Symmetric shapes use the largest centred square.
 */
export function shapePathD(kind: ShapeKind, w: number, h: number): string {
  const s = Math.min(w, h);
  const f = (n: number) => n.toFixed(2);
  if (kind === "rect") return `M ${f(-w / 2)} ${f(-h / 2)} H ${f(w / 2)} V ${f(h / 2)} H ${f(-w / 2)} Z`;
  if (kind === "rounded") {
    const r = Math.min(s * 0.18, w / 2, h / 2);
    return `M ${f(-w / 2 + r)} ${f(-h / 2)} H ${f(w / 2 - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(w / 2)} ${f(-h / 2 + r)} V ${f(h / 2 - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(w / 2 - r)} ${f(h / 2)} H ${f(-w / 2 + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(-w / 2)} ${f(h / 2 - r)} V ${f(-h / 2 + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(-w / 2 + r)} ${f(-h / 2)} Z`;
  }
  if (kind === "circle") return `M ${f(-s / 2)} 0 A ${f(s / 2)} ${f(s / 2)} 0 1 0 ${f(s / 2)} 0 A ${f(s / 2)} ${f(s / 2)} 0 1 0 ${f(-s / 2)} 0 Z`;
  if (kind === "oval") return `M ${f(-w / 2)} 0 A ${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(w / 2)} 0 A ${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(-w / 2)} 0 Z`;
  if (kind === "heart") return pathFor("heart", s, s);
  if (kind === "arch") return pathFor("arch", w, Math.max(h, w / 2));
  const p = pts(kind, SQUARE.includes(kind) ? s : w, SQUARE.includes(kind) ? s : h);
  return p.length ? `M ${p.map((q) => `${f(q.x)} ${f(q.y)}`).join(" L ")} Z` : `M ${f(-w / 2)} ${f(-h / 2)} H ${f(w / 2)} V ${f(h / 2)} H ${f(-w / 2)} Z`;
}

/** The shape as a tiny SVG (buttons and menus). */
export function ShapeIcon({ kind, size = 18 }: { kind: ShapeKind; size?: number }) {
  const common = { fill: "currentColor" };
  let el: JSX.Element;
  if (kind === "rect") el = <rect x={-0.42} y={-0.3} width={0.84} height={0.6} {...common} />;
  else if (kind === "rounded") el = <rect x={-0.45} y={-0.22} width={0.9} height={0.44} rx={0.12} {...common} />;
  else if (kind === "circle") el = <circle r={0.42} {...common} />;
  else if (kind === "oval") el = <ellipse rx={0.46} ry={0.3} {...common} />;
  else if (kind === "heart" || kind === "arch") el = <path d={pathFor(kind, 0.86, 0.86)} {...common} />;
  else if (kind === "line") el = <line x1={-0.45} y1={0} x2={0.45} y2={0} stroke="currentColor" strokeWidth={0.1} strokeLinecap="round" />;
  else if (kind === "diagonal") el = <line x1={-0.4} y1={0.4} x2={0.4} y2={-0.4} stroke="currentColor" strokeWidth={0.1} strokeLinecap="round" />;
  else el = <polygon points={pts(kind, 0.86, 0.86).map((p) => `${p.x},${p.y}`).join(" ")} {...common} />;
  return (
    <svg width={size} height={size} viewBox="-0.5 -0.5 1 1" aria-hidden="true">
      {el}
    </svg>
  );
}
