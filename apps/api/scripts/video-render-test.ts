/**
 * Manual check of the video render engine (plan C20a), without the database:
 *   npx tsx scripts/video-render-test.ts [width height seconds]
 * Writes test-video.mp4 and test-video-poster.png to the system temp folder.
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { renderDesignVideo } from "../src/services/video/render";

const W = Number(process.argv[2]) || 1080;
const H = Number(process.argv[3]) || 1920;
const SECS = Number(process.argv[4]) || 8;

async function main() {
  // A stand-in product photo (a gradient with a shape), stored as the editor stores photos: WebP.
  const photo = await sharp({ create: { width: 900, height: 900, channels: 3, background: "#ffd9a8" } })
    .composite([{ input: Buffer.from(`<svg width="900" height="900"><defs><radialGradient id="g"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#c2410c"/></radialGradient></defs><circle cx="450" cy="450" r="300" fill="url(#g)"/></svg>`) }])
    .webp({ quality: 90 })
    .toBuffer();

  const text = (t: string, top: number, size: number, extra: Record<string, unknown>) => ({
    type: "Textbox", version: "7.4.0", originX: "center", originY: "center", left: W / 2, top, width: W * 0.82, fontSize: size, text: t, textAlign: "center", fill: "#111827", fontFamily: "Inter", fontWeight: 400, lineHeight: 1.1, ...extra,
  });
  const data = {
    version: "7.4.0",
    background: "#fff7ed",
    motion: { duration: SECS },
    objects: [
      { type: "Rect", originX: "center", originY: "center", left: W / 2, top: H * 0.3, width: W, height: H * 0.6, fill: "#fed7aa", anim: { in: "fade", at: 0, dur: 0.5 } },
      {
        type: "Image", originX: "center", originY: "center", left: W / 2, top: H * 0.3, width: 900, height: 900, scaleX: (W * 0.62) / 900, scaleY: (W * 0.62) / 900, src: "asset:photo1", assetId: "photo1",
        clipPath: { type: "Circle", originX: "center", originY: "center", left: 0, top: 0, radius: 430 },
        anim: { in: "zoom-in", at: 0.2, dur: 0.8, hold: "zoom" },
      },
      text("Summer sale", H * 0.62, W * 0.12, { fontFamily: "Playfair Display", fontWeight: 700, anim: { in: "slide-up", at: 0.6, dur: 0.6 } }),
      text("Up to 40% off everything, this weekend only.", H * 0.7, W * 0.045, { fill: "#4b5563", anim: { in: "typewriter", at: 1.2, dur: 1.4 } }),
      { type: "Rect", originX: "center", originY: "center", left: W / 2, top: H * 0.8, width: W * 0.44, height: W * 0.12, rx: W * 0.06, ry: W * 0.06, fill: "#c2410c", anim: { in: "pop", at: 2.4, dur: 0.5, hold: "pulse" } },
      text("Shop now", H * 0.8, W * 0.048, { fill: "#ffffff", fontFamily: "Poppins", fontWeight: 600, width: W * 0.44, anim: { in: "pop", at: 2.4, dur: 0.5, hold: "pulse" } }),
      text("Missing-photo test: this layer's file is gone", H * 0.9, W * 0.03, { fill: "#9ca3af", fontFamily: "Caveat", fontWeight: 700, anim: { in: "fade", at: 3, dur: 0.5, out: "fade", outAt: SECS, outDur: 0.6 } }),
      { type: "Image", originX: "center", originY: "center", left: 100, top: 100, width: 50, height: 50, src: "asset:gone", assetId: "gone" },
    ],
  };

  let last = -1;
  const out = await renderDesignVideo({
    data, width: W, height: H,
    loadAsset: async (id) => (id === "photo1" ? photo : null),
    onProgress: (f) => {
      const pct = Math.floor(f * 10) * 10;
      if (pct !== last) (last = pct), process.stdout.write(`${pct}% `);
    },
  });
  const mp4 = path.join(os.tmpdir(), "test-video.mp4");
  const png = path.join(os.tmpdir(), "test-video-poster.png");
  await fs.copyFile(out.file, mp4);
  await fs.rm(out.file, { force: true });
  await fs.writeFile(png, out.poster);
  const size = (await fs.stat(mp4)).size;
  console.log(`\n${W}x${H}, ${out.durationMs / 1000}s, ${out.frames} frames, rendered in ${(out.renderMs / 1000).toFixed(1)}s, ${(size / 1024).toFixed(0)} KB, memory ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`);
  console.log(mp4, "\n" + png);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
