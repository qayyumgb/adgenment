import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { assertClientAccess, type Access } from "../lib/access";
import { assetError, assetUrl, copyAsset, createAsset, deleteAssets } from "./assets.service";

/**
 * Brand kits (plan C19b): per client, logos + colours + fonts for the creative
 * editor; `clientId` null is the workspace's own kit (shared designs).
 *
 * - Logos are Assets of kind "brand" (no design), compressed like any upload
 *   (WebP, transparency kept). Removing one deletes the file from R2.
 * - Placing a logo in a design copies the file into that design, so designs
 *   never depend on the kit.
 * - Limited members (client access only) can read the shared kit but only
 *   change their own clients' kits.
 */

export const MAX_COLORS = 12;
export const MAX_LOGOS = 6;
const HEX = /^#[0-9a-f]{6}$/i;
const FONT = /^[A-Za-z0-9 ]{2,60}$/;

type Json = Record<string, unknown>;
const ids = (v: Prisma.JsonValue | null | undefined) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function clientOf(raw: unknown): string | null {
  return typeof raw === "string" && raw && raw !== "shared" ? raw : null;
}

async function checkClient(access: Access, clientId: string | null, write: boolean) {
  if (clientId) {
    const c = await prisma.client.findFirst({ where: { id: clientId, workspaceId: access.workspaceId }, select: { id: true } });
    if (!c) throw assetError(404, "Client not found");
    assertClientAccess(access, clientId);
  } else if (write && access.clientIds) {
    throw assetError(403, "Only people with access to every client can change the shared brand kit.");
  }
}

const find = (workspaceId: string, clientId: string | null) => prisma.brandKit.findFirst({ where: { workspaceId, clientId } });

async function ensure(workspaceId: string, clientId: string | null) {
  return (await find(workspaceId, clientId)) ?? prisma.brandKit.create({ data: { workspaceId, clientId } });
}

async function view(base: string, workspaceId: string, clientId: string | null) {
  const k = await find(workspaceId, clientId);
  const logoIds = ids(k?.logoIds);
  const assets = logoIds.length ? await prisma.asset.findMany({ where: { id: { in: logoIds }, workspaceId, kind: "brand" }, select: { id: true, width: true, height: true } }) : [];
  const byId = new Map(assets.map((a) => [a.id, a]));
  return {
    clientId,
    colors: ids(k?.colors),
    headingFont: k?.headingFont ?? null,
    bodyFont: k?.bodyFont ?? null,
    logos: logoIds.filter((id) => byId.has(id)).map((id) => ({ ...byId.get(id)!, url: assetUrl(base, id) })),
    updatedAt: k?.updatedAt ?? null,
  };
}

/** The kit for a client (or the shared one); an empty kit when nothing is saved yet. */
export async function getBrandKit(access: Access, base: string, rawClientId: unknown) {
  const clientId = clientOf(rawClientId);
  await checkClient(access, clientId, false);
  return view(base, access.workspaceId, clientId);
}

/** Colours and fonts (logos have their own calls). Only the fields sent change. */
export async function updateBrandKit(access: Access, base: string, body: Json) {
  const clientId = clientOf(body.clientId);
  await checkClient(access, clientId, true);
  const data: Prisma.BrandKitUpdateInput = {};
  if (body.colors !== undefined) {
    if (!Array.isArray(body.colors) || body.colors.some((c) => typeof c !== "string" || !HEX.test(c))) throw assetError(400, "Colours must be hex values like #6448f2.");
    data.colors = [...new Set((body.colors as string[]).map((c) => c.toLowerCase()))].slice(0, MAX_COLORS);
  }
  for (const key of ["headingFont", "bodyFont"] as const) {
    if (body[key] === undefined) continue;
    const v = body[key];
    if (v !== null && (typeof v !== "string" || !FONT.test(v))) throw assetError(400, "Pick a font from the list.");
    data[key] = v as string | null;
  }
  const k = await ensure(access.workspaceId, clientId);
  await prisma.brandKit.update({ where: { id: k.id }, data });
  return view(base, access.workspaceId, clientId);
}

export async function addBrandLogo(access: Access, userId: string, base: string, rawClientId: unknown, file: Buffer) {
  const clientId = clientOf(rawClientId);
  await checkClient(access, clientId, true);
  const k = await ensure(access.workspaceId, clientId);
  const current = ids(k.logoIds);
  if (current.length >= MAX_LOGOS) throw assetError(400, `A brand kit holds up to ${MAX_LOGOS} logos. Remove one first.`);
  const a = await createAsset({ workspaceId: access.workspaceId, createdById: userId, kind: "brand", input: file });
  await prisma.brandKit.update({ where: { id: k.id }, data: { logoIds: [...current, a.id] } });
  return view(base, access.workspaceId, clientId);
}

/** Remove a logo from the kit and delete its file (designs that used it keep their own copy). */
export async function removeBrandLogo(access: Access, base: string, rawClientId: unknown, assetId: string) {
  const clientId = clientOf(rawClientId);
  await checkClient(access, clientId, true);
  const k = await find(access.workspaceId, clientId);
  const current = ids(k?.logoIds);
  if (!k || !current.includes(assetId)) throw assetError(404, "Logo not found");
  await prisma.brandKit.update({ where: { id: k.id }, data: { logoIds: current.filter((id) => id !== assetId) } });
  await deleteAssets({ id: { in: [assetId] } });
  return view(base, access.workspaceId, clientId);
}

/** Copy a brand logo into a design (as one of its uploads). The caller has checked the design. */
export async function copyLogoIntoDesign(workspaceId: string, designId: string, userId: string, base: string, assetId: string) {
  const src = await prisma.asset.findFirst({ where: { id: assetId, workspaceId, kind: "brand" } });
  if (!src) throw assetError(404, "That logo isn't in a brand kit any more.");
  const a = await copyAsset(src, { designId, createdById: userId, kind: "upload" });
  return { id: a.id, url: assetUrl(base, a.id), width: a.width, height: a.height };
}

/**
 * Brand files no kit refers to any more (a kit deleted with its client, or a
 * failed save): deleted from R2 after a day. Run by the hourly design cleanup.
 */
export async function cleanupBrandFiles(now = new Date()) {
  const old = await prisma.asset.findMany({ where: { kind: "brand", createdAt: { lt: new Date(now.getTime() - 86_400_000) } }, select: { id: true, workspaceId: true } });
  if (!old.length) return 0;
  const kits = await prisma.brandKit.findMany({ where: { workspaceId: { in: [...new Set(old.map((a) => a.workspaceId))] } }, select: { logoIds: true } });
  const used = new Set(kits.flatMap((k) => ids(k.logoIds)));
  const orphans = old.filter((a) => !used.has(a.id)).map((a) => a.id);
  return orphans.length ? deleteAssets({ id: { in: orphans } }) : 0;
}
