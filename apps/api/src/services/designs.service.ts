import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { assertClientAccess, type Access } from "../lib/access";
import { metaService } from "./meta.service";
import { assetError, assetUrl, createAsset, deleteAssets, readAsset } from "./assets.service";

/**
 * Creative editor designs (plan C19a). A design is a Fabric.js document whose
 * images are references ("asset:<id>") to files in R2, so it reopens exactly
 * as saved. "Save to Creatives" stores the exported ad in R2, uploads it to
 * the workspace's Meta ad account when one is connected (ready to publish),
 * and makes or updates its Creative. Deleting the design, or its Creative,
 * deletes the design's files from R2 too.
 */

export const SIZES = [
  { width: 1080, height: 1080, label: "Square 1:1 (feed)" },
  { width: 1200, height: 628, label: "Landscape 1.91:1 (link ads)" },
  { width: 1080, height: 1920, label: "Vertical 9:16 (Stories, Reels)" },
] as const;
const MAX_DATA_CHARS = 1_500_000;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const validSize = (w: unknown, h: unknown) => SIZES.find((s) => s.width === Number(w) && s.height === Number(h));

async function load(access: Access, id: string) {
  const d = await prisma.design.findFirst({ where: { id, workspaceId: access.workspaceId } });
  if (!d) throw assetError(404, "Design not found");
  assertClientAccess(access, d.clientId, { allowShared: true });
  return d;
}

/** The design's file links, by asset id (the editor swaps "asset:<id>" for these). */
async function assetLinks(base: string, designId: string) {
  const rows = await prisma.asset.findMany({ where: { designId }, select: { id: true } });
  return Object.fromEntries(rows.map((r) => [r.id, assetUrl(base, r.id)]));
}

function view(base: string, d: Prisma.DesignGetPayload<object>) {
  return {
    id: d.id,
    name: d.name,
    width: d.width,
    height: d.height,
    clientId: d.clientId,
    creativeId: d.creativeId,
    revision: d.revision,
    previewUrl: d.previewAssetId ? assetUrl(base, d.previewAssetId) : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function listDesigns(access: Access, base: string, clientId: string | null) {
  const where: Prisma.DesignWhereInput = { workspaceId: access.workspaceId };
  if (clientId) where.OR = [{ clientId }, { clientId: null }];
  else if (access.clientIds) where.OR = [{ clientId: { in: access.clientIds } }, { clientId: null }];
  const rows = await prisma.design.findMany({ where, orderBy: { updatedAt: "desc" }, take: 200 });
  return rows.map((d) => view(base, d));
}

export async function getDesign(access: Access, base: string, id: string) {
  const d = await load(access, id);
  return { ...view(base, d), data: d.data, assets: await assetLinks(base, d.id) };
}

export async function createDesign(access: Access, userId: string, base: string, body: Json) {
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 120) : "Untitled design";
  const size = validSize(body.width, body.height);
  if (!size) throw assetError(400, "Pick one of the ad sizes: 1080×1080, 1200×628 or 1080×1920.");
  const clientId = typeof body.clientId === "string" && body.clientId ? body.clientId : null;
  if (clientId) {
    const c = await prisma.client.findFirst({ where: { id: clientId, workspaceId: access.workspaceId }, select: { id: true } });
    if (!c) throw assetError(404, "Client not found");
    assertClientAccess(access, clientId);
  } else if (access.clientIds) throw assetError(400, "Pick one of your clients for this design.");
  const d = await prisma.design.create({ data: { workspaceId: access.workspaceId, clientId, name, width: size.width, height: size.height, data: (isObj(body.data) ? body.data : {}) as Prisma.InputJsonValue, createdById: userId } });
  return { ...view(base, d), data: d.data, assets: {} };
}

export async function saveDesign(access: Access, base: string, id: string, body: Json) {
  const d = await load(access, id);
  const data: Prisma.DesignUpdateInput = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 120);
  if (body.width !== undefined || body.height !== undefined) {
    const size = validSize(body.width, body.height);
    if (!size) throw assetError(400, "Pick one of the ad sizes: 1080×1080, 1200×628 or 1080×1920.");
    data.width = size.width;
    data.height = size.height;
  }
  if (body.data !== undefined) {
    if (!isObj(body.data)) throw assetError(400, "The design is missing.");
    if (JSON.stringify(body.data).length > MAX_DATA_CHARS) throw assetError(413, "This design is too large to save. Remove some layers and try again.");
    data.data = body.data as Prisma.InputJsonValue;
    data.revision = { increment: 1 };
    // Saved from an older copy (another tab or a teammate saved since): refuse rather than overwrite.
    if (typeof body.revision === "number") {
      const r = await prisma.design.updateMany({ where: { id: d.id, revision: body.revision }, data: data as Prisma.DesignUpdateManyMutationInput });
      if (!r.count) throw Object.assign(assetError(409, "This design was changed somewhere else (another tab or a teammate). Reload to get the latest version."), { code: "DESIGN_CHANGED" });
      return view(base, await prisma.design.findUniqueOrThrow({ where: { id: d.id } }));
    }
  }
  const u = await prisma.design.update({ where: { id: d.id }, data });
  return view(base, u);
}

/** Replace the design's small preview (the Creatives grid thumbnail for drafts). */
export async function savePreview(access: Access, userId: string, base: string, id: string, png: Buffer) {
  const d = await load(access, id);
  const a = await createAsset({ workspaceId: access.workspaceId, designId: d.id, createdById: userId, kind: "preview", input: png, quality: 85 });
  await prisma.design.update({ where: { id: d.id }, data: { previewAssetId: a.id } });
  if (d.previewAssetId && d.previewAssetId !== d.exportAssetId) await deleteAssets({ id: { in: [d.previewAssetId] } });
  return { previewUrl: assetUrl(base, a.id) };
}

/** An image placed in the design: compressed and stored in R2. */
export async function addImage(access: Access, userId: string, base: string, id: string, file: Buffer) {
  const d = await load(access, id);
  const a = await createAsset({ workspaceId: access.workspaceId, designId: d.id, createdById: userId, kind: "upload", input: file });
  return { id: a.id, url: assetUrl(base, a.id), width: a.width, height: a.height };
}

/**
 * An image from the Creatives library, copied into the design (fetched by the
 * server, so links that the browser can't read onto a canvas still work).
 */
export async function importCreativeImage(access: Access, userId: string, base: string, id: string, creativeId: string) {
  const d = await load(access, id);
  const c = await prisma.creative.findFirst({ where: { id: creativeId, workspaceId: access.workspaceId } });
  if (!c) throw assetError(404, "Creative not found");
  const content = (isObj(c.content) ? c.content : {}) as Json;
  let bytes: Buffer | null = null;
  if (typeof content.assetId === "string") bytes = (await readAsset(content.assetId))?.body ?? null;
  const urls = [content.imageUrl, content.url, content.dataUrl].filter((u): u is string => typeof u === "string" && u.length > 0);
  for (const u of urls) {
    if (bytes) break;
    if (u.startsWith("data:image/")) bytes = Buffer.from(u.slice(u.indexOf(",") + 1), "base64");
    else if (/^https:\/\//.test(u)) bytes = await fetch(u).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? Buffer.from(b) : null)).catch(() => null);
  }
  // Meta's links expire; a fresh one by the image hash.
  if (!bytes && typeof content.imageHash === "string") {
    const acct = await prisma.adAccount.findFirst({ where: { workspaceId: access.workspaceId, platform: "META", isActive: true }, orderBy: { createdAt: "desc" } });
    if (acct) {
      const fresh = await metaService.getAdImagesByHash(metaService.decryptToken(acct.accessToken), acct.accountId, [content.imageHash]).catch(() => null);
      const u = fresh?.get(content.imageHash)?.url;
      if (u) bytes = await fetch(u).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? Buffer.from(b) : null)).catch(() => null);
    }
  }
  if (!bytes) throw assetError(409, "Advertix couldn't get this creative's image. Upload the file instead.");
  return addImage(access, userId, base, d.id, bytes);
}

/**
 * Save to Creatives: the exported PNG is stored (WebP, quality 92), uploaded
 * to Meta when an ad account is connected, and becomes the design's Creative.
 */
export async function exportDesign(access: Access, userId: string, base: string, id: string, png: Buffer) {
  const d = await load(access, id);
  const a = await createAsset({ workspaceId: access.workspaceId, designId: d.id, createdById: userId, kind: "export", input: png, quality: 92 });

  // Ready to publish: the full-quality PNG goes to Meta (hash valid for that ad account).
  let meta: { imageHash: string; metaAccountId: string } | null = null;
  let metaError: string | null = null;
  const acct = await prisma.adAccount.findFirst({ where: { workspaceId: access.workspaceId, platform: "META", isActive: true, ...(d.clientId ? { OR: [{ clientId: d.clientId }, { clientId: null }] } : {}) }, orderBy: { createdAt: "desc" } });
  if (acct) {
    try {
      const r = await metaService.uploadImageFromBytes(metaService.decryptToken(acct.accessToken), acct.accountId, png, `${d.name.replace(/[^\w-]+/g, "-").slice(0, 60) || "design"}.png`, "image/png");
      meta = { imageHash: r.hash, metaAccountId: acct.accountId };
    } catch (err) {
      metaError = err instanceof Error ? err.message : "Meta didn't accept the image";
    }
  }

  const content: Json = { assetId: a.id, designId: d.id, width: d.width, height: d.height, ...(meta ?? {}) };
  const creative = d.creativeId
    ? await prisma.creative.update({ where: { id: d.creativeId }, data: { name: d.name, content: content as Prisma.InputJsonValue, clientId: d.clientId } }).catch(() => null)
    : null;
  const saved = creative ?? (await prisma.creative.create({ data: { workspaceId: access.workspaceId, clientId: d.clientId, name: d.name, type: "IMAGE", status: "DRAFT", content: content as Prisma.InputJsonValue } }));

  const old = [d.exportAssetId, d.previewAssetId].filter((x): x is string => Boolean(x) && x !== a.id);
  await prisma.design.update({ where: { id: d.id }, data: { exportAssetId: a.id, previewAssetId: a.id, creativeId: saved.id } });
  if (old.length) await deleteAssets({ id: { in: old } });
  return { creativeId: saved.id, imageUrl: assetUrl(base, a.id), metaUploaded: Boolean(meta), metaError };
}

/** Delete a design with its Creative and every file it has in R2. */
export async function deleteDesign(access: Access, id: string) {
  const d = await load(access, id);
  await deleteAssets({ designId: d.id });
  if (d.creativeId) await prisma.creative.deleteMany({ where: { id: d.creativeId, workspaceId: access.workspaceId } });
  await prisma.design.delete({ where: { id: d.id } });
}

/** A Creative was deleted: its design (if it came from one) and files go too. */
export async function onCreativeDeleted(workspaceId: string, content: unknown) {
  const c = (isObj(content) ? content : {}) as Json;
  if (typeof c.designId === "string") {
    const d = await prisma.design.findFirst({ where: { id: c.designId, workspaceId } });
    if (d) {
      await deleteAssets({ designId: d.id });
      await prisma.design.delete({ where: { id: d.id } });
      return;
    }
  }
  if (typeof c.assetId === "string") await deleteAssets({ id: { in: [c.assetId] } });
}

/** Library creatives made in the editor: a fresh signed link in place of a stored URL (in memory only). */
export function withAssetUrls<T extends { content: Prisma.JsonValue }>(base: string, creatives: T[]): T[] {
  for (const cr of creatives) {
    const c = cr.content;
    if (isObj(c) && typeof c.assetId === "string") {
      const url = assetUrl(base, c.assetId);
      (c as Json).imageUrl = url;
      (c as Json).url = url;
    }
  }
  return creatives;
}
