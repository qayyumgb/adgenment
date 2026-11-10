import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import sharp from "sharp";
import type { Asset } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { deleteObjects, deletePrefix, getObject, putObject } from "../lib/storage";

/**
 * Images for the creative editor (plan C19), kept in Cloudflare R2.
 *
 * - **Compressed on upload** with sharp: auto-rotated, metadata stripped,
 *   at most 4096 px on the long side, WebP at quality 90 (visually lossless;
 *   transparency kept for logos and cut-outs). Exported ads use quality 92.
 * - **Private bucket, signed links:** the API serves each file at
 *   /api/assets/:id/file?exp=&sig=, an HMAC link valid for a week. Links
 *   change once a day, so browsers cache them, and the canvas can load them
 *   (CORS) to edit and export.
 * - **Deleting** removes the file from R2 as well as the row; a workspace's
 *   whole folder (ws/<workspaceId>/) goes when the workspace is deleted.
 */

const DAY = 86_400_000;
const MAX_SIDE = 4096;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const assetError = (status: number, message: string) => Object.assign(new Error(message), { status });

const secret = () => {
  if (process.env.ASSET_URL_SECRET) return process.env.ASSET_URL_SECRET;
  // Derived from the existing server key, so no extra setting is needed.
  return createHash("sha256").update(`advertix-assets:${process.env.TOKEN_ENCRYPTION_KEY ?? "dev"}`).digest("hex");
};
const sign = (id: string, exp: number) => createHmac("sha256", secret()).update(`${id}.${exp}`).digest("base64url");

/** The API's public address, for absolute file links. */
export function apiBase(req: { protocol: string; get(name: string): string | undefined }) {
  return (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

/** A signed link to the file, valid 7–8 days; the same all day, so it caches. */
export function assetUrl(base: string, id: string, now = Date.now()) {
  const exp = Math.floor(now / DAY) * DAY + 8 * DAY;
  return `${base}/api/assets/${id}/file?exp=${exp}&sig=${sign(id, exp)}`;
}

export function verifyAssetLink(id: string, exp: unknown, sig: unknown, now = Date.now()) {
  const e = Number(exp);
  if (!Number.isFinite(e) || e < now || typeof sig !== "string") return false;
  const want = Buffer.from(sign(id, e));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Compress an image for storage (WebP). Throws 400 for anything that isn't a readable image. */
export async function compress(input: Buffer, quality = 90) {
  try {
    const { data, info } = await sharp(input, { failOn: "none", limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality, alphaQuality: 100, smartSubsample: true, effort: 5 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    throw assetError(400, "That file isn't an image Advertix can read (JPG, PNG, WebP or GIF).");
  }
}

/** Compress and store one image. */
export async function createAsset(opts: { workspaceId: string; designId?: string | null; createdById?: string | null; kind: "upload" | "preview" | "export" | "brand"; input: Buffer; quality?: number }): Promise<Asset> {
  if (opts.input.length > MAX_UPLOAD_BYTES) throw assetError(413, "Images can be up to 15 MB.");
  const { data, width, height } = await compress(opts.input, opts.quality ?? 90);
  const id = randomBytes(12).toString("hex");
  const key = `ws/${opts.workspaceId}/${id}.webp`;
  try {
    await putObject(key, data, "image/webp");
  } catch (err) {
    // The real reason goes to the log; people get something they can act on.
    console.error("[assets] storage upload failed:", err instanceof Error ? err.message : err);
    throw assetError(502, "Couldn't save the image to file storage. Try again; if it keeps failing, check the R2 settings on the server.");
  }
  try {
    return await prisma.asset.create({ data: { id, workspaceId: opts.workspaceId, designId: opts.designId ?? null, key, mime: "image/webp", width, height, bytes: data.length, kind: opts.kind, createdById: opts.createdById ?? null } });
  } catch (err) {
    await deleteObjects([key]).catch(() => undefined);
    throw err;
  }
}

/** A byte-for-byte copy of an asset under a new id (e.g. a brand logo placed in a design): no re-compression. */
export async function copyAsset(source: Asset, opts: { designId: string | null; createdById?: string | null; kind: "upload" | "brand" }): Promise<Asset> {
  const body = await getObject(source.key);
  if (!body) throw assetError(404, "That image is no longer in file storage.");
  const id = randomBytes(12).toString("hex");
  const key = `ws/${source.workspaceId}/${id}.webp`;
  try {
    await putObject(key, body, source.mime);
  } catch (err) {
    console.error("[assets] storage copy failed:", err instanceof Error ? err.message : err);
    throw assetError(502, "Couldn't copy the image in file storage. Try again.");
  }
  try {
    return await prisma.asset.create({ data: { id, workspaceId: source.workspaceId, designId: opts.designId, key, mime: source.mime, width: source.width, height: source.height, bytes: body.length, kind: opts.kind, createdById: opts.createdById ?? null } });
  } catch (err) {
    await deleteObjects([key]).catch(() => undefined);
    throw err;
  }
}

/** The file of an asset, or null. */
export async function readAsset(id: string) {
  const a = await prisma.asset.findUnique({ where: { id } });
  if (!a) return null;
  const body = await getObject(a.key);
  return body ? { asset: a, body } : null;
}

/** Delete assets: files from R2 first, then the rows. */
export async function deleteAssets(where: { id: { in: string[] } } | { designId: string }) {
  const rows = await prisma.asset.findMany({ where, select: { id: true, key: true } });
  if (!rows.length) return 0;
  await deleteObjects(rows.map((r) => r.key));
  await prisma.asset.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
  return rows.length;
}

/** A workspace's whole R2 folder (workspace deletion; the rows go with the workspace). */
export async function deleteWorkspaceFiles(workspaceId: string) {
  try {
    await deletePrefix(`ws/${workspaceId}/`);
  } catch (err) {
    console.error(`[assets] couldn't delete the files of workspace ${workspaceId}:`, err instanceof Error ? err.message : err);
  }
}
