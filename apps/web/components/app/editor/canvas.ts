import { FabricObject, type Canvas } from "fabric";

/**
 * Canvas helpers for the creative editor (plan C19a). Fabric 7 places
 * objects by their centre (origin "center"); everything here works in the
 * design's own pixels (the canvas zoom only scales the view).
 */

/** Saved with every object: the R2 file it shows, its layer name, whether it's locked, and (C19b) which template part it came from ("<template>|<element>|<item>|<part>", used by resize). */
export const EXTRA_PROPS = ["assetId", "name", "locked", "slot"];
FabricObject.customProperties = EXTRA_PROPS;

// Selection handles in the Advertix style.
Object.assign(FabricObject.ownDefaults, {
  borderColor: "#6448f2",
  cornerColor: "#ffffff",
  cornerStrokeColor: "#6448f2",
  cornerStyle: "circle",
  transparentCorners: false,
  cornerSize: 11,
  borderScaleFactor: 1.5,
  padding: 0,
});

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function walk(node: unknown, fn: (o: Json) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, fn));
  else if (isObj(node)) {
    fn(node);
    if (Array.isArray(node.objects)) walk(node.objects, fn);
  }
}

/** The design as saved: images point at their file ("asset:<id>"), never at a link that expires. */
export function serialize(canvas: Canvas): Json {
  const json = canvas.toObject(EXTRA_PROPS) as Json;
  walk(json.objects, (o) => {
    if (typeof o.assetId === "string" && typeof o.src === "string") o.src = `asset:${o.assetId}`;
  });
  return json;
}

/** Ready to load: file references become signed links (CORS, so export works); missing files are dropped. */
export function hydrate(data: Json, links: Record<string, string>): Json {
  const json = JSON.parse(JSON.stringify(data ?? {})) as Json;
  const keep = (list: unknown): unknown =>
    Array.isArray(list)
      ? list.filter((o) => !(isObj(o) && typeof o.src === "string" && o.src.startsWith("asset:") && !links[o.src.slice(6)]))
      : list;
  json.objects = keep(json.objects);
  walk(json.objects, (o) => {
    if (typeof o.src === "string" && o.src.startsWith("asset:")) {
      o.src = links[o.src.slice(6)];
      o.crossOrigin = "anonymous";
    }
    if (Array.isArray(o.objects)) o.objects = keep(o.objects) as unknown[];
  });
  return json;
}

/** Fonts the design uses (to load before it renders). */
export function fontsIn(data: Json): { family: string; weight: string | number; italic: boolean }[] {
  const out: { family: string; weight: string | number; italic: boolean }[] = [];
  walk(data.objects, (o) => {
    if (typeof o.fontFamily === "string") out.push({ family: o.fontFamily, weight: (o.fontWeight as string | number) ?? 400, italic: o.fontStyle === "italic" });
  });
  return out;
}

const KIND: Record<string, string> = { textbox: "Text", "i-text": "Text", text: "Text", image: "Image", rect: "Rectangle", circle: "Circle", line: "Line", group: "Group", activeselection: "Selection" };
/** A layer's label: its name, or its kind and first words. */
export function layerName(o: FabricObject): string {
  const named = (o as FabricObject & { name?: string }).name;
  const kind = KIND[o.type?.toLowerCase() ?? ""] ?? "Layer";
  const text = (o as FabricObject & { text?: string }).text;
  if (typeof text === "string" && text.trim()) return `${named && named !== "Text" ? named : "Text"}: ${text.trim().split(/\s+/).slice(0, 4).join(" ")}`;
  return named || kind;
}

export const isLocked = (o: FabricObject) => Boolean((o as FabricObject & { locked?: boolean }).locked);

/** Lock or unlock: it stays selectable (so it can be unlocked from Layers) but can't move or change. */
export function setLocked(o: FabricObject, locked: boolean) {
  o.set({ locked, lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, hasControls: !locked } as Partial<FabricObject>);
}

/** The object's box on the design (axis-aligned, includes rotation). */
function box(o: FabricObject) {
  const r = o.getBoundingRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export type Align = "left" | "center" | "right" | "top" | "middle" | "bottom";
/** Align an object to the design's edges or centre. */
export function alignTo(o: FabricObject, align: Align, w: number, h: number) {
  const b = box(o);
  const dx = align === "left" ? -b.left : align === "center" ? w / 2 - (b.left + b.width / 2) : align === "right" ? w - (b.left + b.width) : 0;
  const dy = align === "top" ? -b.top : align === "middle" ? h / 2 - (b.top + b.height / 2) : align === "bottom" ? h - (b.top + b.height) : 0;
  o.set({ left: (o.left ?? 0) + dx, top: (o.top ?? 0) + dy });
  o.setCoords();
}

export type Guides = { v: number[]; h: number[] };
/**
 * Snap a moving object to the design's edges and centre lines (within
 * `threshold` design pixels). Returns the guide lines to draw.
 */
export function snap(o: FabricObject, w: number, h: number, threshold: number): Guides {
  const b = box(o);
  const guides: Guides = { v: [], h: [] };
  const xs: [number, number][] = [
    [b.left, 0],
    [b.left + b.width / 2, w / 2],
    [b.left + b.width, w],
  ];
  const ys: [number, number][] = [
    [b.top, 0],
    [b.top + b.height / 2, h / 2],
    [b.top + b.height, h],
  ];
  const bestX = xs.map(([at, to]) => ({ d: to - at, to })).filter((x) => Math.abs(x.d) <= threshold).sort((a, c) => Math.abs(a.d) - Math.abs(c.d))[0];
  const bestY = ys.map(([at, to]) => ({ d: to - at, to })).filter((x) => Math.abs(x.d) <= threshold).sort((a, c) => Math.abs(a.d) - Math.abs(c.d))[0];
  if (bestX) {
    o.set({ left: (o.left ?? 0) + bestX.d });
    guides.v.push(bestX.to);
  }
  if (bestY) {
    o.set({ top: (o.top ?? 0) + bestY.d });
    guides.h.push(bestY.to);
  }
  if (bestX || bestY) o.setCoords();
  return guides;
}

/** Scale an image to fit inside (or cover) a w×h box. */
export function fitScale(imgW: number, imgH: number, w: number, h: number, mode: "contain" | "cover") {
  const sx = w / imgW;
  const sy = h / imgH;
  return mode === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
}

export async function dataUrlToBlob(url: string) {
  return (await fetch(url)).blob();
}
