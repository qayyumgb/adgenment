import { FabricImage, classRegistry, type FabricObject } from "fabric";
import { shapePathD, type ShapeKind } from "./shapes";

/**
 * Frames for the creative editor (plan C19a), like Canva's: a shape that
 * holds a photo. The photo always covers the frame without stretching —
 * resizing the frame (even to a new aspect) re-fills it instead of
 * squashing the photo. Inside the frame the photo can be repositioned
 * (focus point) and zoomed. An empty frame shows "Drop an image".
 *
 * A frame is one object: its box is width × height (scale is folded back in
 * after every resize), it draws its own photo, and it's saved like an image
 * (`src` → "asset:<id>") plus `frame` (the shape), `empty`, `focusX/Y` (0–1)
 * and `zoom` (≥ 1).
 */

const FRAME_PROPS = ["frame", "empty", "focusX", "focusY", "zoom"];

function blank() {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 2;
  return c;
}

export class FrameImage extends FabricImage {
  static type = "FrameImage";
  declare frame: ShapeKind;
  declare empty: boolean;
  declare focusX: number;
  declare focusY: number;
  declare zoom: number;
  /** While an image is dragged over it (not saved). */
  declare hover: boolean;

  constructor(element?: HTMLImageElement | HTMLCanvasElement, options: Record<string, unknown> = {}) {
    super(element ?? blank(), options);
    this.frame = (options.frame as ShapeKind) ?? "rounded";
    this.empty = options.empty === undefined ? !element : Boolean(options.empty);
    this.focusX = typeof options.focusX === "number" ? options.focusX : 0.5;
    this.focusY = typeof options.focusY === "number" ? options.focusY : 0.5;
    this.zoom = typeof options.zoom === "number" ? options.zoom : 1;
    this.hover = false;
    this.objectCaching = false;
  }

  toObject(propertiesToInclude: any[] = []): any {
    const o = super.toObject([...propertiesToInclude, ...FRAME_PROPS] as never[]) as unknown as Record<string, unknown>;
    // An empty frame has nothing to load.
    if (this.empty) delete o.assetId;
    return o;
  }

  /** The photo's drawn size and offset inside a bw × bh box (cover, then zoom, centred on the focus point). */
  layout(bw: number, bh: number) {
    const el = this.getElement() as HTMLImageElement;
    const iw = el.naturalWidth || el.width || 1;
    const ih = el.naturalHeight || el.height || 1;
    const s = Math.max(bw / iw, bh / ih) * Math.max(1, this.zoom);
    const dw = iw * s;
    const dh = ih * s;
    const x = Math.min(-bw / 2, Math.max(bw / 2 - dw, -this.focusX * dw));
    const y = Math.min(-bh / 2, Math.max(bh / 2 - dh, -this.focusY * dh));
    return { dw, dh, x, y };
  }

  _render(ctx: CanvasRenderingContext2D) {
    const sx = this.scaleX || 1;
    const sy = this.scaleY || 1;
    const bw = this.width * Math.abs(sx);
    const bh = this.height * Math.abs(sy);
    ctx.save();
    // Draw in the box's own pixels, so a non-uniform resize never stretches the photo.
    ctx.scale(1 / sx, 1 / sy);
    const path = new Path2D(shapePathD(this.frame, bw, bh));
    if (this.empty) {
      ctx.fillStyle = "#eceef3";
      ctx.fill(path);
      ctx.setLineDash([Math.max(6, bw / 40), Math.max(5, bw / 55)]);
      ctx.lineWidth = Math.max(2, Math.min(bw, bh) / 160);
      ctx.strokeStyle = "#9ca3af";
      ctx.stroke(path);
      ctx.setLineDash([]);
      const fs = Math.max(12, Math.min(bw, bh) * 0.075);
      ctx.fillStyle = "#6b7280";
      ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Drop an image", 0, 0);
    } else {
      ctx.save();
      ctx.clip(path);
      const { dw, dh, x, y } = this.layout(bw, bh);
      ctx.drawImage(this.getElement() as CanvasImageSource, x, y, dw, dh);
      ctx.restore();
    }
    if (this.hover) {
      ctx.lineWidth = Math.max(4, Math.min(bw, bh) / 90);
      ctx.strokeStyle = "#6448f2";
      ctx.stroke(path);
    }
    ctx.restore();
  }

  /** Fold a resize into the box, so the next one starts from real pixels. */
  bakeScale() {
    const w = this.width * Math.abs(this.scaleX);
    const h = this.height * Math.abs(this.scaleY);
    this.set({ width: w, height: h, scaleX: Math.sign(this.scaleX) || 1, scaleY: Math.sign(this.scaleY) || 1 });
    this.setCoords();
  }

  /** Put a photo in the frame (keeps the frame's size and place). */
  setPhoto(el: HTMLImageElement, assetId: string) {
    const w = this.width * Math.abs(this.scaleX);
    const h = this.height * Math.abs(this.scaleY);
    this.setElement(el, { width: w, height: h });
    this.set({ scaleX: 1, scaleY: 1, empty: false, assetId, focusX: 0.5, focusY: 0.5, zoom: 1, dirty: true } as Partial<FrameImage>);
    this.setCoords();
  }

  /** Take the photo out (the frame stays, empty). */
  clearPhoto() {
    const w = this.width * Math.abs(this.scaleX);
    const h = this.height * Math.abs(this.scaleY);
    this.setElement(blank(), { width: w, height: h });
    this.set({ scaleX: 1, scaleY: 1, empty: true, assetId: undefined, dirty: true } as Partial<FrameImage>);
    this.setCoords();
  }

  /** Move the photo inside the frame by (dx, dy) design pixels. */
  pan(dx: number, dy: number) {
    const bw = this.width * Math.abs(this.scaleX);
    const bh = this.height * Math.abs(this.scaleY);
    const { dw, dh } = this.layout(bw, bh);
    // The focus point is what sits at the frame's centre; keep it where the photo still covers the frame.
    const minX = bw / 2 / dw;
    const minY = bh / 2 / dh;
    this.focusX = Math.min(1 - minX, Math.max(minX, this.focusX - dx / dw));
    this.focusY = Math.min(1 - minY, Math.max(minY, this.focusY - dy / dh));
    this.set({ dirty: true });
  }
}
classRegistry.setClass(FrameImage);

export const isFrame = (o: FabricObject | null | undefined): o is FrameImage => o instanceof FrameImage;

/** A new empty frame of the given shape and size. */
export function makeFrame(kind: ShapeKind, w: number, h: number) {
  return new FrameImage(undefined, { frame: kind, width: w, height: h, name: "Frame" });
}
