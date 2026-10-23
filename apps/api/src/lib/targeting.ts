import type { Prisma } from "@prisma/client";

/** Readers for Meta targeting JSON (ad sets, saved audiences), shared by B4 and A9. */

type T = Record<string, unknown>;
const obj = (t: Prisma.JsonValue | null | undefined): T => (t && typeof t === "object" && !Array.isArray(t) ? (t as T) : {});
const ids = (v: unknown, field = "id") => (Array.isArray(v) ? (v as T[]).map((x) => String(x?.[field] ?? "")).filter(Boolean) : []);

/** "Women 25–44 · US, CA · Skincare, Beauty +2" from Meta targeting JSON. */
export function audienceLine(t: Prisma.JsonValue | null): string {
  if (!t || typeof t !== "object" || Array.isArray(t)) return "";
  const x = t as Record<string, unknown>;
  const parts: string[] = [];
  const auto = (x.targeting_automation as { advantage_audience?: number } | undefined)?.advantage_audience === 1;
  const genders = Array.isArray(x.genders) ? (x.genders as number[]) : [];
  const who = genders.length === 1 ? (genders[0] === 1 ? "Men" : "Women") : auto ? "Advantage+ audience" : "Everyone";
  const ageMin = typeof x.age_min === "number" ? x.age_min : null;
  const ageMax = typeof x.age_max === "number" ? x.age_max : null;
  parts.push(ageMin || ageMax ? `${who} ${ageMin ?? 18}–${ageMax && ageMax < 65 ? ageMax : "65+"}` : who);
  const geo = (x.geo_locations ?? {}) as { countries?: string[]; cities?: Array<{ name?: string }>; regions?: Array<{ name?: string }> };
  const places = [...(geo.countries ?? []), ...(geo.regions ?? []).map((r) => r.name ?? ""), ...(geo.cities ?? []).map((c) => c.name ?? "")].filter(Boolean);
  if (places.length) parts.push(places.length > 3 ? `${places.slice(0, 3).join(", ")} +${places.length - 3}` : places.join(", "));
  const named = (v: unknown) => (Array.isArray(v) ? (v as Array<{ name?: string }>).map((i) => i.name ?? "").filter(Boolean) : []);
  const audiences = named(x.custom_audiences);
  const interests = [
    ...named(x.interests),
    ...(Array.isArray(x.flexible_spec) ? (x.flexible_spec as Array<Record<string, unknown>>).flatMap((f) => [...named(f.interests), ...named(f.behaviors)]) : []),
  ];
  const extra = [...audiences, ...interests];
  if (extra.length) parts.push(extra.length > 2 ? `${extra.slice(0, 2).join(", ")} +${extra.length - 2}` : extra.join(", "));
  return parts.join(" · ");
}

/** Custom audiences an ad set / audience includes and excludes (Meta ids). */
export function customAudienceIds(t: Prisma.JsonValue | null | undefined) {
  const x = obj(t);
  return { included: ids(x.custom_audiences), excluded: ids(x.excluded_custom_audiences) };
}

/** The comparable parts of a targeting spec (near-duplicate check). */
export function targetingKey(t: Prisma.JsonValue | null | undefined) {
  const x = obj(t);
  const geo = obj(x.geo_locations as Prisma.JsonValue);
  const interests = [
    ...ids(x.interests),
    ...(Array.isArray(x.flexible_spec) ? (x.flexible_spec as T[]).flatMap((f) => [...ids(f.interests), ...ids(f.behaviors)]) : []),
  ];
  return {
    countries: (Array.isArray(geo.countries) ? (geo.countries as string[]) : []).slice().sort(),
    cities: ids(geo.cities, "key").sort(),
    ageMin: typeof x.age_min === "number" ? x.age_min : 18,
    ageMax: typeof x.age_max === "number" ? x.age_max : 65,
    genders: (Array.isArray(x.genders) ? (x.genders as number[]) : []).slice().sort().join(","),
    interests: [...new Set(interests)],
    custom: ids(x.custom_audiences).sort(),
  };
}
