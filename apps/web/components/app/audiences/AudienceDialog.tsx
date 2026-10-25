"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FileText, Sparkles } from "lucide-react";
import { useApiClient, type AudienceBoard, type AudienceBoardItem, type AudienceType, type MetaTargetingSpec } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AiNote, Button, Dialog, Menu, MenuItem, MenuLabel, Segmented } from "@/components/app/ui";
import {
  COMMON_COUNTRIES,
  CityPicker,
  CountryPicker,
  CustomAudiencePicker,
  InterestPicker,
  formatBig,
  type SelectedAudience,
  type SelectedCity,
  type SelectedInterest,
} from "@/components/app/targeting/pickers";
import { AUDIENCE_TEMPLATES } from "./templates";

/**
 * D2 Create audience (guide, plan A9): "Describe it" (AI drafts real Meta
 * targeting, resolved against Meta's interest and location search), "Build
 * it" (the manual builder; also edit), and "Lookalike" (built on Meta from a
 * custom audience). Saved audiences belong to the client in view.
 */

export type DialogTab = "describe" | "build" | "lookalike";

type Form = {
  name: string;
  description: string;
  type: AudienceType;
  ageMin: string;
  ageMax: string;
  genders: number[];
  countries: string[];
  cities: SelectedCity[];
  interests: SelectedInterest[];
  customAudiences: SelectedAudience[];
  approxSize: number | null;
  aiGenerated: boolean;
};

const TYPES: { value: AudienceType; label: string }[] = [
  { value: "INTEREST", label: "Interest" },
  { value: "RETARGETING", label: "Retargeting" },
  { value: "LOOKALIKE", label: "Lookalike" },
  { value: "CUSTOM", label: "Custom" },
  { value: "BEHAVIORAL", label: "Behavioral" },
  { value: "SAVED", label: "Saved" },
];

const emptyForm = (): Form => ({
  name: "",
  description: "",
  type: "INTEREST",
  ageMin: "18",
  ageMax: "65",
  genders: [],
  countries: [],
  cities: [],
  interests: [],
  customAudiences: [],
  approxSize: null,
  aiGenerated: false,
});

function formFrom(item: AudienceBoardItem): Form {
  const t = (item.library?.targeting ?? {}) as MetaTargetingSpec;
  return {
    name: item.name,
    description: item.description ?? "",
    type: item.library?.type ?? "INTEREST",
    ageMin: String(t.age_min ?? 18),
    ageMax: String(t.age_max ?? 65),
    genders: t.genders ?? [],
    countries: t.geo_locations?.countries ?? [],
    cities: (t.geo_locations?.cities ?? []).map((c) => ({ key: c.key, name: c.name ?? c.key })),
    interests: (t.interests ?? []).map((i) => ({ id: i.id, name: i.name ?? i.id })),
    customAudiences: (t.custom_audiences ?? []).map((c) => ({ id: c.id, name: c.name ?? c.id })),
    approxSize: item.sizeUpper,
    aiGenerated: item.aiGenerated,
  };
}

const clampAge = (v: string, fallback: number) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(65, Math.max(13, n)) : fallback;
};

/** Targeting saved with the audience. City and custom-audience names are kept so editing shows names, not ids. */
function specFrom(f: Form): MetaTargetingSpec {
  const ageMin = clampAge(f.ageMin, 18);
  const ageMax = clampAge(f.ageMax, 65);
  return {
    age_min: ageMin,
    age_max: ageMax,
    ...(f.genders.length ? { genders: f.genders } : {}),
    geo_locations: {
      ...(f.countries.length ? { countries: f.countries } : {}),
      ...(f.cities.length ? { cities: f.cities.map((c) => ({ key: c.key, name: c.name })) } : {}),
    },
    ...(f.interests.length ? { interests: f.interests.map((i) => ({ id: i.id, name: i.name })) } : {}),
    ...(f.customAudiences.length ? { custom_audiences: f.customAudiences.map((c) => ({ id: c.id, name: c.name })) } : {}),
  };
}

function problems(f: Form): string | null {
  if (!f.name.trim()) return "Name the audience.";
  const a = clampAge(f.ageMin, 18);
  const b = clampAge(f.ageMax, 65);
  if (a > b) return "The minimum age is above the maximum.";
  if (!f.countries.length && !f.cities.length && !f.customAudiences.length) return "Add a country or city, or a custom audience: Meta needs to know where to show ads.";
  return null;
}

const fieldCls = "h-10 w-full rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft";
const labelCls = "flex flex-col gap-1.5 text-sm font-medium";

function BuildFields({ f, set }: { f: Form; set: (p: Partial<Form>) => void }) {
  const ageErr = clampAge(f.ageMin, 18) > clampAge(f.ageMax, 65);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 min-[600px]:grid-cols-[1fr_180px]">
        <label className={labelCls}>
          Name
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} placeholder="e.g. Skincare buyers · US" className={fieldCls} />
        </label>
        <label className={labelCls}>
          Type
          <select value={f.type} onChange={(e) => set({ type: e.target.value as AudienceType })} className={fieldCls}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelCls}>
        Description <span className="-mt-1 text-xs font-normal text-ink-3">Optional. Who this is and why it works.</span>
        <textarea value={f.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={500} className={cn(fieldCls, "h-auto resize-none py-2")} />
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Age
          <span className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={f.ageMin}
              onChange={(e) => set({ ageMin: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              onBlur={() => set({ ageMin: String(clampAge(f.ageMin, 18)) })}
              aria-label="Minimum age"
              aria-invalid={ageErr}
              className={cn(fieldCls, "w-20 tabular-nums", ageErr && "border-neg")}
            />
            <span className="text-ink-3">to</span>
            <input
              inputMode="numeric"
              value={f.ageMax}
              onChange={(e) => set({ ageMax: e.target.value.replace(/\D/g, "").slice(0, 2) })}
              onBlur={() => set({ ageMax: String(clampAge(f.ageMax, 65)) })}
              aria-label="Maximum age"
              aria-invalid={ageErr}
              className={cn(fieldCls, "w-20 tabular-nums", ageErr && "border-neg")}
            />
          </span>
        </div>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Gender
          <Segmented
            label="Gender"
            value={f.genders.length === 1 ? String(f.genders[0]) : "all"}
            onChange={(v) => set({ genders: v === "all" ? [] : [Number(v)] })}
            options={[
              { value: "all", label: "All" },
              { value: "1", label: "Men" },
              { value: "2", label: "Women" },
            ]}
          />
        </div>
        {ageErr && <span className="pb-2 text-xs font-medium text-neg">Minimum is above maximum.</span>}
      </div>
      <CountryPicker values={f.countries} onChange={(countries) => set({ countries })} />
      <CityPicker label="Cities" values={f.cities} onChange={(cities) => set({ cities })} />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ink-2">Interests</span>
        <InterestPicker
          values={f.interests}
          onChange={(interests) => {
            // Size: the largest interest Meta sized; unknown once no sized interest is left.
            const sizes = interests.map((i) => i.audienceSize).filter((n): n is number => typeof n === "number" && n > 0);
            set({ interests, approxSize: sizes.length ? Math.max(...sizes) : interests.length ? f.approxSize : null });
          }}
        />
      </div>
      <CustomAudiencePicker label="Custom & lookalike audiences (optional)" values={f.customAudiences} onChange={(customAudiences) => set({ customAudiences })} />
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">
        <span className="text-ink-2">Approx. size</span>
        <span className="font-semibold tabular-nums" title="The largest selected interest's reach, as Meta reports it. Overlapping interests and locations make the real audience different.">
          {f.approxSize ? `${formatBig(f.approxSize)}+ people` : "Unknown"}
        </span>
      </div>
    </div>
  );
}

export function AudienceDialog({
  open,
  initialTab,
  editing,
  seedKey,
  board,
  clientId,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialTab: DialogTab;
  /** Library audience to edit (Build tab). */
  editing: AudienceBoardItem | null;
  /** Lookalike tab: preselected seed (board item key). */
  seedKey: string | null;
  board: AudienceBoard | null;
  clientId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const api = useApiClient();
  const [tab, setTab] = useState<DialogTab>(initialTab);
  const [f, setF] = useState<Form>(emptyForm);
  const [dirty, setDirty] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [busy, setBusy] = useState(false);
  const seeds = useMemo(() => (board?.items ?? []).filter((i) => i.canSeedLookalike), [board]);
  const [seed, setSeed] = useState<string>("");
  const [country, setCountry] = useState("US");
  const [ratio, setRatio] = useState(1);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setF(editing ? formFrom(editing) : emptyForm());
    setDirty(false);
    setDrafted(false);
    setPrompt("");
    setSeed(seedKey ?? seeds[0]?.key ?? "");
    setRatio(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open]);

  const set = (p: Partial<Form>) => {
    setF((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  const close = () => {
    if (busy) return;
    if (dirty && !window.confirm("Discard this audience? Your changes aren't saved.")) return;
    onClose();
  };

  const draft = async () => {
    if (prompt.trim().length < 10) return void toast.error("Describe the audience in at least 10 characters.");
    if (drafted && dirty && !window.confirm("Draft again? This replaces the fields you've edited.")) return;
    setBusy(true);
    try {
      const r = await api.generateAudienceTargeting(prompt.trim());
      setF({
        ...emptyForm(),
        name: r.name,
        description: r.description ?? "",
        type: r.type,
        ageMin: String(r.targeting.age_min ?? 18),
        ageMax: String(r.targeting.age_max ?? 65),
        genders: r.targeting.genders ?? [],
        countries: r.targeting.geo_locations?.countries ?? [],
        cities: r.resolved.cities.map((c) => ({ key: c.key, name: c.name })),
        interests: r.resolved.interests.map((i) => ({ id: i.id, name: i.name })),
        approxSize: r.approxSize,
        aiGenerated: true,
      });
      setDrafted(true);
      setDirty(true);
      setTab("build");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't draft the audience. Try again.", { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const p = problems(f);
    if (p) return void toast.error(p);
    setBusy(true);
    try {
      const data = {
        name: f.name.trim(),
        description: f.description.trim() || null,
        type: f.type,
        targeting: specFrom(f),
        approxSize: f.approxSize,
      };
      if (editing) await api.updateAudience(editing.id, data);
      else await api.createAudience({ ...data, platforms: ["META"], aiGenerated: f.aiGenerated, clientId });
      toast.success(editing ? "Audience updated" : "Audience saved");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const seedItem = seeds.find((s) => s.key === seed) ?? null;
  const createLookalike = async () => {
    if (!seedItem) return;
    setBusy(true);
    try {
      await api.createMetaLookalike({
        name: `Lookalike ${ratio}% · ${seedItem.name}`.slice(0, 120),
        seedAudienceId: seedItem.id,
        countryCode: country,
        ratio,
        adAccountId: seedItem.adAccountId,
      });
      toast.success("Lookalike created on Meta. It fills in over the next few hours.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Meta didn't create the lookalike.", { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  const countryName = COMMON_COUNTRIES.find((c) => c.code === country)?.name ?? country;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={editing ? "Edit audience" : "Create audience"}
      sub={editing ? "Saved in Advertix · used when you build campaigns" : "Saved audiences are reusable Meta targeting; lookalikes are built on Meta"}
      width={700}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          {tab === "describe" ? (
            <Button variant="primary" icon={busy ? undefined : <Sparkles size={16} />} loading={busy} onClick={() => void draft()} disabled={prompt.trim().length < 10}>
              {busy ? "Drafting…" : drafted ? "Draft again" : "Draft targeting"}
            </Button>
          ) : tab === "build" ? (
            <Button variant="primary" loading={busy} onClick={() => void save()}>
              {editing ? "Save changes" : "Save audience"}
            </Button>
          ) : (
            <Button variant="primary" loading={busy} onClick={() => void createLookalike()} disabled={!seedItem}>
              Create lookalike
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!editing && (
          <Segmented
            label="How to create it"
            stretch
            value={tab}
            onChange={setTab}
            options={[
              { value: "describe" as DialogTab, label: "Describe it" },
              { value: "build" as DialogTab, label: "Build it" },
              { value: "lookalike" as DialogTab, label: "Lookalike" },
            ]}
          />
        )}

        {tab === "describe" && (
          <div className="flex flex-col gap-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && void draft()}
              rows={4}
              placeholder="e.g. Women 25–44 in the US and Canada who buy clean skincare and follow wellness creators"
              aria-label="Describe the audience"
              className={cn(fieldCls, "h-auto resize-none py-2.5 text-[15px] leading-relaxed")}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Menu
                width={260}
                trigger={(p) => (
                  <button {...p} type="button" className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 hover:text-ink">
                    <FileText size={14} aria-hidden="true" />
                    Templates
                  </button>
                )}
              >
                {(closeMenu) => (
                  <>
                    <MenuLabel>Start from a template</MenuLabel>
                    {AUDIENCE_TEMPLATES.map((t) => (
                      <MenuItem key={t.label} onSelect={() => (setPrompt(t.body), closeMenu())}>
                        {t.label}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Menu>
              <span className="text-xs text-ink-3">Cmd/Ctrl + Enter to draft</span>
            </div>
            <AiNote title="How it works">
              Advertix turns the description into targeting and looks up every interest and location on Meta, so what you save is real, editable targeting. You review it on the Build tab before saving. Needs a connected Meta ad account.
            </AiNote>
          </div>
        )}

        {tab === "build" && (
          <>
            {drafted && <div className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-[13px] text-brand-ink">Drafted by Advertix from your description. Check it, then save.</div>}
            <BuildFields f={f} set={set} />
          </>
        )}

        {tab === "lookalike" &&
          (seeds.length === 0 ? (
            <div className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">
              {board?.metaAccounts.length
                ? "No custom audience can seed a lookalike yet. Meta needs a ready custom audience (a customer list, website visitors or engagers) with at least 1,000 people."
                : "Lookalikes are built on Meta from a custom audience. Connect a Meta ad account in Connections first."}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <label className={labelCls}>
                Built from
                <select value={seed} onChange={(e) => setSeed(e.target.value)} className={fieldCls}>
                  {seeds.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name} · {s.typeLabel}
                      {board && board.metaAccounts.length > 1 ? ` · ${board.metaAccounts.find((a) => a.id === s.adAccountId)?.name ?? ""}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelCls}>
                Country
                <select value={country} onChange={(e) => setCountry(e.target.value)} className={fieldCls}>
                  {COMMON_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-2">
                <span className="flex items-baseline justify-between text-sm font-medium">
                  Similarity <span className="tabular-nums text-ink-2">{ratio}% of {countryName}</span>
                </span>
                <input type="range" min={1} max={10} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} aria-label="Lookalike size, percent of the country" className="accent-[rgb(var(--c-brand))]" />
                <span className="flex justify-between text-xs text-ink-3">
                  <span>Closest match</span>
                  <span>Broader reach</span>
                </span>
              </div>
              <AiNote title="Advertix">
                Meta picks the {ratio}% of people in {countryName} most like “{seedItem?.name}”. Smaller is closer to your customers; larger reaches more people. Meta fills it over a few hours, and its size shows here once it’s ready.
              </AiNote>
            </div>
          ))}
      </div>
    </Dialog>
  );
}
