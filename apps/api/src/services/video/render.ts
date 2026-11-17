import { spawn, type ChildProcess } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomBytes } from "crypto";
import { createCanvas, ImageData } from "@napi-rs/canvas";
import { FPS, cleanAnim, clampDuration, frameAt, settledAt, type Anim, type Rest } from "../../lib/motion";
import { DEFAULT_FONT, ensureFont, makeCanvasElement, serverFabric, setAssetLoader } from "./fabric-server";
import { ffmpegPath, probe } from "./ffmpeg";

export { ffmpegPath };

/**
 * Render a design with motion to an MP4 (plan C20a, footage C20b).
 *
 * The design is loaded into Fabric once. For every frame (30 a second) each
 * layer is moved to where `frameAt` says it is, the canvas is drawn, and the
 * raw pixels are piped to ffmpeg, which encodes H.264. One frame is also
 * kept as the poster (the moment every entrance has finished).
 *
 * **Video clips** (a photo frame holding footage): each clip is decoded by
 * its own ffmpeg, one frame per output frame, into a small canvas that the
 * frame draws like a photo, so shapes, cropping, stacking and animation
 * work on footage exactly as on images. A clip's sound (unless muted) is
 * mixed into the MP4 by the encoder.
 *
 * One render at a time per process (Fabric's server setup is global); the
 * loop gives way to the event loop between frames, so an API instance that
 * renders stays responsive.
 */

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const BLANK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export type RenderInput = {
  /** The design as saved (Fabric JSON with "asset:<id>" images and a `motion` block). */
  data: Json;
  width: number;
  height: number;
  /** The bytes of one of the design's files (an image or a clip), or null when it's gone. */
  loadAsset: (id: string) => Promise<Buffer | null>;
  onProgress?: (fraction: number) => void | Promise<void>;
  /** Checked between frames: return true to stop (the design was deleted, the server is shutting down). */
  cancelled?: () => boolean;
};
export type RenderOutput = { file: string; poster: Buffer; durationMs: number; frames: number; renderMs: number };

function walk(node: unknown, fn: (o: Json) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, fn));
  else if (isObj(node)) {
    fn(node);
    if (Array.isArray(node.objects)) walk(node.objects, fn);
  }
}

const isClip = (o: Json) => o.clip === true && typeof o.assetId === "string";

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
    // A clip isn't an image: it loads as a blank and gets its frames from the decoder.
    if (isClip(o)) o.src = BLANK_PNG;
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

/** Whole frames of `size` bytes from a stream of raw pixels. */
async function* rawFrames(stream: NodeJS.ReadableStream, size: number): AsyncGenerator<Buffer> {
  let parts: Buffer[] = [];
  let have = 0;
  for await (const chunk of stream) {
    const b = chunk as Buffer;
    parts.push(b);
    have += b.length;
    if (have < size) continue;
    let all = parts.length === 1 ? parts[0] : Buffer.concat(parts, have);
    while (all.length >= size) {
      yield all.subarray(0, size);
      all = all.subarray(size);
    }
    parts = all.length ? [all] : [];
    have = all.length;
  }
}

type Clip = { file: string; /** When it starts playing in the video (seconds): when its layer comes in. */ at: number; start: number; length: number; volume: number; proc: ChildProcess; frames: AsyncGenerator<Buffer>; w: number; h: number; put: (pixels: Buffer) => void; done: boolean };

const num = (v: unknown, dflt: number) => (typeof v === "number" && Number.isFinite(v) ? v : dflt);

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
  const stamp = randomBytes(8).toString("hex");
  const file = path.join(os.tmpdir(), `advertix-video-${stamp}.mp4`);
  const clips: Clip[] = [];
  const temp: string[] = [];
  try {
    await canvas.loadFromJSON(json);
    // Video has no transparency: an empty background is white, as the exported image is.
    if (!canvas.backgroundColor) canvas.backgroundColor = "#ffffff";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objects = canvas.getObjects() as any[];

    // Footage: a decoder per clip, feeding the canvas its frame draws.
    for (const o of objects) {
      if (o.clip !== true || typeof o.assetId !== "string" || o.visible === false) continue;
      const bytes = cache.get(o.assetId);
      if (!bytes) {
        o.empty = true;
        continue;
      }
      const clipFile = path.join(os.tmpdir(), `advertix-video-${stamp}-${clips.length}.mp4`);
      await fs.writeFile(clipFile, bytes);
      temp.push(clipFile);
      const info = await probe(clipFile);
      if (!info || !info.durationMs) {
        o.empty = true;
        continue;
      }
      const total = info.durationMs / 1000;
      const start = Math.min(Math.max(0, num(o.clipStart, 0)), Math.max(0, total - 0.1));
      const end = Math.min(total, Math.max(start + 0.1, num(o.clipEnd, total) || total));
      const a = cleanAnim(o.anim, duration);
      const at = a && a.in !== "none" ? a.at ?? 0 : 0;
      const length = Math.min(end - start, duration - at);
      if (length < 0.05) continue;
      const surface = createCanvas(info.width, info.height);
      const ctx = surface.getContext("2d");
      o._element = surface;
      o._originalElement = surface;
      o.empty = false;
      const proc = spawn(ffmpegPath(), ["-loglevel", "error", "-ss", start.toFixed(3), "-t", length.toFixed(3), "-i", clipFile, "-vf", `fps=${FPS}`, "-pix_fmt", "rgba", "-f", "rawvideo", "-"], { stdio: ["ignore", "pipe", "ignore"] });
      proc.on("error", () => undefined);
      const size = info.width * info.height * 4;
      clips.push({
        file: clipFile,
        at,
        start,
        length,
        volume: o.muted === true ? 0 : Math.min(1, Math.max(0, num(o.volume, 1))),
        proc,
        frames: rawFrames(proc.stdout!, size),
        w: info.width,
        h: info.height,
        put: (pixels) => ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, size), info.width, info.height), 0, 0),
        done: false,
      });
    }
    /** The next frame of every clip (a clip that has ended keeps showing its last frame). */
    const advance = async (frame: number) => {
      for (const c of clips) {
        if (c.done || frame < Math.round(c.at * FPS)) continue;
        const r = await c.frames.next();
        if (r.done) c.done = true;
        else c.put(r.value);
      }
    };

    const layers = objects.map((o) => {
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

    // Sound: every clip that isn't muted, each at its own volume, mixed together.
    const loud = clips.filter((c) => c.volume > 0);
    const audioIn = loud.flatMap((c) => ["-ss", c.start.toFixed(3), "-t", c.length.toFixed(3), "-i", c.file]);
    // Each starts with its clip, with a short fade at both ends so a cut never clicks.
    const mix = loud.map((c, i) => `[${i + 1}:a]volume=${c.volume.toFixed(2)},afade=t=in:d=0.08,afade=t=out:st=${Math.max(0, c.length - 0.08).toFixed(3)}:d=0.08${c.at > 0 ? `,adelay=${Math.round(c.at * 1000)}:all=1` : ""}[a${i}]`).join(";") + (loud.length > 1 ? `;${loud.map((_, i) => `[a${i}]`).join("")}amix=inputs=${loud.length}:normalize=0[aout]` : "");
    const audioOut = loud.length ? ["-filter_complex", mix, "-map", "0:v", "-map", loud.length > 1 ? "[aout]" : "[a0]", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-t", duration.toFixed(3)] : ["-an"];

    const ff = spawn(
      ffmpegPath(),
      [
        "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
        ...audioIn,
        // Exact brand colours: convert with the HD (BT.709) matrix and say so in the file.
        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:v", "libx264", "-preset", process.env.VIDEO_X264_PRESET || "veryfast", "-crf", process.env.VIDEO_CRF || "18",
        "-profile:v", "high",
        ...audioOut,
        "-movflags", "+faststart", file,
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

    // The poster: the frame where every entrance has finished.
    const posterAt = Math.min(frames - 1, Math.round(settledAt(layers.map((l) => l.anim), duration) * FPS));
    let poster: Buffer | null = null;
    try {
      for (let i = 0; i < frames; i++) {
        if (input.cancelled?.()) throw Object.assign(new Error("Render cancelled"), { cancelled: true });
        if (clips.length) await advance(i);
        draw(i / FPS);
        if (i === posterAt) poster = el.toBuffer("image/png");
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
    return { file, poster: poster ?? el.toBuffer("image/png"), durationMs: Math.round((frames / FPS) * 1000), frames, renderMs: Date.now() - started };
  } catch (err) {
    await fs.rm(file, { force: true }).catch(() => undefined);
    throw err;
  } finally {
    setAssetLoader(async () => null);
    for (const c of clips) {
      try {
        c.proc.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
    // Windows keeps a file locked until its reader has really gone: try a few times.
    for (const f of temp) await fs.rm(f, { force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined);
    try {
      canvas.dispose();
    } catch {
      /* nothing to free */
    }
  }
}
