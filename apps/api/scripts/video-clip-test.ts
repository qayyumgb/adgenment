/**
 * C20b check: footage in a design renders with its picture and sound.
 * Makes a test clip (moving test pattern + tone), puts two parts of it one
 * after the other (crossfade) in a rounded frame under an animated headline, renders 5 s and reports what the MP4 contains.
 *
 *   npx tsx scripts/video-clip-test.ts          (KEEP=1 keeps the files and prints where)
 */
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { renderDesignVideo } from "../src/services/video/render";
import { probe, runFfmpeg } from "../src/services/video/ffmpeg";

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "advertix-cliptest-"));
  const clip = path.join(dir, "clip.mp4");
  const made = await runFfmpeg(["-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", "30", "-c:a", "aac", "-shortest", clip]);
  if (made.code !== 0) throw new Error(`test clip: ${made.log.slice(-400)}`);
  console.log("clip:", await probe(clip));
  const bytes = await fs.readFile(clip);

  const W = 1080;
  const H = 1080;
  const data = {
    version: "7.4.0",
    background: "#16141f",
    motion: { duration: 5 },
    objects: [
      { type: "FrameImage", originX: "center", originY: "center", left: W / 2, top: 470, width: 920, height: 720, frame: "rounded", empty: false, focusX: 0.5, focusY: 0.5, zoom: 1, src: "asset:clip1", assetId: "clip1", clip: true, clipStart: 0, clipEnd: 3, volume: 0.8, anim: { in: "zoom-in", at: 0, dur: 0.8 } },
      // A second clip in the same frame, fading in over the first as it ends (a sequence), half as loud.
      { type: "FrameImage", originX: "center", originY: "center", left: W / 2, top: 470, width: 920, height: 720, frame: "rounded", empty: false, focusX: 0.5, focusY: 0.5, zoom: 1, src: "asset:clip1", assetId: "clip1", clip: true, clipStart: 5, clipEnd: 8, volume: 0.5, anim: { in: "fade", at: 2.5, dur: 0.5 } },
      { type: "Textbox", originX: "center", originY: "center", left: W / 2, top: 960, width: 900, text: "Footage with sound", fontSize: 72, fontFamily: "Inter", fontWeight: 700, fill: "#ffffff", textAlign: "center", anim: { in: "slide-up", at: 0.6, dur: 0.6 } },
    ],
  };
  const out = await renderDesignVideo({ data, width: W, height: H, loadAsset: async (id) => (id === "clip1" ? bytes : null) });
  const info = await probe(out.file);
  console.log("video:", info, `| rendered in ${(out.renderMs / 1000).toFixed(1)}s | ${((await fs.stat(out.file)).size / 1024).toFixed(0)} KB`);
  for (const at of ["1", "2.75", "4"]) await runFfmpeg(["-y", "-ss", at, "-i", out.file, "-frames:v", "1", path.join(dir, `frame-${at}s.png`)]);
  await fs.writeFile(path.join(dir, "poster.png"), out.poster);
  if (!info?.hasAudio) throw new Error("The rendered video has no sound track.");
  if (Math.abs((info.durationMs ?? 0) - 5000) > 150) throw new Error(`Wrong length: ${info.durationMs} ms`);
  if (process.env.KEEP) {
    await fs.copyFile(out.file, path.join(dir, "out.mp4"));
    console.log("kept in", dir);
  }
  await fs.rm(out.file, { force: true });
  if (!process.env.KEEP) await fs.rm(dir, { recursive: true, force: true });
  console.log("OK");
}
main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
