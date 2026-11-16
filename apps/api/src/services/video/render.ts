import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomBytes } from "crypto";
import { FPS, cleanAnim, clampDuration, frameAt, settledAt, type Anim, type Rest } from "../../lib/motion";
import { DEFAULT_FONT, ensureFont, makeCanvasElement, serverFabric, setAssetLoader } from "./fabric-server";

/**
 * Render a design with motion to an MP4 (plan C20a).
 *
 * The design is loaded into Fabric once. For every frame (30 a second) each
 * layer is moved to where `frameAt` says it is, the canvas is drawn, and the
 * raw pixels are piped to ffmpeg, which encodes H.264. One frame is also
 * kept as the poster (the moment every entrance has finished).
 *
 * One render at a time per process (Fabric's server setup is global); the
 * loop gives way to the event loop between frames, so an API instance that
 * renders stays responsive.
 */

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);

export type RenderInput = {
  /** The design as saved (Fabric JSON with "asset:<id>" images and a `motion` block). */
  data: Json;
  width: number;
  height: number;
  /** The bytes of one of the design's images, or null when it's gone. */
  loadAsset: (id: string) => Promise<Buffer | null>;
  onProgress?: (fraction: number) => void | Promise<void>;
  /** Checked between frames: return true to stop (the design was deleted, the server is shutting down). */
  cancelled?: () => boolean;
};
export type RenderOutput = { file: string; poster: Buffer; durationMs: number; frames: number; renderMs: number };

export const ffmpegPath = () => {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bundled = require("ffmpeg-static") as string | null;
    if (bundled) return bundled;
  } catch {
    /* not installed: the system's ffmpeg */
  }
  return "ffmpeg";
};

function walk(node: unknown, fn: (o: Json) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, fn));
  else if (isObj(node)) {
    fn(node);
    if (Array.isArray(node.objects)) walk(node.objects, fn);
  }
}

/** Images whose file is gone are dropped (as the editor does), so one missing photo doesn't fail the video. */
async function prepare(data: Json, loadAsset: RenderInput["loadAsset"]) {
  const json = JSON.parse(JSON.stringify(data ?? {})) as Json;
  const cache = new Map<string, Buffer | null>();
  const ids = new Set<string>();
  walk(json.objects, (o) => typeof o.src === "string" && o.src.startsWith("asset:") && ids.add(o.src.slice(6)));
  if (isObj(json.backgroundImage) && typeof json.backgroundImage.src === "string" && json.backgroundImage.src.startsWith("asset:")) ids.add(json.backgroundImage.src.slice(6));
  await Promise.all([...ids].map(async (id) => cache.set(id, await loadAsset(id).catch(() => null))));
  const gone = (o: unknown) => isObj(o) && typeof o.src === "string" && o.src.startsWith("asset:") && !cache.get(o.src.slice(6));
  const keep = (list: unknown) => (Array.isArray(list) ? list.filter((o) => !gone(o)) : list);
  json.objects = keep(json.objects);
  walk(json.objects, (o) => {
    if (Array.isArray(o.objects)) o.objects = keep(o.objects) as unknown[];
    delete o.crossOrigin;
  });
  if (gone(json.backgroundImage)) delete json.backgroundImage;
  const fonts = new Map<string, { family: unknown; weight: unknown; italic: boolean }>();
  walk(json.objects, (o) => {
    if (typeof o.fontFamily === "string") fonts.set(`${o.fontFamily}|${o.fontWeight}|${o.fontStyle}`, { family: o.fontFamily, weight: o.fontWeight, italic: o.fontStyle === "italic" });
  });
  return { json, cache, fonts: [...fonts.values()] };
}

/** Typewriter: the characters not yet "typed" are drawn transparent, so the text never re-flows while it appears. */
function typeStyles(text: string, rest: Json, shown: number): Json {
  const out: Json = {};
  let n = 0;
  text.split("\n").forEach((line, li) => {
    const chars = Array.from(line);
    const base = (isObj(rest[li]) ? rest[li] : {}) as Json;
    const row: Json = { ...base };
    chars.forEach((_, ci) => {
      if (n >= shown) row[ci] = { ...(isObj(base[ci]) ? (base[ci] as Json) : {}), fill: "rgba(0,0,0,0)", stroke: "rgba(0,0,0,0)" };
      n++;
    });
    n++; // the line break
    if (Object.keys(row).length) out[li] = row;
  });
  return out;
}

let chain: Promise<unknown> = Promise.resolve();
/** Render one design. Calls queue up behind each other. */
export function renderDesignVideo(input: RenderInput): Promise<RenderOutput> {
  const run = chain.then(() => renderNow(input));
  chain = run.catch(() => undefined);
  return run;
}

async function renderNow(input: RenderInput): Promise<RenderOutput> {
  const started = Date.now();
  const { width: W, height: H } = input;
  if (W % 2 || H % 2) throw new Error("Video sizes must be even numbers of pixels.");
  const motion = isObj(input.data.motion) ? input.data.motion : {};
  const duration = clampDuration(motion.duration);
  const frames = Math.round(duration * FPS);

  const fabric = serverFabric();
  const { json, cache, fonts } = await prepare(input.data, input.loadAsset);
  setAssetLoader(async (id) => cache.get(id) ?? null);
  await Promise.all([ensureFont(DEFAULT_FONT, 400), ...fonts.map((f) => ensureFont(f.family, f.weight, f.italic))]);

  const el = makeCanvasElement(W, H);
  const canvas = new fabric.StaticCanvas(el, { width: W, height: H, renderOnAddRemove: false, enableRetinaScaling: false });
  const file = path.join(os.tmpdir(), `advertix-video-${randomBytes(8).toString("hex")}.mp4`);
  try {
    await canvas.loadFromJSON(json);
    // Video has no transparency: an empty background is white, as the exported image is.
    if (!canvas.backgroundColor) canvas.backgroundColor = "#ffffff";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layers = (canvas.getObjects() as any[]).map((o) => {
      const anim: Anim | null = cleanAnim(o.anim, duration);
      const rest: Rest = { left: o.left ?? 0, top: o.top ?? 0, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1, opacity: o.opacity ?? 1 };
      const text = typeof o.text === "string" && anim?.in === "typewriter" ? (o.text as string) : null;
      return { o, anim, rest, text, styles: (isObj(o.styles) ? o.styles : {}) as Json, total: text ? Array.from(text).length : 0, lastShown: -1 };
    });
    const draw = (t: number) => {
      for (const l of layers) {
        if (!l.anim) continue;
        const f = frameAt(l.rest, l.anim, t, W, H, duration);
        l.o.set({ left: f.left, top: f.top, scaleX: f.scaleX, scaleY: f.scaleY, opacity: f.opacity });
        if (l.text !== null) {
          const shown = f.chars === null ? l.total : Math.floor(f.chars * l.total);
          if (shown !== l.lastShown) {
            l.o.set("styles", shown >= l.total ? l.styles : typeStyles(l.text, l.styles, shown));
            l.o.dirty = true;
            l.lastShown = shown;
          }
        }
      }
      canvas.renderAll();
    };

    // The poster: everything in place.
    draw(settledAt(layers.map((l) => l.anim), duration));
    const poster: Buffer = el.toBuffer("image/png");

    const ff = spawn(
      ffmpegPath(),
      [
        "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
        // Exact brand colours: convert with the HD (BT.709) matrix and say so in the file.
        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:v", "libx264", "-preset", process.env.VIDEO_X264_PRESET || "veryfast", "-crf", process.env.VIDEO_CRF || "18",
        "-profile:v", "high", "-movflags", "+faststart", "-an", file,
      ],
      { stdio: ["pipe", "ignore", "pipe"] }
    );
    let ffErr = "";
    ff.stderr.on("data", (d: Buffer) => (ffErr = (ffErr + d.toString()).slice(-2000)));
    const done = new Promise<void>((resolve, reject) => {
      ff.on("error", (e) => reject(new Error(`Couldn't start the video encoder (ffmpeg): ${e.message}`)));
      ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`The video encoder stopped (code ${code}). ${ffErr.trim()}`))));
    });
    // A write to a dead encoder must not crash the process; `done` reports why it died.
    ff.stdin.on("error", () => undefined);

    try {
      for (let i = 0; i < frames; i++) {
        if (input.cancelled?.()) throw Object.assign(new Error("Render cancelled"), { cancelled: true });
        draw(i / FPS);
        const pixels: Buffer = el.data();
        if (!ff.stdin.write(pixels)) await Promise.race([new Promise((r) => ff.stdin.once("drain", r)), done]);
        else await new Promise((r) => setImmediate(r));
        if (input.onProgress && i % 15 === 0) await input.onProgress(i / frames);
      }
      ff.stdin.end();
      await done;
    } catch (err) {
      ff.kill("SIGKILL");
      await done.catch(() => undefined);
      throw err;
    }
    await input.onProgress?.(1);
    return { file, poster, durationMs: Math.round((frames / FPS) * 1000), frames, renderMs: Date.now() - started };
  } catch (err) {
    await fs.rm(file, { force: true }).catch(() => undefined);
    throw err;
  } finally {
    setAssetLoader(async () => null);
    try {
      canvas.dispose();
    } catch {
      /* nothing to free */
    }
  }
}
