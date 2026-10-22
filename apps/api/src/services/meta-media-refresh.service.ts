/**
 * Refresh expired Meta CDN URLs on creatives (refresh-on-read).
 *
 * Meta's `scontent…fbcdn.net` image and video-poster URLs are signed and
 * carry an expiry (`oe=` hex unix timestamp), so creative previews broke a
 * few days after upload. Creatives also store the stable identifiers —
 * `imageHash` (also per carousel card) and `videoId` — so on read we
 * re-resolve URLs that are expired or about to expire, write them back, and
 * return the fresh content. Meta is only called when something is stale.
 *
 * Fails soft: if Meta errors or no Meta account is connected, the stored
 * URLs are returned unchanged and the list request never fails.
 * See IMPLEMENTATION.md → Roadmap Phase 1 (high priority item).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { metaService } from "./meta.service";

/** Refresh URLs that expire within this window, not only already-dead ones. */
const EXPIRY_MARGIN_MS = 60 * 60 * 1000;

/**
 * Ids Meta couldn't resolve (deleted image, other account, API error) are
 * not retried for a while, so a dead hash doesn't add Meta calls to every
 * library load. Per process; cleared on restart.
 */
const MISS_TTL_MS = 30 * 60 * 1000;
const misses = new Map<string, number>();
const recentlyMissed = (key: string) => (misses.get(key) ?? 0) > Date.now();
const markMissed = (key: string) => {
  if (misses.size > 10_000) misses.clear();
  misses.set(key, Date.now() + MISS_TTL_MS);
};

type Json = Record<string, unknown>;
type CreativeRow = { id: string; content: Prisma.JsonValue };

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * True when a URL is a Meta CDN URL whose `oe=` expiry has passed or is
 * within the margin. Missing URL → true (we have an id but no usable URL).
 * Non-Meta URLs and Meta URLs without `oe` are left alone.
 */
export function isStaleMetaUrl(url: string | null, now = Date.now()): boolean {
  if (!url) return true;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!/(^|\.)fbcdn\.net$|(^|\.)facebook\.com$|^scontent/i.test(u.hostname)) return false;
  const oe = u.searchParams.get("oe");
  if (!oe || !/^[0-9a-f]+$/i.test(oe)) return false;
  return parseInt(oe, 16) * 1000 < now + EXPIRY_MARGIN_MS;
}

type Plan = {
  hashes: Set<string>;
  videoIds: Set<string>;
};

/** Collect the hashes / video ids whose stored URL needs refreshing. */
function collect(rows: CreativeRow[]): Plan {
  const plan: Plan = { hashes: new Set(), videoIds: new Set() };
  for (const r of rows) {
    const c = r.content;
    if (!isObj(c)) continue;
    const hash = str(c.imageHash);
    if (hash && isStaleMetaUrl(str(c.imageUrl) ?? str(c.url))) plan.hashes.add(hash);
    const videoId = str(c.videoId);
    if (videoId && isStaleMetaUrl(str(c.thumbnailUrl) ?? str(c.url))) plan.videoIds.add(videoId);
    if (Array.isArray(c.cards)) {
      for (const card of c.cards) {
        if (!isObj(card)) continue;
        const h = str(card.imageHash);
        if (h && isStaleMetaUrl(str(card.imageUrl) ?? str(card.url))) plan.hashes.add(h);
      }
    }
  }
  return plan;
}

/** Apply fresh URLs to one creative's content; returns null when unchanged. */
function patch(
  content: Prisma.JsonValue,
  images: Map<string, string>,
  pictures: Map<string, string>
): Json | null {
  if (!isObj(content)) return null;
  const next: Json = { ...content };
  let changed = false;

  const hash = str(next.imageHash);
  const freshImage = hash ? images.get(hash) : undefined;
  if (freshImage && freshImage !== next.url) {
    next.url = freshImage;
    if ("imageUrl" in next) next.imageUrl = freshImage;
    changed = true;
  }

  const videoId = str(next.videoId);
  const freshPoster = videoId ? pictures.get(videoId) : undefined;
  if (freshPoster && freshPoster !== next.thumbnailUrl) {
    // For videos `url` is the poster used by the library preview.
    if (!str(next.url) || next.url === next.thumbnailUrl || isStaleMetaUrl(str(next.url))) next.url = freshPoster;
    next.thumbnailUrl = freshPoster;
    changed = true;
  }

  if (Array.isArray(next.cards)) {
    const cards = next.cards.map((card) => {
      if (!isObj(card)) return card;
      const h = str(card.imageHash);
      const fresh = h ? images.get(h) : undefined;
      if (!fresh || fresh === card.url) return card;
      changed = true;
      return { ...card, url: fresh, ...("imageUrl" in card ? { imageUrl: fresh } : {}) };
    });
    next.cards = cards;
    // Carousel previews use the first card's image as the top-level url.
    const first = cards[0];
    if (isObj(first) && str(first.url) && !hash && !videoId && next.url !== first.url) {
      next.url = first.url;
      changed = true;
    }
  }

  return changed ? next : null;
}

/**
 * Refresh stale Meta media URLs on `rows` in place (and persist them).
 * Safe to call on every list read: it's a no-op when nothing is stale.
 */
export async function refreshExpiredMetaMedia<T extends CreativeRow>(workspaceId: string, rows: T[]): Promise<void> {
  const plan = collect(rows);
  plan.hashes.forEach((h) => recentlyMissed(`h:${workspaceId}:${h}`) && plan.hashes.delete(h));
  plan.videoIds.forEach((v) => recentlyMissed(`v:${workspaceId}:${v}`) && plan.videoIds.delete(v));
  if (plan.hashes.size === 0 && plan.videoIds.size === 0) return;

  try {
    // Image hashes are scoped to the ad account that uploaded them, and
    // creatives don't record which one — so try each active Meta account
    // (newest first, matching the upload routes) until all are found.
    const accounts = await prisma.adAccount.findMany({
      where: { workspaceId, platform: "META", isActive: true },
      orderBy: { createdAt: "desc" },
      select: { accountId: true, accessToken: true },
    });
    if (accounts.length === 0) return;

    const images = new Map<string, string>();
    const pictures = new Map<string, string>();
    let pendingHashes = [...plan.hashes];

    for (const acct of accounts) {
      const token = metaService.decryptToken(acct.accessToken);
      if (pendingHashes.length) {
        try {
          const found = await metaService.getAdImagesByHash(token, acct.accountId, pendingHashes);
          found.forEach((v, h) => v.url && images.set(h, v.url));
          pendingHashes = pendingHashes.filter((h) => !images.has(h));
        } catch (err) {
          console.warn("[meta-media-refresh] adimages lookup failed:", err instanceof Error ? err.message : err);
        }
      }
      if (pictures.size === 0 && plan.videoIds.size) {
        try {
          (await metaService.getVideoPictures(token, [...plan.videoIds])).forEach((v, id) => pictures.set(id, v));
        } catch (err) {
          console.warn("[meta-media-refresh] video picture lookup failed:", err instanceof Error ? err.message : err);
        }
      }
      if (pendingHashes.length === 0 && (pictures.size > 0 || plan.videoIds.size === 0)) break;
    }

    pendingHashes.forEach((h) => markMissed(`h:${workspaceId}:${h}`));
    plan.videoIds.forEach((v) => !pictures.has(v) && markMissed(`v:${workspaceId}:${v}`));

    const updates: Promise<unknown>[] = [];
    for (const row of rows) {
      const next = patch(row.content, images, pictures);
      if (!next) continue;
      row.content = next as Prisma.JsonValue;
      updates.push(
        prisma.creative.update({ where: { id: row.id }, data: { content: next as Prisma.InputJsonValue } })
      );
    }
    if (updates.length) await Promise.allSettled(updates);
  } catch (err) {
    // Never fail the list request over a preview refresh.
    console.warn("[meta-media-refresh] skipped:", err instanceof Error ? err.message : err);
  }
}
