import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomBytes } from "crypto";
import type { Access } from "../lib/access";
import { prisma } from "../lib/prisma";
import { assetError, assetUrl, createFileAsset, readAsset } from "./assets.service";
import { load } from "./designs.service";
import { metaService } from "./meta.service";
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

/** The design's clips, newest first ("Your videos" in the editor). */
export async function listClips(base: string, designId: string) {
  const rows = await prisma.asset.findMany({ where: { designId, kind: "clip" }, orderBy: { createdAt: "desc" }, take: 24, select: { id: true, width: true, height: true, durationMs: true } });
  return rows.map((r) => ({ id: r.id, url: assetUrl(base, r.id), width: r.width, height: r.height, durationMs: r.durationMs ?? 0 }));
}

/** A file from a link, refused once it passes `max` bytes (never holds more than that). */
async function fetchCapped(url: string, max: number): Promise<Buffer | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) }).catch(() => null);
  if (!res?.ok || !res.body) return null;
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > max) throw assetError(413, "That video is over 100 MB. Trim it and upload the file instead.");
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.length;
    if (size > max) throw assetError(413, "That video is over 100 MB. Trim it and upload the file instead.");
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts);
}

/**
 * A video from the Creatives library, put into the design as a clip (C20b).
 * Where it comes from, in order: a video made in the editor (our own file);
 * a link saved with it; the video on Meta (a fresh link from any of the
 * workspace's Meta ad accounts). Then prepared like an upload.
 */
export async function importCreativeClip(access: Access, userId: string, base: string, designId: string, creativeId: string) {
  const d = await load(access, designId);
  const c = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId: access.workspaceId } });
  if (!c) throw assetError(404, "Creative not found");
  if (c.type !== "VIDEO") throw assetError(400, "That creative isn't a video.");
  const content = (c.content && typeof c.content === "object" && !Array.isArray(c.content) ? c.content : {}) as Record<string, unknown>;
  let bytes: Buffer | null = null;
  if (typeof content.videoAssetId === "string") {
    const f = await readAsset(content.videoAssetId);
    if (f && f.asset.workspaceId === access.workspaceId) bytes = f.body;
  }
  // A saved link: `videoUrl`, or `url` when the creative has no Meta video (then `url` is the video, not its poster).
  const links = [content.videoUrl, typeof content.videoId === "string" ? null : content.url].filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u));
  for (const u of links) {
    if (bytes) break;
    bytes = await fetchCapped(u, MAX_CLIP_BYTES).catch((err) => {
      if ((err as { status?: number }).status === 413) throw err;
      return null;
    });
  }
  if (!bytes && typeof content.videoId === "string" && /^\d+$/.test(content.videoId)) {
    const accounts = await prisma.adAccount.findMany({ where: { workspaceId: access.workspaceId, platform: "META", isActive: true }, orderBy: { createdAt: "desc" }, select: { accessToken: true } });
    for (const a of accounts) {
      const src = await metaService.getVideoSource(metaService.decryptToken(a.accessToken), content.videoId).catch(() => null);
      if (!src?.source) continue;
      bytes = await fetchCapped(src.source, MAX_CLIP_BYTES);
      if (bytes) break;
    }
  }
  if (!bytes) throw assetError(409, "Advertix couldn't get this video's file (Meta may not share it). Download it and use Upload video instead.");
  return addClip(access, userId, base, d.id, bytes);
}

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
