"use client";

/**
 * Shared Meta-targeting picker components.
 *
 * Extracted from the publish wizard (PublishToMetaModal) so the Audiences
 * builder and the wizard use ONE implementation — same look, same Meta search
 * endpoints, same selection shapes. All pickers are props-driven
 * (`values` / `onChange`) and self-contained.
 */

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Search, Loader2, Sparkles, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import type {
  MetaCustomAudience,
  MetaSavedAudience,
  MetaTargetingSuggestion,
  MetaGeoLocation,
} from "@/lib/api";

export type SelectedCity = { key: string; name: string };
export type SelectedInterest = { id: string; name: string };
export type SelectedAudience = { id: string; name: string; isLookalike?: boolean };

/** Format a large count compactly (1.2M, 14.0K). */
export function formatBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const COMMON_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "PK", name: "Pakistan" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
  { code: "AE", name: "UAE" },
];

export function ChipList<T extends { id?: string; key?: string; name?: string }>({
  items,
  onRemove,
}: {
  items: T[];
  onRemove: (item: T) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.id ?? item.key}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
        >
          {item.name}
          <button
            type="button"
            onClick={() => onRemove(item)}
            className="rounded-full hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function CountryPicker({
  values,
  onChange,
}: {
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
        Countries
      </label>
      <div className="flex flex-wrap gap-1.5">
        {COMMON_COUNTRIES.map((c) => {
          const selected = values.includes(c.code);
          return (
            <button
              key={c.code}
              type="button"
              onClick={() =>
                onChange(
                  selected
                    ? values.filter((v) => v !== c.code)
                    : [...values, c.code]
                )
              }
              className={clsx(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                selected
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              {c.code} — {c.name}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-slate-400">
        Click to add/remove. Leave empty for worldwide.
      </p>
    </div>
  );
}

export function CityPicker({
  label,
  values,
  onChange,
}: {
  label: string;
  values: SelectedCity[];
  onChange: (v: SelectedCity[]) => void;
}) {
  const api = useApiClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MetaGeoLocation[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchMetaLocations(q, ["city"]);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, api]);

  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a city name…"
          className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm transition focus:border-primary focus:outline-none"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
        )}
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => {
                  if (!values.find((v) => v.key === r.key)) {
                    onChange([...values, { key: r.key, name: r.name }]);
                  }
                  setQ("");
                  setResults([]);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">{r.name}</div>
                <div className="text-[10px] text-slate-500">
                  {r.region ? `${r.region}, ` : ""}
                  {r.countryName}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <ChipList
        items={values}
        onRemove={(item) => onChange(values.filter((v) => v.key !== item.key))}
      />
    </div>
  );
}

export function InterestPicker({
  values,
  onChange,
}: {
  values: SelectedInterest[];
  onChange: (v: SelectedInterest[]) => void;
}) {
  const api = useApiClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MetaTargetingSuggestion[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchMetaInterests(q);
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, api]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search interests (e.g. fitness, cooking, photography)…"
          className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-sm transition focus:border-primary focus:outline-none"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
        )}
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  if (!values.find((v) => v.id === r.id)) {
                    onChange([...values, { id: r.id, name: r.name }]);
                  }
                  setQ("");
                  setResults([]);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">{r.name}</div>
                {r.audienceSize && (
                  <div className="text-[10px] text-slate-500">
                    ~{formatBig(r.audienceSize)} people
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <ChipList
        items={values}
        onRemove={(item) => onChange(values.filter((v) => v.id !== item.id))}
      />
    </div>
  );
}

export function CustomAudiencePicker({
  label,
  values,
  onChange,
}: {
  label: string;
  values: SelectedAudience[];
  onChange: (v: SelectedAudience[]) => void;
}) {
  const audiencesQ = useApi<MetaCustomAudience[]>(
    (c) => c.getMetaCustomAudiences(),
    []
  );

  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {audiencesQ.loading && (
        <div className="text-xs text-slate-500">Loading audiences…</div>
      )}
      {audiencesQ.data && audiencesQ.data.length === 0 && (
        <div className="text-xs text-slate-500">
          No custom audiences in this ad account.
        </div>
      )}
      {audiencesQ.data && audiencesQ.data.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {audiencesQ.data.map((a) => {
            const selected = values.find((v) => v.id === a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  onChange(
                    selected
                      ? values.filter((v) => v.id !== a.id)
                      : [
                          ...values,
                          { id: a.id, name: a.name, isLookalike: a.isLookalike },
                        ]
                  )
                }
                className={clsx(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                  selected
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                {a.isLookalike && <Sparkles className="h-2.5 w-2.5" />}
                {a.name}
                {a.approxSize && (
                  <span className="opacity-70">({formatBig(a.approxSize)})</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SavedAudiencePicker({
  values,
  onChange,
}: {
  values: SelectedAudience[];
  onChange: (v: SelectedAudience[]) => void;
}) {
  const audiencesQ = useApi<MetaSavedAudience[]>(
    (c) => c.getMetaSavedAudiences(),
    []
  );
  if (audiencesQ.loading)
    return <div className="text-xs text-slate-500">Loading…</div>;
  if (!audiencesQ.data || audiencesQ.data.length === 0)
    return (
      <div className="text-xs text-slate-500">
        No saved audiences in this ad account.
      </div>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {audiencesQ.data.map((a) => {
        const selected = values.find((v) => v.id === a.id);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() =>
              onChange(
                selected
                  ? values.filter((v) => v.id !== a.id)
                  : [...values, { id: a.id, name: a.name }]
              )
            }
            className={clsx(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
              selected
                ? "border-primary bg-primary text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            {a.name}
          </button>
        );
      })}
    </div>
  );
}
