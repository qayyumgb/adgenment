import type { AudienceBoardItem, AudienceBoardStatus } from "@/lib/api";
import type { PillTone } from "@/components/app/ui";

/** Audiences board view helpers (plan A9). */

export const STATUS_TONE: Record<AudienceBoardStatus, PillTone> = {
  Ready: "pos",
  Unused: "neutral",
  Building: "brand",
  "Learning limited": "warn",
  Underperforming: "neg",
};

export const SOURCE_LABEL: Record<AudienceBoardItem["source"], string> = {
  library: "Saved in Advertix",
  "meta-custom": "Meta custom & lookalike",
  "meta-saved": "Saved on Meta",
};

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e4 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en-US"));

/** Meta reports sizes as ranges; saved audiences only know their largest interest. */
export function sizeText(i: Pick<AudienceBoardItem, "sizeLower" | "sizeUpper" | "source">): string {
  if (i.sizeLower && i.sizeUpper && i.sizeLower !== i.sizeUpper) return `${compact(i.sizeLower)}–${compact(i.sizeUpper)}`;
  if (i.sizeUpper) return i.source === "library" ? `${compact(i.sizeUpper)}+` : compact(i.sizeUpper);
  return "—";
}
export const sizeHint = (i: AudienceBoardItem) =>
  i.source === "library" ? "At least this many: the largest interest's reach, as Meta reported it when the audience was built." : "Meta's estimate; it reports a range, never an exact count.";

export const roasOf = (i: AudienceBoardItem) => (i.totals.spend > 0 && i.totals.revenue > 0 ? i.totals.revenue / i.totals.spend : null);
export const cpaOf = (i: AudienceBoardItem) => (i.totals.conversions > 0 ? i.totals.spend / i.totals.conversions : null);
