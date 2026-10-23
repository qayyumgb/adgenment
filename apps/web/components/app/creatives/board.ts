import type { CreativeBoardItem, CreativeBoardStatus } from "@/lib/api";
import { fmtMoney } from "@/lib/money";
import type { PillTone } from "@/components/app/ui";

/**
 * Creatives board view helpers (plan A8): status tabs, sorting, labels and
 * the plain read shown in the drawer. Everything is derived from the item's
 * own numbers; nothing is estimated.
 */

export const STATUS_TONE: Record<CreativeBoardStatus, PillTone> = {
  Live: "pos",
  Learning: "brand",
  Fatigued: "neg",
  Paused: "warn",
  "In review": "brand",
  Rejected: "neg",
  Ended: "neutral",
  Draft: "neutral",
  Archived: "neutral",
};

export type StatusTab = "all" | "live" | "fatigued" | "draft" | "archived";

export function inTab(i: CreativeBoardItem, tab: StatusTab): boolean {
  switch (tab) {
    case "all":
      return i.status !== "Archived";
    case "live":
      return i.status === "Live" || i.status === "Learning";
    case "fatigued":
      return i.status === "Fatigued";
    case "draft":
      return i.status === "Draft";
    case "archived":
      return i.status === "Archived";
  }
}

/** Copy without the quote marks the model or the user wrapped it in (we add our own). */
export const unquote = (s: string) => s.trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();

export const FORMAT_LABEL: Record<CreativeBoardItem["format"], string> = { IMAGE: "Image", VIDEO: "Video", CAROUSEL: "Carousel", TEXT: "Text", UNKNOWN: "Ad" };

export const formatLine = (i: CreativeBoardItem) =>
  i.format === "CAROUSEL" && i.cardCount > 1 ? `Carousel · ${i.cardCount} cards` : FORMAT_LABEL[i.format];

export const roasOf = (i: CreativeBoardItem) => (i.totals.spend > 0 && i.totals.revenue > 0 ? i.totals.revenue / i.totals.spend : null);
export const ctrOf = (i: CreativeBoardItem) => (i.totals.impressions > 0 ? (i.totals.clicks / i.totals.impressions) * 100 : null);

export type SortKey = "spend" | "roas" | "ctr" | "freq" | "newest" | "name";
export const SORTS: { value: SortKey; label: string }[] = [
  { value: "spend", label: "Spend" },
  { value: "roas", label: "ROAS" },
  { value: "ctr", label: "CTR" },
  { value: "freq", label: "Frequency" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
];

export function sortItems(items: CreativeBoardItem[], key: SortKey): CreativeBoardItem[] {
  const num = (i: CreativeBoardItem) => (key === "spend" ? i.totals.spend : key === "roas" ? roasOf(i) ?? -1 : key === "ctr" ? ctrOf(i) ?? -1 : i.frequency);
  return [...items].sort((a, b) => {
    if (key === "name") return a.name.localeCompare(b.name);
    if (key === "newest") return b.createdAt.localeCompare(a.createdAt);
    // Ties (e.g. drafts with no spend) fall back to newest first.
    return num(b) - num(a) || b.createdAt.localeCompare(a.createdAt);
  });
}

/** One or two sentences about the creative, from its own numbers. */
export function creativeRead(i: CreativeBoardItem, all: CreativeBoardItem[]): string {
  const money = (n: number) => fmtMoney(n, i.currency, { whole: n >= 1000 });
  const r = roasOf(i);
  const c = ctrOf(i);
  if (i.status === "Draft") {
    if (i.needsMedia) return `Copy is ready${i.headline ? ` (“${unquote(i.headline)}”)` : ""}. Add an image or video in Edit, then pick it in a new campaign.`;
    return "Ready to use. Pick it from the library in a new campaign; once it runs, its results show here.";
  }
  if (i.status === "Archived") return "Archived. It stays out of the main view; restore it to use it again.";
  if (i.status === "Rejected") return "Meta rejected this ad. Open it in Ads Manager to see the reason, then fix the creative or copy.";
  if (i.status === "In review") return "Meta is reviewing this ad. Delivery starts once it's approved, usually within a day.";
  if (i.status === "Fatigued" && i.fatigue.reason) return `${i.fatigue.reason} Replace it with a fresh variant this week.`;
  if (i.status === "Learning") return "Still in Meta's learning phase. Give it a few more days before judging CTR or ROAS.";
  if (i.totals.spend <= 0) return i.status === "Paused" ? "Paused, with no spend in this period." : "No spend in this period yet.";
  const peers = all.filter((x) => x.key !== i.key && x.totals.spend > 0 && roasOf(x) !== null);
  const parts = [`${money(i.totals.spend)} spent${r !== null ? ` at ${r.toFixed(2)}x ROAS` : ""}${c !== null ? `, ${c.toFixed(2)}% CTR` : ""}.`];
  if (r !== null && peers.length >= 2) {
    const better = peers.filter((x) => roasOf(x)! > r).length;
    if (better === 0) parts.push("The best return in this view: reuse its opening hook in new variants.");
    else if (better / peers.length < 0.34) parts.push("Among the stronger creatives here.");
    else if (better === peers.length) parts.push("The weakest return in this view; test a new hook before adding budget.");
  }
  if (i.fatigue.level === "watch" && i.fatigue.reason) parts.push(i.fatigue.reason);
  if (i.status === "Paused") parts.push("It's paused now.");
  return parts.join(" ");
}
