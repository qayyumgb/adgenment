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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Audience | null>(null);
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

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(a: Audience) {
    setEditing(a);
    setModalOpen(true);
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
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          Build Audience
        </button>
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
                  onClick={openCreate}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
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

      {modalOpen && (
        <BuildAudienceModal
          editing={editing}
          onClose={() => setModalOpen(false)}
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

/* ───────────────────────── Build / edit modal ───────────────────────── */

function BuildAudienceModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Audience | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const [mode, setMode] = useState<"AI" | "MANUAL">(editing ? "MANUAL" : "AI");
  const [description, setDescription] = useState("");
  const [hasGenerated, setHasGenerated] = useState(!!editing);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(editing?.name ?? "");
  const [type, setType] = useState<AudienceType>(editing?.type ?? "INTEREST");
  const [ageMin, setAgeMin] = useState(editing?.targeting.age_min ?? 18);
  const [ageMax, setAgeMax] = useState(editing?.targeting.age_max ?? 65);
  const [genders, setGenders] = useState<number[]>(editing?.targeting.genders ?? []);
  const [countries, setCountries] = useState<string[]>(editing?.targeting.geo_locations?.countries ?? []);
  const [cities, setCities] = useState<SelectedCity[]>(
    (editing?.targeting.geo_locations?.cities ?? []).map((c) => ({ key: c.key, name: c.key }))
  );
  const [interests, setInterests] = useState<SelectedInterest[]>(
    (editing?.targeting.interests ?? []).map((i) => ({ id: i.id, name: i.name ?? i.id }))
  );
  const [customAudiences, setCustomAudiences] = useState<SelectedAudience[]>(
    (editing?.targeting.custom_audiences ?? []).map((a) => ({ id: a.id, name: a.id }))
  );
  const [approxSize, setApproxSize] = useState<number | null>(editing?.approxSize ?? null);
  const [aiBuilt, setAiBuilt] = useState(editing?.aiGenerated ?? false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function buildSpec(): MetaTargetingSpec {
    const spec: MetaTargetingSpec = { age_min: ageMin, age_max: ageMax };
    if (genders.length) spec.genders = genders;
    const geo: NonNullable<MetaTargetingSpec["geo_locations"]> = {};
    if (countries.length) geo.countries = countries;
    if (cities.length) geo.cities = cities.map((c) => ({ key: c.key }));
    if (geo.countries || geo.cities) spec.geo_locations = geo;
    if (interests.length) spec.interests = interests.map((i) => ({ id: i.id, name: i.name }));
    if (customAudiences.length) spec.custom_audiences = customAudiences.map((a) => ({ id: a.id }));
    return spec;
  }

  async function runAi() {
    if (description.trim().length < 10) {
      toast.error("Describe the audience in at least 10 characters.");
      return;
    }
    setGenerating(true);
    try {
      const r = await api.generateAudienceTargeting(description.trim());
      setName((n) => n || r.name);
      setType(r.type);
      setAgeMin(r.targeting.age_min ?? 18);
      setAgeMax(r.targeting.age_max ?? 65);
      setGenders(r.targeting.genders ?? []);
      setCountries(r.targeting.geo_locations?.countries ?? []);
      setCities(r.resolved.cities.map((c) => ({ key: c.key, name: c.name })));
      setInterests(r.resolved.interests.map((i) => ({ id: i.id, name: i.name })));
      setApproxSize(r.approxSize);
      setAiBuilt(true);
      setHasGenerated(true);
      toast.success("Targeting drafted — review and tweak below.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI build failed");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Name your audience.");
      return;
    }
    const targeting = buildSpec();
    const hasCriteria =
      (targeting.interests?.length ?? 0) > 0 ||
      (targeting.geo_locations?.countries?.length ?? 0) > 0 ||
      (targeting.geo_locations?.cities?.length ?? 0) > 0 ||
      (targeting.custom_audiences?.length ?? 0) > 0;
    if (!hasCriteria) {
      toast.error("Add at least one interest, location, or custom audience.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.updateAudience(editing.id, { name: name.trim(), type, targeting, approxSize });
        toast.success("Audience updated");
      } else {
        await api.createAudience({
          name: name.trim(),
          type,
          platforms: ["META"],
          targeting,
          aiGenerated: aiBuilt,
          approxSize,
        });
        toast.success("Audience saved");
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const showControls = mode === "MANUAL" || hasGenerated;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-glow">
              <Bot className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editing ? "Edit audience" : "Build audience"}
              </h2>
              <p className="text-[11px] font-medium text-slate-500">
                Reusable Meta targeting — apply it to any campaign.
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

        {/* Mode toggle */}
        {!editing && (
          <div className="flex gap-1 border-b border-slate-100 px-6 py-2.5">
            <ModeBtn active={mode === "AI"} onClick={() => setMode("AI")} icon={Sparkles}>
              Build with AI
            </ModeBtn>
            <ModeBtn active={mode === "MANUAL"} onClick={() => setMode("MANUAL")} icon={Pencil}>
              Build manually
            </ModeBtn>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {mode === "AI" && (
            <div>
              <SectionLabel>Describe your ideal customer</SectionLabel>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="e.g. Eco-conscious millennials in the US who buy skincare and follow wellness brands on Instagram"
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={runAi}
                disabled={generating || description.trim().length < 10}
                className={clsx(
                  "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition",
                  generating || description.trim().length < 10 ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-xl"
                )}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Drafting targeting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" strokeWidth={2.5} /> {hasGenerated ? "Regenerate" : "Generate targeting"}
                  </>
                )}
              </button>
              {hasGenerated && (
                <p className="mt-2 text-center text-[11px] font-medium text-emerald-600">
                  Drafted — review &amp; edit the targeting below, then save.
                </p>
              )}
            </div>
          )}

          {showControls && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <SectionLabel>Audience name</SectionLabel>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Skincare buyers · US"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <SectionLabel>Type</SectionLabel>
                  <Select
                    value={type}
                    onChange={(v) => setType(v as AudienceType)}
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
                      value={ageMin}
                      onChange={(e) => setAgeMin(Math.max(13, Math.min(65, Number(e.target.value) || 13)))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-primary focus:outline-none"
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="number"
                      min={13}
                      max={65}
                      value={ageMax}
                      onChange={(e) => setAgeMax(Math.max(13, Math.min(65, Number(e.target.value) || 65)))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <SectionLabel>Gender</SectionLabel>
                  <div className="flex gap-1.5">
                    {[
                      { label: "All", v: [] as number[] },
                      { label: "Men", v: [1] },
                      { label: "Women", v: [2] },
                    ].map((opt) => {
                      const active = JSON.stringify(genders) === JSON.stringify(opt.v);
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setGenders(opt.v)}
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

              <CountryPicker values={countries} onChange={setCountries} />
              <CityPicker label="Cities" values={cities} onChange={setCities} />

              <div>
                <SectionLabel>Interests</SectionLabel>
                <InterestPicker values={interests} onChange={setInterests} />
              </div>

              {(type === "RETARGETING" || type === "CUSTOM" || type === "LOOKALIKE") && (
                <CustomAudiencePicker
                  label="Custom & lookalike audiences"
                  values={customAudiences}
                  onChange={setCustomAudiences}
                />
              )}

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Approx. size</span>
                <span className="text-sm font-bold text-slate-900">
                  {approxSize ? `~${formatBig(approxSize)} people` : "Unknown"}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {showControls && (
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
        )}
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

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition",
        active ? "bg-primary/10 text-primary" : "text-slate-500 hover:bg-slate-50"
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
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
