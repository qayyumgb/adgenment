"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Plus,
  Search,
  ChevronDown,
  Users,
  Pencil,
  Copy,
  Rocket,
  Trash2,
  X,
  Bot,
  Check,
  Loader2,
  Database,
  Layers,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useApiClient } from "@/lib/api";
import type {
  Audience,
  AudienceType,
  MetaTargetingSpec,
  MetaCustomAudience,
  MetaSavedAudience,
} from "@/lib/api";
import {
  CountryPicker,
  CityPicker,
  InterestPicker,
  CustomAudiencePicker,
  formatBig,
  type SelectedCity,
  type SelectedInterest,
  type SelectedAudience,
} from "@/components/targeting/pickers";

/* ───────────────────────── helpers / metadata ───────────────────────── */

const TYPE_META: Record<AudienceType, { label: string; color: string; bg: string; text: string }> = {
  LOOKALIKE: { label: "Lookalike", color: "#6366f1", bg: "bg-primary/10", text: "text-primary" },
  INTEREST: { label: "Interest", color: "#06B6D4", bg: "bg-cyan-50", text: "text-cyan-700" },
  RETARGETING: { label: "Retargeting", color: "#F59E0B", bg: "bg-amber-50", text: "text-amber-700" },
  CUSTOM: { label: "Custom", color: "#8B5CF6", bg: "bg-purple-50", text: "text-purple-700" },
  BEHAVIORAL: { label: "Behavioral", color: "#10B981", bg: "bg-emerald-50", text: "text-emerald-700" },
  SAVED: { label: "Saved", color: "#64748b", bg: "bg-slate-100", text: "text-slate-600" },
};

const AUDIENCE_TYPE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: "INTEREST", label: "Interest-based" },
  { value: "RETARGETING", label: "Retargeting" },
  { value: "LOOKALIKE", label: "Lookalike" },
  { value: "CUSTOM", label: "Custom" },
  { value: "BEHAVIORAL", label: "Behavioral" },
  { value: "SAVED", label: "Saved" },
];

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

const GENDER_LABEL = (g: number[]): string =>
  g.length === 0 ? "" : g.includes(1) && !g.includes(2) ? "Men" : g.includes(2) && !g.includes(1) ? "Women" : "";

/** One-line, honest summary of what a saved targeting spec actually contains. */
function summarizeTargeting(t: MetaTargetingSpec): string {
  const parts: string[] = [];
  if (t.age_min || t.age_max) parts.push(`${t.age_min ?? 13}–${t.age_max ?? 65}`);
  const g = GENDER_LABEL(t.genders ?? []);
  if (g) parts.push(g);
  const countries = t.geo_locations?.countries ?? [];
  if (countries.length) parts.push(countries.slice(0, 3).join(", ") + (countries.length > 3 ? "…" : ""));
  const cityCount = t.geo_locations?.cities?.length ?? 0;
  if (cityCount) parts.push(`${cityCount} ${cityCount === 1 ? "city" : "cities"}`);
  const interestCount = t.interests?.length ?? 0;
  if (interestCount) parts.push(`${interestCount} ${interestCount === 1 ? "interest" : "interests"}`);
  const customCount = t.custom_audiences?.length ?? 0;
  if (customCount) parts.push(`${customCount} custom`);
  return parts.length ? parts.join(" · ") : "Broad — no filters";
}

/* ───────────────────────────── page ───────────────────────────── */

type Tab = "MINE" | "META";

export default function AudiencesPage() {
  const api = useApiClient();
  const [tab, setTab] = useState<Tab>("MINE");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AudienceType>("ALL");
  const [sort, setSort] = useState<"NEWEST" | "NAME" | "LARGEST">("NEWEST");
  const [reloadKey, setReloadKey] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [manual, setManual] = useState<{ open: boolean; editing: Audience | null }>({
    open: false,
    editing: null,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const minesQ = useApi(
    (c) =>
      c.getAudiences({
        search: debounced.trim() || undefined,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        limit: "60",
      }),
    [debounced, typeFilter, reloadKey]
  );

  const audiences = useMemo(() => {
    const rows = [...(minesQ.data?.audiences ?? [])];
    if (sort === "NAME") rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "LARGEST")
      rows.sort((a, b) => (b.approxSize ?? -1) - (a.approxSize ?? -1));
    // NEWEST = API default (updatedAt desc)
    return rows;
  }, [minesQ.data, sort]);

  const stats = useMemo(() => {
    const all = minesQ.data?.audiences ?? [];
    return {
      total: minesQ.data?.total ?? all.length,
      ai: all.filter((a) => a.aiGenerated).length,
    };
  }, [minesQ.data]);

  function openManualCreate() {
    setManual({ open: true, editing: null });
  }
  function openEdit(a: Audience) {
    setManual({ open: true, editing: a });
  }

  async function handleDuplicate(a: Audience) {
    setBusyId(a.id);
    try {
      await api.duplicateAudience(a.id);
      toast.success("Audience duplicated");
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(a: Audience) {
    if (!window.confirm(`Delete "${a.name}"? This can't be undone.`)) return;
    setBusyId(a.id);
    try {
      await api.deleteAudience(a.id);
      toast.success("Audience deleted");
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Top bar ── */}
      <header className="flex flex-wrap items-end justify-between gap-3 animate-in stagger-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            Audiences
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Build reusable targeting once — apply it to any campaign.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2.5} />
            Build with AI
          </button>
          <button
            type="button"
            onClick={openManualCreate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Create Audience
          </button>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-slate-200 animate-in stagger-2">
        <TabBtn active={tab === "MINE"} onClick={() => setTab("MINE")} icon={Layers}>
          My Audiences
        </TabBtn>
        <TabBtn active={tab === "META"} onClick={() => setTab("META")} icon={Database}>
          Meta Audiences
        </TabBtn>
      </div>

      {tab === "MINE" ? (
        <>
          {/* Stats */}
          <div className="flex flex-wrap items-center gap-2 animate-in stagger-2">
            <StatChip icon={Users} label="Saved Audiences" value={stats.total} />
            <StatChip icon={Sparkles} label="AI Built" value={stats.ai} tone="brand" />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-card animate-in stagger-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audiences…"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none"
              />
            </div>
            <Select
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as "ALL" | AudienceType)}
              options={[
                { value: "ALL", label: "All Types" },
                ...AUDIENCE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
              ]}
            />
            <Select
              value={sort}
              onChange={(v) => setSort(v as "NEWEST" | "NAME" | "LARGEST")}
              options={[
                { value: "NEWEST", label: "Newest" },
                { value: "NAME", label: "Name A–Z" },
                { value: "LARGEST", label: "Largest" },
              ]}
            />
          </div>

          {/* Grid */}
          {minesQ.loading ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100" />
              ))}
            </div>
          ) : minesQ.error ? (
            <div className="rounded-2xl border border-dashed border-rose-300 bg-rose-50/50 p-8 text-center">
              <p className="text-sm font-semibold text-rose-700">{minesQ.error}</p>
              <button
                type="button"
                onClick={() => minesQ.refetch()}
                className="mt-3 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                Retry
              </button>
            </div>
          ) : audiences.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center animate-in">
              <p className="text-sm font-semibold text-slate-700">
                {debounced || typeFilter !== "ALL"
                  ? "No audiences match your filters."
                  : "No saved audiences yet."}
              </p>
              {!debounced && typeFilter === "ALL" && (
                <button
                  type="button"
                  onClick={() => setAiOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                  Build your first audience
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 animate-in stagger-4 md:grid-cols-2 xl:grid-cols-3">
              {audiences.map((a) => (
                <MyAudienceCard
                  key={a.id}
                  a={a}
                  busy={busyId === a.id}
                  onEdit={() => openEdit(a)}
                  onDuplicate={() => handleDuplicate(a)}
                  onDelete={() => handleDelete(a)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <MetaAudiencesTab />
      )}

      {aiOpen && (
        <AiAudienceModal
          onClose={() => setAiOpen(false)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
      {manual.open && (
        <ManualAudienceModal
          editing={manual.editing}
          onClose={() => setManual({ open: false, editing: null })}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── My Audience card ───────────────────────── */

function MyAudienceCard({
  a,
  busy,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  a: Audience;
  busy: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const tm = TYPE_META[a.type];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover">
      <span className="absolute inset-y-0 left-0 w-1 rounded-l-2xl" style={{ backgroundColor: tm.color }} />

      <div className="flex items-center justify-between gap-2">
        <span className={clsx("pill", tm.bg, tm.text)}>{tm.label}</span>
        {a.aiGenerated && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            AI Built
          </span>
        )}
      </div>

      <div className="mt-3">
        <h3 className="truncate text-base font-bold text-slate-900">{a.name}</h3>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
          {a.description || summarizeTargeting(a.targeting)}
        </p>
      </div>

      <div className="mt-4">
        {a.approxSize ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900">~{formatBig(a.approxSize)}</span>
            <span className="text-xs font-semibold text-slate-500">people (approx)</span>
          </div>
        ) : (
          <div className="text-sm font-semibold text-slate-400">Size unknown</div>
        )}
        <p className="mt-1 line-clamp-1 text-[11px] font-medium text-slate-500">
          {summarizeTargeting(a.targeting)}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="inline-flex h-5 items-center gap-1 rounded-md bg-[#1877F2] px-1.5 text-[9px] font-bold text-white">
          Meta
        </span>
        <span className="text-[10px] font-medium text-slate-400">Updated {daysAgo(a.updatedAt)}</span>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
        {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-slate-400" />}
        <ActionBtn label="Edit" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </ActionBtn>
        <ActionBtn label="Duplicate" onClick={onDuplicate}>
          <Copy className="h-3.5 w-3.5" />
        </ActionBtn>
        <ActionBtn label="Use in campaign" onClick={() => router.push("/campaigns")}>
          <Rocket className="h-3.5 w-3.5" />
        </ActionBtn>
        <ActionBtn label="Delete" tone="danger" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </ActionBtn>
      </div>
    </div>
  );
}

/* ───────────────────────── Meta Audiences tab ───────────────────────── */

function MetaAudiencesTab() {
  const customQ = useApi<MetaCustomAudience[]>((c) => c.getMetaCustomAudiences(), []);
  const savedQ = useApi<MetaSavedAudience[]>((c) => c.getMetaSavedAudiences(), []);

  const loading = customQ.loading || savedQ.loading;
  const notConnected =
    (customQ.error && /connect|meta|account/i.test(customQ.error)) ||
    (savedQ.error && /connect|meta|account/i.test(savedQ.error));

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200/70 bg-slate-100" />
        ))}
      </div>
    );
  }

  if (notConnected) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-sm font-semibold text-slate-700">Connect a Meta ad account to see your audiences.</p>
        <p className="mt-1 text-xs text-slate-500">Settings → Integrations → connect Meta.</p>
      </div>
    );
  }

  const custom = customQ.data ?? [];
  const saved = savedQ.data ?? [];

  if (custom.length === 0 && saved.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-sm font-semibold text-slate-700">No audiences in this Meta ad account yet.</p>
        <p className="mt-1 text-xs text-slate-500">
          Custom audiences, lookalikes, and saved audiences from Meta show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        Read-only — these live on your Meta ad account. Sizes are Meta&apos;s own estimates.
      </p>
      {custom.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Custom & lookalike audiences
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {custom.map((a) => (
              <MetaAudienceCard
                key={a.id}
                name={a.name}
                badge={a.isLookalike ? "Lookalike" : a.subtype || "Custom"}
                badgeColor={a.isLookalike ? "#6366f1" : "#8B5CF6"}
                approxSize={a.approxSize}
                ready={a.ready}
                description={a.description}
              />
            ))}
          </div>
        </section>
      )}
      {saved.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Saved audiences</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {saved.map((a) => (
              <MetaAudienceCard
                key={a.id}
                name={a.name}
                badge="Saved"
                badgeColor="#64748b"
                approxSize={a.approxSize}
                ready
                description={a.description}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetaAudienceCard({
  name,
  badge,
  badgeColor,
  approxSize,
  ready,
  description,
}: {
  name: string;
  badge: string;
  badgeColor: string;
  approxSize: number | null;
  ready: boolean;
  description?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
      <span className="absolute inset-y-0 left-0 w-1 rounded-l-2xl" style={{ backgroundColor: badgeColor }} />
      <div className="flex items-center justify-between gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: badgeColor }}
        >
          {badge}
        </span>
        {!ready && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Building
          </span>
        )}
      </div>
      <h3 className="mt-3 truncate text-base font-bold text-slate-900">{name}</h3>
      {description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{description}</p>}
      <div className="mt-4">
        {approxSize ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900">~{formatBig(approxSize)}</span>
            <span className="text-xs font-semibold text-slate-500">people</span>
          </div>
        ) : (
          <div className="text-sm font-semibold text-slate-400">Size unavailable</div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── audience form (shared) ───────────────────────── */

type AudienceFormState = {
  name: string;
  type: AudienceType;
  ageMin: number;
  ageMax: number;
  genders: number[];
  countries: string[];
  cities: SelectedCity[];
  interests: SelectedInterest[];
  customAudiences: SelectedAudience[];
  approxSize: number | null;
  aiBuilt: boolean;
};

function initFormState(editing: Audience | null): AudienceFormState {
  const t = editing?.targeting;
  return {
    name: editing?.name ?? "",
    type: editing?.type ?? "INTEREST",
    ageMin: t?.age_min ?? 18,
    ageMax: t?.age_max ?? 65,
    genders: t?.genders ?? [],
    countries: t?.geo_locations?.countries ?? [],
    cities: (t?.geo_locations?.cities ?? []).map((c) => ({ key: c.key, name: c.key })),
    interests: (t?.interests ?? []).map((i) => ({ id: i.id, name: i.name ?? i.id })),
    customAudiences: (t?.custom_audiences ?? []).map((a) => ({ id: a.id, name: a.id })),
    approxSize: editing?.approxSize ?? null,
    aiBuilt: editing?.aiGenerated ?? false,
  };
}

function buildSpecFrom(v: AudienceFormState): MetaTargetingSpec {
  const spec: MetaTargetingSpec = { age_min: v.ageMin, age_max: v.ageMax };
  if (v.genders.length) spec.genders = v.genders;
  const geo: NonNullable<MetaTargetingSpec["geo_locations"]> = {};
  if (v.countries.length) geo.countries = v.countries;
  if (v.cities.length) geo.cities = v.cities.map((c) => ({ key: c.key }));
  if (geo.countries || geo.cities) spec.geo_locations = geo;
  if (v.interests.length) spec.interests = v.interests.map((i) => ({ id: i.id, name: i.name }));
  if (v.customAudiences.length) spec.custom_audiences = v.customAudiences.map((a) => ({ id: a.id }));
  return spec;
}

function hasCriteria(v: AudienceFormState): boolean {
  return (
    v.interests.length > 0 ||
    v.countries.length > 0 ||
    v.cities.length > 0 ||
    v.customAudiences.length > 0
  );
}

/** Shared targeting controls used by both the AI and the manual modals. */
function AudienceFields({
  v,
  patch,
}: {
  v: AudienceFormState;
  patch: (u: Partial<AudienceFormState>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <SectionLabel>Audience name</SectionLabel>
          <input
            type="text"
            value={v.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="e.g. Skincare buyers · US"
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <SectionLabel>Type</SectionLabel>
          <Select
            value={v.type}
            onChange={(val) => patch({ type: val as AudienceType })}
            options={AUDIENCE_TYPE_OPTIONS}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <SectionLabel>Age range</SectionLabel>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={13}
              max={65}
              value={v.ageMin}
              onChange={(e) => patch({ ageMin: Math.max(13, Math.min(65, Number(e.target.value) || 13)) })}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-primary focus:outline-none"
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              min={13}
              max={65}
              value={v.ageMax}
              onChange={(e) => patch({ ageMax: Math.max(13, Math.min(65, Number(e.target.value) || 65)) })}
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
        <div>
          <SectionLabel>Gender</SectionLabel>
          <div className="flex gap-1.5">
            {[
              { label: "All", g: [] as number[] },
              { label: "Men", g: [1] },
              { label: "Women", g: [2] },
            ].map((opt) => {
              const active = JSON.stringify(v.genders) === JSON.stringify(opt.g);
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => patch({ genders: opt.g })}
                  className={clsx(
                    "h-10 flex-1 rounded-xl border text-xs font-semibold transition",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <CountryPicker values={v.countries} onChange={(c) => patch({ countries: c })} />
      <CityPicker label="Cities" values={v.cities} onChange={(c) => patch({ cities: c })} />

      <div>
        <SectionLabel>Interests</SectionLabel>
        <InterestPicker
          values={v.interests}
          onChange={(i) => {
            // Derive an approx size from the largest interest's reach (Meta
            // OR's interests, so the true union is ≥ this — a conservative
            // signal). Keeps the manual flow consistent with the AI flow.
            const sizes = i
              .map((x) => x.audienceSize)
              .filter((n): n is number => typeof n === "number");
            patch({
              interests: i,
              approxSize: sizes.length ? Math.max(...sizes) : v.approxSize,
            });
          }}
        />
      </div>

      {(v.type === "RETARGETING" || v.type === "CUSTOM" || v.type === "LOOKALIKE") && (
        <CustomAudiencePicker
          label="Custom & lookalike audiences"
          values={v.customAudiences}
          onChange={(c) => patch({ customAudiences: c })}
        />
      )}

      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Approx. size</span>
        <span className="text-sm font-bold text-slate-900">
          {v.approxSize ? `~${formatBig(v.approxSize)} people` : "Unknown"}
        </span>
      </div>
    </div>
  );
}

/** Save (create or update) a built audience. Shared by both modals. */
async function persistAudience(
  api: ReturnType<typeof useApiClient>,
  editing: Audience | null,
  v: AudienceFormState
): Promise<boolean> {
  if (!v.name.trim()) {
    toast.error("Name your audience.");
    return false;
  }
  if (!hasCriteria(v)) {
    toast.error("Add at least one interest, location, or custom audience.");
    return false;
  }
  const targeting = buildSpecFrom(v);
  if (editing) {
    await api.updateAudience(editing.id, { name: v.name.trim(), type: v.type, targeting, approxSize: v.approxSize });
    toast.success("Audience updated");
  } else {
    await api.createAudience({
      name: v.name.trim(),
      type: v.type,
      platforms: ["META"],
      targeting,
      aiGenerated: v.aiBuilt,
      approxSize: v.approxSize,
    });
    toast.success("Audience saved");
  }
  return true;
}

/* ───────────────────────── Manual create / edit modal ───────────────────────── */

function ManualAudienceModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Audience | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const [v, setV] = useState<AudienceFormState>(() => initFormState(editing));
  const patch = (u: Partial<AudienceFormState>) => setV((p) => ({ ...p, ...u }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    try {
      if (await persistAudience(api, editing, v)) {
        onSaved();
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
              <Users className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editing ? "Edit audience" : "Create audience"}
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Build reusable Meta targeting by hand.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AudienceFields v={v} patch={patch} />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition",
              saving ? "opacity-60" : "hover:-translate-y-0.5 hover:bg-emerald-600"
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
            {editing ? "Save changes" : "Save audience"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── AI build modal (Creatives-style) ───────────────────────── */

const AUDIENCE_TEMPLATES: { label: string; body: string }[] = [
  {
    label: "E-commerce buyers",
    body: [
      "Online shoppers aged [25–45] in [United States] who buy [sustainable fashion] online.",
      "Interested in [organic cotton, slow fashion, ethical brands] and follow [eco-friendly clothing labels].",
      "Likely to have purchased [apparel or accessories] in the last [30 days].",
    ].join("\n"),
  },
  {
    label: "SaaS decision-makers",
    body: [
      "[Founders, marketing leads, and operations managers] aged [28–50] in [the US and UK].",
      "Work at [small-to-mid B2B software companies], interested in [productivity tools, automation, CRM, analytics].",
      "Actively evaluating [marketing or sales software].",
    ].join("\n"),
  },
  {
    label: "Local service customers",
    body: [
      "Homeowners aged [30–60] within [25 miles of [your city]].",
      "Interested in [home improvement, interior design, gardening] and likely to hire [local contractors/services].",
      "Household income [middle to upper].",
    ].join("\n"),
  },
  {
    label: "Fitness & wellness",
    body: [
      "[Health-conscious adults] aged [22–40] in [United States].",
      "Interested in [fitness, nutrition, yoga, supplements, activewear] and follow [wellness influencers and gym brands].",
      "Likely to buy [workout gear or health products] online.",
    ].join("\n"),
  },
  {
    label: "Warm retargeting",
    body: [
      "People who recently [visited my website or added to cart] but didn't purchase.",
      "Aged [25–50] in [United States], interested in [your product category].",
      "Re-engage with a [limited-time offer].",
    ].join("\n"),
  },
];

function AiAudienceModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const [prompt, setPrompt] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<AudienceFormState>(() => initFormState(null));
  const patch = (u: Partial<AudienceFormState>) => setV((p) => ({ ...p, ...u }));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onClick(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-templates-popover]")) {
        setTemplatesOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  async function generate() {
    if (prompt.trim().length < 10) {
      toast.error("Describe the audience in at least 10 characters.");
      return;
    }
    setGenerating(true);
    try {
      const r = await api.generateAudienceTargeting(prompt.trim());
      setV({
        name: r.name,
        type: r.type,
        ageMin: r.targeting.age_min ?? 18,
        ageMax: r.targeting.age_max ?? 65,
        genders: r.targeting.genders ?? [],
        countries: r.targeting.geo_locations?.countries ?? [],
        cities: r.resolved.cities.map((c) => ({ key: c.key, name: c.name })),
        interests: r.resolved.interests.map((i) => ({ id: i.id, name: i.name })),
        customAudiences: [],
        approxSize: r.approxSize,
        aiBuilt: true,
      });
      setHasResult(true);
      toast.success("Targeting drafted — review & save.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI build failed");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (await persistAudience(api, null, v)) {
        onSaved();
        onClose();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onMouseDown={onClose} />
      <div className="relative z-10 flex h-full max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
              <Bot className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Build audience with AI</h2>
              <p className="text-[11px] font-medium text-slate-500">
                Describe your ideal customer — we draft real Meta targeting.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasResult && (
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition",
                  saving ? "opacity-60" : "hover:-translate-y-0.5 hover:bg-emerald-600"
                )}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
                Save audience
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Work area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {generating ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-30 blur-2xl" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
                  <Sparkles className="h-7 w-7 animate-pulse text-white" strokeWidth={2.5} />
                </div>
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-700">Drafting your targeting…</p>
              <p className="text-xs text-slate-500">Resolving interests and locations against Meta</p>
            </div>
          ) : hasResult ? (
            <div className="mx-auto max-w-2xl">
              <AudienceFields v={v} patch={patch} />
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Bot className="h-7 w-7 text-primary" strokeWidth={2} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Describe your ideal customer</h3>
              <p className="max-w-md text-sm text-slate-500">
                Tell the AI who you want to reach. Pick a template below, fill in the
                [brackets], and hit Generate — we&apos;ll turn it into real, editable
                Meta targeting.
              </p>
            </div>
          )}
        </div>

        {/* Bottom prompt bar */}
        <div className="border-t border-slate-100 bg-white px-6 py-4">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-md transition focus-within:border-primary/40 focus-within:shadow-glow">
              <div className="flex items-start gap-2 px-4 pt-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !generating && prompt.trim().length >= 10) {
                      e.preventDefault();
                      void generate();
                    }
                  }}
                  rows={3}
                  placeholder="Describe your ideal customer — age, location, interests, behaviors…  (⌘/Ctrl + Enter to generate)"
                  className="max-h-[30vh] min-h-[40px] w-full resize-y overflow-y-auto bg-transparent text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2.5">
                {/* Templates popover */}
                <div className="relative" data-templates-popover>
                  <button
                    type="button"
                    onClick={() => setTemplatesOpen((p) => !p)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
                  >
                    <Sparkles className="h-3 w-3" strokeWidth={2.5} />
                    Audience Templates
                    <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                  {templatesOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                      <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Pick one, fill the [brackets], then generate
                      </div>
                      <ul className="space-y-0.5">
                        {AUDIENCE_TEMPLATES.map((t) => (
                          <li key={t.label}>
                            <button
                              type="button"
                              onClick={() => {
                                setPrompt(t.body);
                                setTemplatesOpen(false);
                              }}
                              className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-primary/5 hover:text-primary"
                            >
                              {t.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={() => void generate()}
                    disabled={generating || prompt.trim().length < 10}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2 text-sm font-bold text-white shadow-glow transition",
                      generating || prompt.trim().length < 10 ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-xl"
                    )}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" strokeWidth={2.5} /> {hasResult ? "Regenerate" : "Generate"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── small UI bits ───────────────────────── */

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Layers;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition",
        active
          ? "border-primary text-primary"
          : "border-transparent text-slate-500 hover:text-slate-700"
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">{children}</label>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  tone?: "brand" | "emerald";
}) {
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 shadow-card",
        tone === "brand" ? "border-primary/20 bg-primary/[0.06]" : "border-slate-200"
      )}
    >
      <Icon className={clsx("h-3.5 w-3.5", tone === "brand" ? "text-primary" : "text-slate-500")} />
      <span className={clsx("text-xs font-semibold", tone === "brand" ? "text-primary" : "text-slate-500")}>
        {label}
      </span>
      <span className={clsx("text-sm font-bold", tone === "brand" ? "text-primary" : "text-slate-900")}>
        {value}
      </span>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-medium text-slate-700 transition focus:border-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function ActionBtn({
  children,
  label,
  tone = "default",
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  tone?: "default" | "danger";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={clsx(
        "flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition",
        tone === "danger"
          ? "hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
          : "hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}
