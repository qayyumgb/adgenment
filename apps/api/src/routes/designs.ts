import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { getAccess } from "../lib/access";
import { storageConfigured } from "../lib/storage";
import { apiBase, MAX_UPLOAD_BYTES, readAsset, verifyAssetLink } from "../services/assets.service";
import { addBrandLogo, addImage, copyDesign, createDesign, deleteDesign, exportDesign, getDesign, importCreativeImage, listDesigns, saveDesign, savePreview, SIZES } from "../services/designs.service";
import { exportDesignVideo, getVideoRender, startVideoRender } from "../services/video-render.service";
import { addClip, importCreativeClip, MAX_CLIP_BYTES } from "../services/clips.service";
import { addBrandLogo as addKitLogo, getBrandKit, removeBrandLogo, updateBrandKit } from "../services/brand.service";

/**
 * Creative editor (plan C19a).
 *
 * - `/assets/:id/file?exp=&sig=`: public, signed link (no login), so <img>
 *   and the editor canvas can load files; cached for the link's lifetime.
 * - `/designs`: signed in; reading is a view, everything else an edit
 *   (lib/access). Images arrive as multipart field "image".
 */

export const assetsRouter = Router();

// A video player asks for one file in many pieces (byte ranges), and scrubbing asks again and again:
// the last few videos are kept in memory for a short while instead of being fetched from storage each time.
type Served = NonNullable<Awaited<ReturnType<typeof readAsset>>>;
const recent = new Map<string, { f: Served; at: number }>();
const RECENT_MS = 3 * 60_000;
const RECENT_MAX = 4;
async function readForServing(id: string): Promise<Served | null> {
  const now = Date.now();
  for (const [k, v] of recent) if (now - v.at > RECENT_MS) recent.delete(k);
  const hit = recent.get(id);
  if (hit) {
    hit.at = now;
    return hit.f;
  }
  const f = await readAsset(id);
  if (f && f.asset.mime.startsWith("video/")) {
    if (recent.size >= RECENT_MAX) recent.delete([...recent].sort((a, b) => a[1].at - b[1].at)[0][0]);
    recent.set(id, { f, at: now });
  }
  return f;
}

/** GET /assets/:id/file?exp=&sig= */
assetsRouter.get("/:id/file", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifyAssetLink(req.params.id, req.query.exp, req.query.sig)) return res.status(403).json({ error: "This link has expired." });
    const f = await readForServing(req.params.id);
    if (!f) return res.status(404).json({ error: "Not found" });
    const maxAge = Math.max(0, Math.floor((Number(req.query.exp) - Date.now()) / 1000));
    res.set("Content-Type", f.asset.mime);
    res.set("Cache-Control", `private, max-age=${maxAge}, immutable`);
    // Loaded from the app's domain (img tags and the editor canvas).
    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    // Video players ask for byte ranges (Safari won't play without them).
    res.set("Accept-Ranges", "bytes");
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
    if (range && (range[1] || range[2])) {
      const size = f.body.length;
      const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) return res.status(416).set("Content-Range", `bytes */${size}`).end();
      res.status(206).set("Content-Range", `bytes ${start}-${end}/${size}`);
      return res.send(f.body.subarray(start, end + 1));
    }
    res.send(f.body);
  } catch (err) {
    next(err);
  }
});

export const designsRouter = Router();
designsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
const uploadClip = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_CLIP_BYTES, files: 1 } });
const accessOf = async (req: Request) => {
  const a = await getAccess(req);
  if (!a) throw Object.assign(new Error("No workspace found"), { status: 404 });
  return a;
};
const fileOf = (req: Request) => {
  if (!storageConfigured()) throw Object.assign(new Error("File storage isn't set up on this server yet (R2)."), { status: 503 });
  if (!req.file?.buffer?.length) throw Object.assign(new Error("No image received (field name must be 'image')."), { status: 400 });
  return req.file.buffer;
};

/** GET /designs/sizes */
designsRouter.get("/sizes", (_req: Request, res: Response) => {
  res.json({ sizes: SIZES });
});

/** GET /designs?clientId= */
designsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ designs: await listDesigns(await accessOf(req), apiBase(req), typeof req.query.clientId === "string" && req.query.clientId ? req.query.clientId : null) });
  } catch (err) {
    next(err);
  }
});

/** GET /designs/:id — the document and its file links. */
designsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getDesign(await accessOf(req), apiBase(req), req.params.id));
  } catch (err) {
    next(err);
  }
});

/** POST /designs { name?, width, height, clientId?, data? } */
designsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createDesign(await accessOf(req), req.dbUserId!, apiBase(req), req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** PUT /designs/:id { name?, width?, height?, data? } */
designsRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await saveDesign(await accessOf(req), apiBase(req), req.params.id, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/images (multipart image) — an image placed in the design. */
designsRouter.post("/:id/images", upload.single("image"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await addImage(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id, fileOf(req)));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/images/from-creative { creativeId } — an image from the Creatives library. */
designsRouter.post("/:id/images/from-creative", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!storageConfigured()) throw Object.assign(new Error("File storage isn't set up on this server yet (R2)."), { status: 503 });
    res.status(201).json(await importCreativeImage(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id, String(req.body?.creativeId ?? "")));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/copy { name, width, height, data } — one-click resize: a new design in another size (C19b). */
designsRouter.post("/:id/copy", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!storageConfigured()) throw Object.assign(new Error("File storage isn't set up on this server yet (R2)."), { status: 503 });
    res.status(201).json(await copyDesign(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/images/from-brand { assetId } — a logo from a brand kit (C19b). */
designsRouter.post("/:id/images/from-brand", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!storageConfigured()) throw Object.assign(new Error("File storage isn't set up on this server yet (R2)."), { status: 503 });
    res.status(201).json(await addBrandLogo(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id, String(req.body?.assetId ?? "")));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/preview (multipart image) — the draft's thumbnail. */
designsRouter.post("/:id/preview", upload.single("image"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await savePreview(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id, fileOf(req)));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/export (multipart PNG) — Save to Creatives. */
designsRouter.post("/:id/export", upload.single("image"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await exportDesign(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id, fileOf(req)));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/clips (multipart video) — footage placed in the design (C20b): converted to a standard MP4 and stored. */
designsRouter.post("/:id/clips", uploadClip.single("video"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!storageConfigured()) throw Object.assign(new Error("File storage isn't set up on this server yet (R2)."), { status: 503 });
    if (!req.file?.buffer?.length) throw Object.assign(new Error("No video received (field name must be 'video')."), { status: 400 });
    res.status(201).json(await addClip(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id, req.file.buffer));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/clips/from-creative { creativeId } — a video from the Creatives library, as a clip (C20b). */
designsRouter.post("/:id/clips/from-creative", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!storageConfigured()) throw Object.assign(new Error("File storage isn't set up on this server yet (R2)."), { status: 503 });
    res.status(201).json(await importCreativeClip(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id, String(req.body?.creativeId ?? "")));
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/video — render the design's motion to an MP4 (C20a). Answers at once; poll GET. */
designsRouter.post("/:id/video", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!storageConfigured()) throw Object.assign(new Error("File storage isn't set up on this server yet (R2)."), { status: 503 });
    res.status(202).json({ render: await startVideoRender(await accessOf(req), req.dbUserId!, apiBase(req), req.params.id) });
  } catch (err) {
    next(err);
  }
});

/** POST /designs/:id/video/export — "Save to Creatives" for a video design: the finished MP4 becomes its (VIDEO) Creative. */
designsRouter.post("/:id/video/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await exportDesignVideo(await accessOf(req), apiBase(req), req.params.id));
  } catch (err) {
    next(err);
  }
});

/** GET /designs/:id/video — the latest render: status, progress, and the links when it's done. */
designsRouter.get("/:id/video", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ render: await getVideoRender(await accessOf(req), apiBase(req), req.params.id) });
  } catch (err) {
    next(err);
  }
});

/** DELETE /designs/:id — the design, its Creative and its files in R2. */
designsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteDesign(await accessOf(req), req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Brand kits (plan C19b): GET/PUT /brand-kit?clientId= (empty or "shared" =
 * the workspace's own kit), logos as multipart field "image".
 */
export const brandRouter = Router();
brandRouter.use(requireAuth);

/** GET /brand-kit?clientId= */
brandRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getBrandKit(await accessOf(req), apiBase(req), req.query.clientId));
  } catch (err) {
    next(err);
  }
});

/** PUT /brand-kit { clientId?, colors?, headingFont?, bodyFont? } */
brandRouter.put("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateBrandKit(await accessOf(req), apiBase(req), req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

/** POST /brand-kit/logos?clientId= (multipart image) */
brandRouter.post("/logos", upload.single("image"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await addKitLogo(await accessOf(req), req.dbUserId!, apiBase(req), req.query.clientId ?? req.body?.clientId, fileOf(req)));
  } catch (err) {
    next(err);
  }
});

/** DELETE /brand-kit/logos/:assetId?clientId= */
brandRouter.delete("/logos/:assetId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await removeBrandLogo(await accessOf(req), apiBase(req), req.query.clientId, req.params.assetId));
  } catch (err) {
    next(err);
  }
});
