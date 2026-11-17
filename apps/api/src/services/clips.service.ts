import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomBytes } from "crypto";
import type { Access } from "../lib/access";
import { assetError, assetUrl, createFileAsset } from "./assets.service";
import { load } from "./designs.service";
import { probe, runFfmpeg } from "./video/ffmpeg";

/**
 * Video clips for the editor (plan C20b): footage placed in a design.
 *
 * Every upload is converted once to a standard MP4, so one file plays in
 * every browser (iPhone HEVC / .mov doesn't in Chrome), is upright (phone
 * rotation applied), is at most 1920 px on its long side at 30 frames a
 * second, has a keyframe every second (quick scrubbing and trimming), and
 * always has a sound track (silence when the original had none), which
 * keeps mixing at render simple. Stored in R2 like any design file
 * (kind "clip") and deleted with the design.
 */

export const MAX_CLIP_BYTES = 100 * 1024 * 1024;
export const MAX_CLIP_SECONDS = 180;
const MAX_SIDE = 1920;

export async function addClip(access: Access, userId: string, base: string, designId: string, file: Buffer) {
  const d = await load(access, designId);
  const stamp = randomBytes(8).toString("hex");
  const src = path.join(os.tmpdir(), `advertix-clip-${stamp}-in`);
  const out = path.join(os.tmpdir(), `advertix-clip-${stamp}.mp4`);
  try {
    await fs.writeFile(src, file);
    const info = await probe(src);
    if (!info) throw assetError(400, "That file isn't a video Advertix can read (MP4, MOV or WebM).");
    if (info.durationMs > MAX_CLIP_SECONDS * 1000) throw assetError(400, `Videos can be up to ${MAX_CLIP_SECONDS / 60} minutes long. Trim it and upload again.`);

    const { code, log } = await runFfmpeg([
      "-y",
      "-i", src,
      // No sound in the original: a silent track, so every clip has one.
      ...(info.hasAudio ? [] : ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]),
      "-map", "0:v:0", "-map", info.hasAudio ? "0:a:0" : "1:a:0",
      "-vf", `scale=w='min(${MAX_SIDE},iw)':h='min(${MAX_SIDE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30,format=yuv420p`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-profile:v", "high", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
      ...(info.hasAudio ? [] : ["-shortest"]),
      "-t", String(MAX_CLIP_SECONDS),
      "-movflags", "+faststart",
      out,
    ]);
    if (code !== 0) {
      console.error("[clips] convert failed:", log.slice(-600));
      throw assetError(400, "That video couldn't be prepared. Try exporting it again as MP4 (H.264) and upload that.");
    }
    const made = await probe(out);
    if (!made || !made.durationMs) throw assetError(400, "That video couldn't be prepared. Try exporting it again as MP4 (H.264) and upload that.");
    const body = await fs.readFile(out);
    const a = await createFileAsset({ workspaceId: access.workspaceId, designId: d.id, createdById: userId, kind: "clip", body, mime: "video/mp4", ext: "mp4", width: made.width, height: made.height, durationMs: made.durationMs });
    return { id: a.id, url: assetUrl(base, a.id), width: a.width, height: a.height, durationMs: made.durationMs, hasAudio: info.hasAudio };
  } finally {
    await fs.rm(src, { force: true }).catch(() => undefined);
    await fs.rm(out, { force: true }).catch(() => undefined);
  }
}
