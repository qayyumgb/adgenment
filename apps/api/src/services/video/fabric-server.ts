import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { createCanvas, GlobalFonts, Image } from "@napi-rs/canvas";
import { registerFrameImage } from "./frame-image";

/**
 * Fabric.js on the server (plan C20a), so a design renders outside a browser
 * exactly as the editor draws it.
 *
 * Fabric's normal build runs on `@napi-rs/canvas` (Skia, the engine Chrome
 * draws with) through a small stand-in for the browser's `document`: Fabric
 * only ever asks it for canvas and image elements. No jsdom, no node-canvas
 * (which can't load custom fonts on Windows and needs compiling on Alpine).
 *
 * - **Images:** a design refers to its files as "asset:<id>"; the stand-in
 *   image fetches the bytes through `setAssetLoader` (file storage).
 * - **Fonts:** the editor's Google Fonts, downloaded once as TTF, kept on
 *   disk and registered with Skia before a design is drawn.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const fabric = require("fabric") as any;

type AssetLoader = (id: string) => Promise<Buffer | null>;
let loadAsset: AssetLoader = async () => null;
/** Where "asset:<id>" images come from, for the render in progress. */
export function setAssetLoader(fn: AssetLoader) {
  loadAsset = fn;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = any;
/** The few DOM members Fabric touches on an element. */
function dress(el: El): El {
  const attrs: Record<string, string> = {};
  return Object.assign(el, {
    style: {},
    classList: { add() {}, remove() {}, contains: () => false },
    setAttribute: (k: string, v: unknown) => void (attrs[k] = String(v)),
    getAttribute: (k: string) => attrs[k] ?? null,
    hasAttribute: (k: string) => k in attrs,
    removeAttribute: (k: string) => void delete attrs[k],
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: el.width ?? 0, height: el.height ?? 0 }),
    ownerDocument: doc,
    parentNode: null,
  });
}

/** An <img> stand-in: a real Skia image whose `src` is fetched by us. */
function makeImage(): El {
  const img = dress(new Image()) as El;
  const proto = Object.getPrototypeOf(img);
  const native = Object.getOwnPropertyDescriptor(proto, "src");
  let current = "";
  Object.defineProperty(img, "src", {
    configurable: true,
    get: () => current,
    set(value: unknown) {
      current = typeof value === "string" ? value : "";
      if (!current) return;
      void (async () => {
        try {
          let bytes: Buffer | null = null;
          if (current.startsWith("asset:")) bytes = await loadAsset(current.slice(6));
          else if (current.startsWith("data:")) bytes = Buffer.from(current.slice(current.indexOf(",") + 1), "base64");
          if (!bytes) throw new Error("image not available");
          // Decoding fires the image's own onload / onerror (set by Fabric).
          let settled = false;
          const onload = img.onload;
          const onerror = img.onerror;
          img.onload = () => {
            settled = true;
            onload?.call(img);
          };
          img.onerror = (e: unknown) => {
            settled = true;
            onerror?.call(img, e);
          };
          native!.set!.call(img, bytes);
          // Older builds decode synchronously without calling onload.
          setImmediate(() => {
            if (!settled && img.width > 0) {
              settled = true;
              onload?.call(img);
            }
          });
        } catch (err) {
          img.onerror?.call(img, err);
        }
      })();
    },
  });
  return img;
}

const doc: El = {
  createElement(tag: string) {
    if (tag === "canvas") return dress(createCanvas(300, 150));
    if (tag === "img") return makeImage();
    return dress({ width: 0, height: 0, appendChild() {} });
  },
  documentElement: { clientLeft: 0, clientTop: 0, scrollLeft: 0, scrollTop: 0, style: {} },
  body: { scrollLeft: 0, scrollTop: 0 },
  addEventListener() {},
  removeEventListener() {},
};
const win: El = {
  document: doc,
  devicePixelRatio: 1,
  requestAnimationFrame: (f: (t: number) => void) => setTimeout(() => f(Date.now()), 0),
  cancelAnimationFrame: (id: NodeJS.Timeout) => clearTimeout(id),
  getComputedStyle: () => ({}),
  addEventListener() {},
  removeEventListener() {},
};
doc.defaultView = win;

let ready = false;
/** Fabric, set up for the server (once per process). */
export function serverFabric() {
  if (!ready) {
    fabric.setEnv({ document: doc, window: win, isTouchSupported: false, WebGLProbe: { queryWebGL() {}, isSupported: () => false }, dispose() {}, copyPasteData: {} });
    // The editor's extra properties, so they survive loading (apps/web editor/canvas.ts) plus motion.
    fabric.FabricObject.customProperties = ["assetId", "name", "locked", "slot", "anim"];
    registerFrameImage(fabric);
    ready = true;
  }
  return fabric;
}

/** A canvas element of the design's size, for a Fabric StaticCanvas. */
export function makeCanvasElement(width: number, height: number) {
  return dress(createCanvas(width, height));
}

/* ───────────────────────── Fonts ───────────────────────── */

/** The editor's font list (apps/web/components/app/editor/fonts.ts). Anything else draws in the default. */
const FONT_WEIGHTS: Record<string, number[]> = {
  Inter: [400, 600, 700, 800],
  Poppins: [400, 600, 700, 800],
  Montserrat: [400, 600, 700, 800],
  "DM Sans": [400, 700],
  Roboto: [400, 700],
  Lato: [400, 700],
  "Space Grotesk": [400, 700],
  "Bebas Neue": [400],
  Anton: [400],
  Oswald: [400, 700],
  "Archivo Black": [400],
  "Playfair Display": [400, 700],
  Merriweather: [400, 700],
  "DM Serif Display": [400],
  Pacifico: [400],
  "Dancing Script": [400, 700],
  Caveat: [400, 700],
};
export const DEFAULT_FONT = "Inter";

const FONT_DIR = process.env.VIDEO_FONT_DIR || path.join(os.tmpdir(), "advertix-fonts");
const registered = new Map<string, Promise<boolean>>();

const toWeight = (w: unknown) => (w === "bold" ? 700 : w === "normal" || w == null ? 400 : Number(w) || 400);
const nearest = (family: string, want: number) => FONT_WEIGHTS[family].reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best));

async function fetchFont(family: string, weight: number, italic: boolean): Promise<Buffer | null> {
  const spec = `${family.replace(/ /g, "+")}:${italic ? `ital,wght@1,${weight}` : `wght@${weight}`}`;
  // Without a browser's User-Agent, Google Fonts answers with a plain TTF link.
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${spec}`, { headers: { "User-Agent": "Mozilla/4.0" } }).then((r) => (r.ok ? r.text() : null));
  const url = css?.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
  if (!url) return null;
  const file = await fetch(url);
  return file.ok ? Buffer.from(await file.arrayBuffer()) : null;
}

/**
 * Make one font drawable: from disk if it was downloaded before, else from
 * Google Fonts. Never throws: a font that can't be had draws as the default.
 */
export function ensureFont(familyRaw: unknown, weightRaw?: unknown, italic = false): Promise<boolean> {
  const family = typeof familyRaw === "string" && FONT_WEIGHTS[familyRaw] ? familyRaw : DEFAULT_FONT;
  const weight = nearest(family, toWeight(weightRaw));
  const key = `${family}|${weight}|${italic ? "i" : "n"}`;
  let p = registered.get(key);
  if (!p) {
    p = (async () => {
      const file = path.join(FONT_DIR, `${family.replace(/ /g, "")}-${weight}${italic ? "i" : ""}.ttf`);
      try {
        let bytes: Buffer | null = await fs.readFile(file).catch(() => null);
        if (!bytes) {
          bytes = await fetchFont(family, weight, italic);
          if (!bytes) {
            // No italic cut for this family: the upright one, drawn as is.
            if (italic) return ensureFont(family, weight, false);
            return false;
          }
          await fs.mkdir(FONT_DIR, { recursive: true });
          await fs.writeFile(file, bytes);
        }
        return Boolean(GlobalFonts.registerFromPath(file, family));
      } catch (err) {
        console.warn(`[video] font ${key}:`, err instanceof Error ? err.message : err);
        return false;
      }
    })();
    registered.set(key, p);
    // A failed download can be tried again by a later render.
    void p.then((ok) => !ok && registered.delete(key));
  }
  return p;
}
