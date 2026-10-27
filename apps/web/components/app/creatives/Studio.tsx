"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ChevronDown, FileText, ImagePlus, Sparkles, X } from "lucide-react";
import { useApiClient, type CreativeBoard, type CreativeBoardItem, type CreativeType, type GeneratedCopy } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, Card, IconButton, Menu, MenuItem, MenuLabel, Segmented, Skeleton } from "@/components/app/ui";
import { headlineToName, pickFirst } from "./media";
import { PROMPT_TEMPLATES } from "./templates";
import { unquote } from "./board";

/**
 * Creative studio (guide §5.4, plan A8): describe the ad, pick the kind,
 * format and tone, and Advertix writes four drafts (one for a carousel),
 * optionally with images. It builds on the best-returning hook in view when
 * there is one. Drafts are not saved until you save them; nothing is
 * invented when the AI call fails.
 */

type Kind = "IMAGE" | "VIDEO" | "CAROUSEL" | "TEXT";
type Aspect = "square" | "portrait" | "landscape";
type Draft = {
  id: string;
  kind: Kind;
  headline: string;
  body: string;
  description: string;
  cta: string;
  image: { url: string; hash: string; dataUrl: string } | null;
  cards: { headline: string; description?: string; image: { url: string; hash: string; dataUrl: string } | null }[];
  content: Record<string, unknown>;
};

const KINDS: { value: Kind; label: string }[] = [
  { value: "IMAGE", label: "Image" },
  { value: "VIDEO", label: "Video" },
  { value: "CAROUSEL", label: "Carousel" },
  { value: "TEXT", label: "Text" },
];
const ASPECTS: { value: Aspect; label: string; hint: string }[] = [
  { value: "square", label: "1:1", hint: "Feed" },
  { value: "portrait", label: "9:16", hint: "Reels / Stories" },
  { value: "landscape", label: "16:9", hint: "Video / Display" },
];
const TONES = ["Professional", "Founder-led", "Playful", "Urgent"] as const;
const PLATFORMS = [
  { value: "META", label: "Meta" },
  { value: "GOOGLE", label: "Google" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "LINKEDIN", label: "LinkedIn" },
];
const OBJECTIVES = ["Conversions", "Leads", "Traffic", "Awareness"];
// Images per run = how many image variants come back (0 = copy only, four text drafts).
const IMAGE_COUNTS = [1, 2, 3, 4, 0];
const COPY_ONLY_DRAFTS = 4;
type Quality = "low" | "medium" | "high";
// Low and Medium use GPT Image mini; High uses the full GPT Image model (API side).
const QUALITIES: { value: Quality; label: string; hint: string }[] = [
  { value: "low", label: "Low", hint: "Fastest and cheapest, for testing ideas" },
  { value: "medium", label: "Medium", hint: "Sharper, about twice the cost of Low" },
  { value: "high", label: "High", hint: "Best detail, text and product likeness; full model, much slower and costlier" },
];
const REF_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type StudioHandle = { seedFrom: (item: CreativeBoardItem) => void };

const errorText = (err: unknown) => (err instanceof Error && err.message ? err.message : "The AI service didn't answer. Try again.");

/** A labelled group in the studio settings. */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-baseline gap-1.5 text-xs font-medium text-ink-2">
        {label}
        {hint && <span className="truncate font-normal text-ink-3">· {hint}</span>}
      </span>
      {children}
    </div>
  );
}

function Chip({ label, value, width = 220, children }: { label: string; value: string; width?: number; children: (close: () => void) => React.ReactNode }) {
  return (
    <Menu
      width={width}
      trigger={(p) => (
        <button
          {...p}
          type="button"
          className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 hover:text-ink"
        >
          <span className="text-ink-3">{label}</span>
          <span className="font-semibold text-ink">{value}</span>
          <ChevronDown size={14} className="text-ink-3" aria-hidden="true" />
        </button>
      )}
    >
      {children}
    </Menu>
  );
}

export const Studio = forwardRef<
  StudioHandle,
  {
    board: CreativeBoard | null;
    clientId: string | null;
    clientName: string | null;
    onClose: () => void;
    onSaved: () => void;
  }
>(function Studio({ board, clientId, clientName, onClose, onSaved }, ref) {
  const api = useApiClient();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [kind, setKind] = useState<Kind>("IMAGE");
  const [aspect, setAspect] = useState<Aspect>("square");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Professional");
  const [platform, setPlatform] = useState("META");
  const [objective, setObjective] = useState("Conversions");
  const [images, setImages] = useState(2);
  const [quality, setQuality] = useState<Quality>("low");
  const [cardImages, setCardImages] = useState(true);
  const [cardCount, setCardCount] = useState(4);
  const [refImage, setRefImage] = useState<File | null>(null);
  const [useHook, setUseHook] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const hook = board?.bestHook ?? null;

  useImperativeHandle(ref, () => ({
    seedFrom: (item) => {
      const k: Kind = item.format === "VIDEO" || item.format === "CAROUSEL" || item.format === "TEXT" ? item.format : "IMAGE";
      setKind(k);
      setPrompt(
        [
          `Fresh variants of “${item.name}”.`,
          item.headline ? `Its headline: “${unquote(item.headline)}”.` : null,
          item.body ? `Its text: “${unquote(item.body)}”.` : null,
          item.status === "Fatigued" ? "People have seen it a lot; keep the offer but open with a different hook." : "Keep what works; try new opening lines.",
        ]
          .filter(Boolean)
          .join(" ")
      );
      setTimeout(() => promptRef.current?.focus(), 50);
    },
  }));

  const aspectLabel = ASPECTS.find((a) => a.value === aspect)!;
  const canGenerate = prompt.trim().length >= 10 && !running;
  const draftCount = kind === "IMAGE" && images > 0 ? images : COPY_ONLY_DRAFTS;
  const makesImages = (kind === "IMAGE" && images > 0) || (kind === "CAROUSEL" && cardImages);

  const generate = async () => {
    if (!canGenerate) return;
    setRunning(true);
    setError(null);
    const brief = [
      prompt.trim(),
      "",
      `Tone: ${tone}. Creative type: ${kind.toLowerCase()}.${kind === "TEXT" || kind === "VIDEO" ? "" : ` Aspect: ${aspectLabel.label} (${aspectLabel.hint}).`}`,
      useHook && hook
        ? `Our best-performing ad${clientName ? ` for ${clientName}` : ""} opens with: “${unquote(hook.text)}” (${hook.roas.toFixed(2)}x ROAS). Build on what works about that hook without copying it word for word.`
        : "",
    ]
      .filter((l, i) => l !== "" || i === 1)
      .join("\n");
    const ref = kind === "IMAGE" || kind === "CAROUSEL" ? refImage : null;
    try {
      const imageCalls = kind === "IMAGE" && images > 0
        ? Promise.allSettled(Array.from({ length: images }, () => api.generateAdImage({ brief, aspect, image: ref, quality })))
        : Promise.resolve([]);
      const { copy } = await api.generateCopy({ brief, platform, objective, ...(kind === "CAROUSEL" ? { kind: "carousel" as const, cardCount } : {}) });
      const shots = (await imageCalls) as PromiseSettledResult<{ url: string; hash: string; dataUrl: string }>[];
      const ok = shots.filter((s): s is PromiseFulfilledResult<{ url: string; hash: string; dataUrl: string }> => s.status === "fulfilled").map((s) => s.value);
      const failed = shots.find((s): s is PromiseRejectedResult => s.status === "rejected");
      if (kind === "IMAGE" && images > 0 && ok.length === 0 && failed) toast.error(`Images didn't generate: ${errorText(failed.reason)}`, { duration: 6000 });
      const made = kind === "CAROUSEL" ? await carouselDraft(copy, brief, ref) : copyDrafts(copy, brief, ok);
      setDrafts((d) => [...made, ...d]);
    } catch (err) {
      // No made-up copy: say what happened and keep the prompt for a retry.
      setError(errorText(err));
    } finally {
      setRunning(false);
    }
  };

  function copyDrafts(copy: GeneratedCopy, brief: string, shots: { url: string; hash: string; dataUrl: string }[]): Draft[] {
    const h = copy.headlines ?? [];
    const t = copy.primary_texts ?? [];
    const d = copy.descriptions ?? [];
    const c = copy.ctas ?? [];
    // Image runs: one draft per image variant asked for; other kinds: up to four copy drafts.
    const n = draftCount;
    const stamp = Date.now();
    return Array.from({ length: n }, (_, i) => {
      const image = shots.length ? shots[i % shots.length] : null;
      const content: Record<string, unknown> = {
        headlines: pickFirst(h, i % Math.max(1, h.length)),
        primary_texts: pickFirst(t, i % Math.max(1, t.length)),
        descriptions: pickFirst(d, i % Math.max(1, d.length)),
        ctas: pickFirst(c, i % Math.max(1, c.length)),
        brief,
        tone,
        aspect,
        ...(image ? { url: image.url, imageUrl: image.url, imageHash: image.hash } : {}),
      };
      return {
        id: `${stamp}-${i}`,
        kind,
        headline: h[i % Math.max(1, h.length)] ?? "",
        body: t[i % Math.max(1, t.length)] ?? "",
        description: d[i % Math.max(1, d.length)] ?? "",
        cta: c[i % Math.max(1, c.length)] ?? "",
        image,
        cards: [],
        content,
      };
    });
  }

  async function carouselDraft(copy: GeneratedCopy, brief: string, ref: File | null): Promise<Draft[]> {
    const cards = copy.cards ?? [];
    let shots: ({ url: string; hash: string; dataUrl: string } | null)[] = cards.map(() => null);
    if (cardImages && cards.length) {
      const res = await Promise.allSettled(cards.map((card) => api.generateAdImage({ brief, headline: card.headline, description: card.description, aspect, image: ref, quality })));
      shots = res.map((r) => (r.status === "fulfilled" ? r.value : null));
      const missing = shots.filter((s) => !s).length;
      if (missing) toast.error(missing === cards.length ? "Card images didn't generate. Add them in Edit after saving." : `${missing} card image${missing === 1 ? "" : "s"} didn't generate. Add ${missing === 1 ? "it" : "them"} in Edit after saving.`, { duration: 6000 });
    }
    const content = {
      cards: cards.map((card, i) => ({ headline: card.headline, ...(card.description ? { description: card.description } : {}), ...(shots[i] ? { url: shots[i]!.url, imageUrl: shots[i]!.url, imageHash: shots[i]!.hash } : {}) })),
      primary_texts: copy.primary_texts ?? [],
      ctas: copy.ctas ?? [],
      ...(shots[0] ? { url: shots[0].url } : {}),
      brief,
      tone,
      aspect,
    };
    return [
      {
        id: `${Date.now()}-c`,
        kind: "CAROUSEL",
        headline: cards[0]?.headline ?? "",
        body: copy.primary_texts?.[0] ?? "",
        description: cards[0]?.description ?? "",
        cta: copy.ctas?.[0] ?? "",
        image: shots[0] ?? null,
        cards: cards.map((card, i) => ({ ...card, image: shots[i] })),
        content,
      },
    ];
  }

  const save = async (draft: Draft) => {
    setSaving(draft.id);
    try {
      await api.createCreative({
        name: headlineToName(draft.headline) || `AI ${draft.kind.toLowerCase()} · ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        type: draft.kind as CreativeType,
        content: draft.content,
        aiGenerated: true,
        clientId,
      });
      setDrafts((d) => d.filter((x) => x.id !== draft.id));
      return true;
    } catch (err) {
      toast.error(errorText(err));
      return false;
    } finally {
      setSaving(null);
    }
  };
  const saveOne = async (draft: Draft) => {
    if (await save(draft)) {
      toast.success(draft.kind !== "TEXT" && !draft.image && !draft.cards.some((c) => c.image) ? "Saved as a draft. Add the image in Edit." : "Saved to your library");
      onSaved();
    }
  };
  const saveAll = async () => {
    let n = 0;
    for (const d of drafts) if (await save(d)) n++;
    if (n) {
      toast.success(`${n} draft${n === 1 ? "" : "s"} saved to your library`);
      onSaved();
    }
  };

  useEffect(() => {
    if (kind === "TEXT" || kind === "VIDEO") setRefImage(null);
  }, [kind]);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] [background:var(--grad)] text-white">
          <Sparkles size={18} strokeWidth={2.25} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-base font-semibold">Creative studio</span>
          <span className="text-[13px] text-ink-2">Describe the ad. Advertix writes copy (and images, if you like){hook ? " from the hook that already works here" : ""}.</span>
        </span>
        <IconButton label="Hide studio" size={32} onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>

      {/* The brief: a roomy writing area with templates and a reference image under it. */}
      <div className="flex flex-col rounded-[14px] border border-line bg-surface-2 transition-colors focus-within:border-brand focus-within:ring-[3px] focus-within:ring-brand-soft">
        <textarea
          ref={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void generate();
          }}
          rows={5}
          placeholder={"Describe the ad: the product, who it's for, the offer and the feeling.\ne.g. A 15-second morning-routine video for Glow Serum, opening on the founder’s line, ending on the 28-day result"}
          aria-label="Describe the ad"
          className="min-h-[136px] w-full resize-y border-0 bg-transparent px-4 pb-2 pt-3.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
          <Menu
            width={280}
            trigger={(p) => (
              <button {...p} type="button" className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 hover:text-ink">
                <FileText size={14} aria-hidden="true" />
                Templates
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuLabel>Start from a template</MenuLabel>
                {PROMPT_TEMPLATES.map((t) => (
                  <MenuItem key={t.label} onSelect={() => (setPrompt(t.brief), close(), setTimeout(() => promptRef.current?.focus(), 50))}>
                    {t.label}
                  </MenuItem>
                ))}
              </>
            )}
          </Menu>
          {(kind === "IMAGE" || kind === "CAROUSEL") &&
            (refImage ? (
              <span className="flex h-8 items-center gap-1.5 rounded-full border border-brand bg-brand-soft pl-3 pr-1 text-[13px] font-medium text-brand-ink">
                <ImagePlus size={14} aria-hidden="true" />
                <span className="max-w-[160px] truncate">{refImage.name}</span>
                <button type="button" aria-label="Remove reference image" onClick={() => setRefImage(null)} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface">
                  <X size={13} />
                </button>
              </span>
            ) : (
              <label className="flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 hover:text-ink" title="A product photo or style reference for the images">
                <ImagePlus size={14} aria-hidden="true" />
                Reference image
                <input
                  type="file"
                  accept={REF_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    if (!REF_TYPES.includes(f.type)) return void toast.error("Reference image must be PNG, JPEG or WebP.");
                    if (f.size > 10 * 1024 * 1024) return void toast.error("Reference image is too large (max 10 MB).");
                    setRefImage(f);
                  }}
                />
              </label>
            ))}
          {(kind === "IMAGE" || kind === "CAROUSEL") && (
            <Chip label="Shape" value={`${aspectLabel.label} · ${aspectLabel.hint}`}>
              {(close) => ASPECTS.map((a) => <MenuItem key={a.value} selected={aspect === a.value} hint={a.hint} onSelect={() => (setAspect(a.value), close())}>{a.label}</MenuItem>)}
            </Chip>
          )}
          {kind === "IMAGE" && (
            <Chip label="Images" value={images === 0 ? "Copy only" : String(images)}>
              {(close) => (
                <>
                  <MenuLabel>Image variants per run · up to 20 an hour</MenuLabel>
                  {IMAGE_COUNTS.map((n) => (
                    <MenuItem key={n} selected={images === n} onSelect={() => (setImages(n), close())}>
                      {n === 0 ? `Copy only (${COPY_ONLY_DRAFTS} text drafts)` : `${n} variant${n === 1 ? "" : "s"}`}
                    </MenuItem>
                  ))}
                </>
              )}
            </Chip>
          )}
          {makesImages && (
            <Chip label="Quality" value={QUALITIES.find((q) => q.value === quality)!.label} width={300}>
              {(close) => (
                <>
                  <MenuLabel>Image quality</MenuLabel>
                  {QUALITIES.map((q) => (
                    <MenuItem key={q.value} selected={quality === q.value} hint={q.hint} onSelect={() => (setQuality(q.value), close())}>
                      {q.label}
                    </MenuItem>
                  ))}
                </>
              )}
            </Chip>
          )}
          <span className="ml-auto text-xs text-ink-3">
            {prompt.trim().length > 0 && prompt.trim().length < 10 ? "A few more words, please (10 characters minimum)." : "Ctrl + Enter to generate"}
          </span>
        </div>
      </div>

      {/* Settings, grouped and labelled. */}
      <div className="grid gap-x-6 gap-y-4 min-[720px]:grid-cols-2 min-[1180px]:grid-cols-3">
        <Field label="Type">
          <Segmented label="Type" size="sm" value={kind} onChange={setKind} options={KINDS} />
        </Field>
        <Field label="Tone">
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tone === t}
                onClick={() => setTone(t)}
                className={cn(
                  "h-8 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors",
                  tone === t ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface text-ink-2 hover:text-ink"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Platform and goal">
          <div className="flex flex-wrap gap-1.5">
            <Chip label="For" value={PLATFORMS.find((p) => p.value === platform)!.label}>
              {(close) => PLATFORMS.map((p) => <MenuItem key={p.value} selected={platform === p.value} onSelect={() => (setPlatform(p.value), close())}>{p.label}</MenuItem>)}
            </Chip>
            <Chip label="Goal" value={objective}>
              {(close) => OBJECTIVES.map((o) => <MenuItem key={o} selected={objective === o} onSelect={() => (setObjective(o), close())}>{o}</MenuItem>)}
            </Chip>
          </div>
        </Field>
        {kind === "CAROUSEL" && (
          <>
            <Field label="Cards">
              <Segmented label="Cards" size="sm" value={cardCount} onChange={setCardCount} options={[2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
            </Field>
            <Field label="Card images">
              <Segmented label="Card images" size="sm" value={cardImages ? "on" : "off"} onChange={(v) => setCardImages(v === "on")} options={[{ value: "on", label: "Generate" }, { value: "off", label: "Add later" }]} />
            </Field>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        {hook && (
          <button
            type="button"
            aria-pressed={useHook}
            onClick={() => setUseHook((v) => !v)}
            title={`“${unquote(hook.text)}” · ${hook.roas.toFixed(2)}x ROAS`}
            className={cn("mr-auto max-w-full truncate rounded-full px-2.5 py-1 text-xs", useHook ? "bg-brand-soft text-brand-ink" : "text-ink-3 line-through")}
          >
            Builds on <span className="font-semibold">{hook.name}</span>
          </button>
        )}
        <Button variant="primary" icon={<Sparkles size={16} />} onClick={() => void generate()} disabled={!canGenerate} loading={running}>
          {running ? "Generating…" : drafts.length ? "Generate more" : "Generate creative"}
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-neg/30 bg-neg-soft px-4 py-3 text-sm text-neg">
          Couldn’t write drafts: {error}
        </div>
      )}

      {running && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {Array.from({ length: kind === "CAROUSEL" ? 1 : draftCount }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm font-semibold">
              {drafts.length} draft{drafts.length === 1 ? "" : "s"} <span className="font-normal text-ink-2">· not saved yet</span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setDrafts([])}>
              Discard all
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void saveAll()} disabled={saving !== null}>
              Save all
            </Button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {drafts.map((d) => (
              <div key={d.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-brand-mid bg-surface">
                <div className="relative aspect-[4/5] bg-brand-soft">
                  {d.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- generated image preview (data URI) */
                    <img src={d.image.dataUrl || d.image.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <p className="absolute inset-0 flex items-center p-5 text-[15px] font-semibold text-brand-ink [text-wrap:pretty]">“{unquote(d.headline || d.body)}”</p>
                  )}
                  <span className="absolute left-2.5 top-2.5 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-brand-ink">New</span>
                  {d.kind === "CAROUSEL" && <span className="absolute right-2.5 top-2.5 rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-2">{d.cards.length} cards</span>}
                  <button type="button" aria-label="Discard draft" onClick={() => setDrafts((x) => x.filter((y) => y.id !== d.id))} className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface/90 text-ink-2 hover:text-ink">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <span className="line-clamp-2 text-sm font-semibold">{d.headline}</span>
                  <span className="line-clamp-3 text-[13px] text-ink-2">{d.body}</span>
                  {d.cta && <span className="text-xs text-ink-3">CTA · {d.cta}</span>}
                  <Button variant="soft" size="sm" className="mt-auto self-start" loading={saving === d.id} onClick={() => void saveOne(d)}>
                    Save to library
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
});
