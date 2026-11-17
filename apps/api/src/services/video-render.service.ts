import { promises as fs } from "fs";
import { Prisma, type VideoRender } from "@prisma/client";
import { prisma } from "../lib/prisma";
import type { Access } from "../lib/access";
import { enqueue, type WorkQueue } from "../lib/jobs";
import { clampDuration } from "../lib/motion";
import { assetError, assetUrl, createAsset, createFileAsset, deleteAssets, readAsset } from "./assets.service";
import { load } from "./designs.service";
import { metaService } from "./meta.service";

/**
 * Video renders (plan C20a): a design with motion → an MP4.
 *
 * Asking for a render copies the design into a `VideoRender` row and adds a
 * job to the `video-render` queue (one render at a time per instance). The
 * job draws every frame on the server (services/video/render.ts), stores the
 * MP4 and a poster image in file storage as the design's files, and marks
 * the row done; the editor polls the row for progress.
 *
 * - Without the job queue (JOB_QUEUE=off) the render runs in this process.
 * - `VIDEO_RENDER_WORKER=off` on an instance: it queues renders but leaves
 *   the work to another instance (a separate render service in production).
 * - A render that never finished (a deploy, a crash) is marked failed when
 *   someone next looks at it, so the editor never waits for ever.
 */

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const QUEUE = "video-render";
const STUCK_AFTER_MS = 20 * 60_000;
const workerOn = () => (process.env.VIDEO_RENDER_WORKER ?? "on").toLowerCase() !== "off";

function view(base: string, r: VideoRender, designRevision: number) {
  return {
    id: r.id,
    status: r.status as "queued" | "rendering" | "done" | "failed",
    progress: r.progress,
    error: r.error,
    width: r.width,
    height: r.height,
    durationMs: r.durationMs,
    videoUrl: r.status === "done" && r.assetId ? assetUrl(base, r.assetId) : null,
    posterUrl: r.status === "done" && r.posterAssetId ? assetUrl(base, r.posterAssetId) : null,
    /** The design was saved again after this render. */
    outdated: r.revision !== designRevision,
    createdAt: r.createdAt,
    finishedAt: r.finishedAt,
  };
}

const active = (r: VideoRender) => r.status === "queued" || r.status === "rendering";

/** A render left unfinished (the server restarted mid-render): failed, so it can be asked for again. */
async function settle(r: VideoRender): Promise<VideoRender> {
  if (!active(r) || Date.now() - r.createdAt.getTime() < STUCK_AFTER_MS) return r;
  return prisma.videoRender.update({ where: { id: r.id }, data: { status: "failed", error: "The render was interrupted. Render the video again.", data: Prisma.DbNull, finishedAt: new Date() } });
}

/** The design's latest render, or null when it has none. */
export async function getVideoRender(access: Access, base: string, designId: string) {
  const d = await load(access, designId);
  const r = await prisma.videoRender.findFirst({ where: { designId: d.id }, orderBy: { createdAt: "desc" } });
  return r ? view(base, await settle(r), d.revision) : null;
}

/** Start a render of the design as it is saved now. One at a time per design: asking again returns the one in progress. */
export async function startVideoRender(access: Access, userId: string, base: string, designId: string) {
  const d = await load(access, designId);
  const data = (isObj(d.data) ? d.data : {}) as Json;
  if (!Array.isArray(data.objects) || !data.objects.length) throw assetError(400, "This design is empty. Add something before making a video.");
  if (d.width % 2 || d.height % 2) throw assetError(400, "This design's size can't be made into a video.");

  const latest = await prisma.videoRender.findFirst({ where: { designId: d.id }, orderBy: { createdAt: "desc" } });
  if (latest) {
    const cur = await settle(latest);
    if (active(cur)) return view(base, cur, d.revision);
  }

  // A design that was never given motion still renders: a still video of the default length.
  const motion = isObj(data.motion) ? data.motion : {};
  const snapshot = { ...data, motion: { ...motion, duration: clampDuration(motion.duration) } };
  const r = await prisma.videoRender.create({ data: { workspaceId: d.workspaceId, designId: d.id, revision: d.revision, width: d.width, height: d.height, data: snapshot as Prisma.InputJsonValue, createdById: userId } });
  const queued = await enqueue(QUEUE, { renderId: r.id }, r.id).catch(() => null);
  if (!queued) void runVideoRender({ renderId: r.id }).catch((err) => console.error("[video] render", r.id, err instanceof Error ? err.message : err));
  return view(base, r, d.revision);
}

/** The job: render, store, mark done. Failures are recorded on the row (the editor shows them). */
export async function runVideoRender({ renderId }: { renderId: string }) {
  // Claim it: a retried or duplicated job never renders the same row twice at once.
  const claimed = await prisma.videoRender.updateMany({ where: { id: renderId, status: "queued" }, data: { status: "rendering", startedAt: new Date(), progress: 0 } });
  if (!claimed.count) return;
  const r = await prisma.videoRender.findUniqueOrThrow({ where: { id: renderId } });
  let file: string | null = null;
  try {
    // Loaded here, not at the top: the canvas library is only needed by an instance that renders.
    const { renderDesignVideo } = await import("./video/render");
    let lastSaved = 0;
    let gone = false;
    const out = await renderDesignVideo({
      data: (isObj(r.data) ? r.data : {}) as Json,
      width: r.width,
      height: r.height,
      loadAsset: async (id) => {
        const f = await readAsset(id);
        // Only this workspace's files, whatever the design's data says.
        return f && f.asset.workspaceId === r.workspaceId ? f.body : null;
      },
      onProgress: async (fraction) => {
        const pct = Math.min(99, Math.floor(fraction * 100));
        if (pct - lastSaved < 4) return;
        lastSaved = pct;
        // The design was deleted while rendering: stop.
        const u = await prisma.videoRender.updateMany({ where: { id: r.id }, data: { progress: pct } });
        if (!u.count) gone = true;
      },
      cancelled: () => gone,
    });
    file = out.file;
    const body = await fs.readFile(out.file);
    const video = await createFileAsset({ workspaceId: r.workspaceId, designId: r.designId, createdById: r.createdById, kind: "video", body, mime: "video/mp4", ext: "mp4", width: r.width, height: r.height });
    const poster = await createAsset({ workspaceId: r.workspaceId, designId: r.designId, createdById: r.createdById, kind: "poster", input: out.poster, quality: 92 });
    const done = await prisma.videoRender.updateMany({
      where: { id: r.id },
      data: { status: "done", progress: 100, durationMs: out.durationMs, assetId: video.id, posterAssetId: poster.id, data: Prisma.DbNull, error: null, finishedAt: new Date() },
    });
    if (!done.count) {
      await deleteAssets({ id: { in: [video.id, poster.id] } });
      return;
    }
    console.log(`[video] ${r.id}: ${r.width}x${r.height}, ${(out.durationMs / 1000).toFixed(1)}s, rendered in ${(out.renderMs / 1000).toFixed(1)}s, ${(body.length / 1024).toFixed(0)} KB`);
    await pruneRenders(r.designId, r.id);
  } catch (err) {
    if ((err as { cancelled?: boolean }).cancelled) return;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[video] ${r.id} failed:`, message);
    await prisma.videoRender.updateMany({ where: { id: r.id }, data: { status: "failed", error: "The video couldn't be rendered. Try again; if it keeps failing, contact support.", data: Prisma.DbNull, finishedAt: new Date() } });
  } finally {
    if (file) await fs.rm(file, { force: true }).catch(() => undefined);
  }
}

/**
 * Save to Creatives (C20a step 4): the design's finished video becomes its
 * Creative, as a VIDEO (the poster is its picture). When the workspace has a
 * Meta ad account the MP4 is uploaded there too, so it is ready to publish;
 * if that doesn't work the video is still saved, and publishing uploads it.
 */
export async function exportDesignVideo(access: Access, base: string, designId: string) {
  const d = await load(access, designId);
  const r = await prisma.videoRender.findFirst({ where: { designId: d.id, status: "done" }, orderBy: { createdAt: "desc" } });
  if (!r || !r.assetId || !r.posterAssetId) throw assetError(409, "Make the video first, then save it to Creatives.");
  const before = d.creativeId ? await prisma.creative.findFirst({ where: { id: d.creativeId, workspaceId: d.workspaceId } }) : null;
  const was = (isObj(before?.content) ? before!.content : {}) as Json;

  // Already on Meta from an earlier save of this same render: keep that upload.
  let meta: { videoId: string; metaAccountId: string } | null = was.videoAssetId === r.assetId && typeof was.videoId === "string" && typeof was.metaAccountId === "string" ? { videoId: was.videoId, metaAccountId: was.metaAccountId } : null;
  let metaError: string | null = null;
  if (!meta) {
    const acct = await prisma.adAccount.findFirst({ where: { workspaceId: d.workspaceId, platform: "META", isActive: true, ...(d.clientId ? { OR: [{ clientId: d.clientId }, { clientId: null }] } : {}) }, orderBy: { createdAt: "desc" } });
    if (acct) {
      try {
        const f = await readAsset(r.assetId);
        if (!f) throw new Error("The video file is missing. Make the video again.");
        const up = await metaService.uploadVideoFromBytes(metaService.decryptToken(acct.accessToken), acct.accountId, f.body, `${d.name.replace(/[^\w-]+/g, "-").slice(0, 60) || "video"}.mp4`, "video/mp4");
        meta = { videoId: up.id, metaAccountId: acct.accountId };
      } catch (err) {
        metaError = err instanceof Error ? err.message : "Meta didn't accept the video";
      }
    }
  }

  // `assetId` is the picture every Creatives view shows (the poster); `videoAssetId` is the MP4.
  const content: Json = { designId: d.id, assetId: r.posterAssetId, posterAssetId: r.posterAssetId, videoAssetId: r.assetId, width: r.width, height: r.height, videoWidth: r.width, videoHeight: r.height, durationMs: r.durationMs, ...(meta ?? {}) };
  const updated = before ? await prisma.creative.update({ where: { id: before.id }, data: { name: d.name, type: "VIDEO", content: content as Prisma.InputJsonValue, clientId: d.clientId } }).catch(() => null) : null;
  const saved = updated ?? (await prisma.creative.create({ data: { workspaceId: d.workspaceId, clientId: d.clientId, name: d.name, type: "VIDEO", status: "DRAFT", content: content as Prisma.InputJsonValue } }));
  await prisma.design.update({ where: { id: d.id }, data: { creativeId: saved.id, kept: true } });

  // The video files the Creative showed before (an older render's) are no longer used by anything.
  const stale = [was.videoAssetId, was.posterAssetId].filter((x): x is string => typeof x === "string" && x !== r.assetId && x !== r.posterAssetId);
  if (stale.length) await deleteAssets({ id: { in: stale } });
  return { creativeId: saved.id, videoUrl: assetUrl(base, r.assetId), posterUrl: assetUrl(base, r.posterAssetId), metaUploaded: Boolean(meta), metaError };
}

/** Older renders of the design go, with their files, unless the design's Creative still uses them. */
async function pruneRenders(designId: string, keepId: string) {
  const d = await prisma.design.findUnique({ where: { id: designId }, select: { creativeId: true } });
  const creative = d?.creativeId ? await prisma.creative.findUnique({ where: { id: d.creativeId }, select: { content: true } }) : null;
  const c = (isObj(creative?.content) ? creative!.content : {}) as Json;
  const inUse = new Set([c.videoAssetId, c.posterAssetId, c.assetId].filter((x): x is string => typeof x === "string"));
  const old = await prisma.videoRender.findMany({ where: { designId, id: { not: keepId }, status: { in: ["done", "failed"] } }, select: { id: true, assetId: true, posterAssetId: true } });
  const files = old.flatMap((o) => [o.assetId, o.posterAssetId]).filter((x): x is string => Boolean(x) && !inUse.has(x as string));
  if (files.length) await deleteAssets({ id: { in: files } });
  if (old.length) await prisma.videoRender.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

/** One render at a time on an instance that renders; none on one that only queues (VIDEO_RENDER_WORKER=off). */
export const videoRenderQueue: WorkQueue<{ renderId: string }> = {
  name: QUEUE,
  concurrency: workerOn() ? 1 : 0,
  run: runVideoRender,
  retryLimit: 1,
  retryDelaySeconds: 20,
  expireInMinutes: 20,
  // Someone is watching the progress bar: start within 2 s, not 10.
  pollSeconds: 2,
};
