"use client";

import { useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { Sparkles, Upload, Copy, X, Loader2 } from "lucide-react";
import { useApiClient } from "@/lib/api";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, emptyCard, type CarouselCardDraft } from "./media";


/**
 * Carousel cards editor — 2-10 ordered cards, each with one image + the
 * standard ad-card copy (headline, description, link). The headline is the
 * load-bearing field per card; description + link are optional. The ad-
 * level message + CTA come from the publish wizard (shared across cards),
 * so we don't ask for them here.
 *
 * UX shape: a vertical stack of card rows. Each row shows an image
 * dropzone + thumbnail on the left, the three text fields on the right.
 * "Add card" sits at the bottom (disabled at 10). Each card has its own
 * X to remove (disabled at 2).
 */
export function CarouselCardsEditor({
  cards,
  setCards,
  disabled,
  brief,
}: {
  cards: CarouselCardDraft[];
  setCards: React.Dispatch<React.SetStateAction<CarouselCardDraft[]>>;
  disabled: boolean;
  brief?: string;
}) {
  const api = useApiClient();
  const [generatingCardId, setGeneratingCardId] = useState<string | null>(null);

  async function generateImage(card: CarouselCardDraft) {
    if (generatingCardId) return;
    setGeneratingCardId(card.id);
    try {
      const result = await api.generateAdImage({
        brief: brief || undefined,
        headline: card.headline.trim() || undefined,
        description: card.description.trim() || undefined,
      });
      setCards((prev) =>
        prev.map((c) => {
          if (c.id !== card.id) return c;
          if (c.filePreviewUrl) URL.revokeObjectURL(c.filePreviewUrl);
          return {
            ...c,
            savedImageUrl: result.url,
            savedImageHash: result.hash,
            file: null,
            filePreviewUrl: null,
          };
        })
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Image generation failed"
      );
    } finally {
      setGeneratingCardId(null);
    }
  }

  function patchCard(id: string, updates: Partial<CarouselCardDraft>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }
  function removeCard(id: string) {
    setCards((prev) => {
      if (prev.length <= 2) return prev;
      const found = prev.find((c) => c.id === id);
      if (found?.filePreviewUrl) URL.revokeObjectURL(found.filePreviewUrl);
      return prev.filter((c) => c.id !== id);
    });
  }
  function addCard() {
    setCards((prev) => (prev.length >= 10 ? prev : [...prev, emptyCard()]));
  }
  function pickFile(id: string, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick an image file (JPEG, PNG, WebP, GIF)");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)} MB — Meta caps uploads at 8 MB`
      );
      return;
    }
    const url = URL.createObjectURL(file);
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.filePreviewUrl) URL.revokeObjectURL(c.filePreviewUrl);
        // Picking a new file means the user is replacing the saved card
        // image — clear the savedImageUrl/Hash so the save path uploads
        // the new bytes rather than preserving the old reference.
        return {
          ...c,
          file,
          filePreviewUrl: url,
          savedImageUrl: null,
          savedImageHash: null,
        };
      })
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-ink-2">
          Cards · {cards.length} of 10
        </label>
        <button
          type="button"
          onClick={addCard}
          disabled={disabled || cards.length >= 10}
          className="inline-flex items-center gap-1 rounded-lg border border-line-2 bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add card
        </button>
      </div>
      <p className="mb-3 text-[11px] text-ink-2">
        2–10 cards · square (1:1) images render best across Feed + Reels. The
        body copy and CTA come from the publish wizard and are shared across
        cards.
      </p>
      <ul className="space-y-2.5">
        {cards.map((card, idx) => (
          <li
            key={card.id}
            className="rounded-xl border border-line-2 bg-surface p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-2">
                Card {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeCard(card.id)}
                disabled={disabled || cards.length <= 2}
                aria-label={`Remove card ${idx + 1}`}
                className="text-ink-3 transition hover:text-neg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-3">
              {/* Image picker — shows freshly-picked file OR previously
                  saved Meta-hosted image (edit mode). Click swaps either
                  with a new file. Below empty slots: "Generate with AI"
                  shortcut that calls Gemini + uploads to Meta. */}
              <div className="shrink-0">
                {generatingCardId === card.id ? (
                  <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand/30 bg-brand-soft">
                    <Loader2 className="h-5 w-5 animate-spin text-brand" />
                    <span className="text-[9px] font-semibold text-brand">
                      Generating…
                    </span>
                  </div>
                ) : card.filePreviewUrl || card.savedImageUrl ? (
                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES}
                      onChange={(e) =>
                        pickFile(card.id, e.target.files?.[0] ?? null)
                      }
                      className="hidden"
                      disabled={disabled}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.filePreviewUrl ?? card.savedImageUrl ?? ""}
                      alt={`Card ${idx + 1}`}
                      className="h-20 w-20 rounded-lg object-cover ring-1 ring-line-2"
                    />
                  </label>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label
                      className={clsx(
                        "flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-line-2 bg-surface-2 text-center text-[10px] font-semibold text-ink-2 transition hover:border-brand/40 hover:bg-surface-2",
                        disabled && "pointer-events-none opacity-60"
                      )}
                    >
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        onChange={(e) =>
                          pickFile(card.id, e.target.files?.[0] ?? null)
                        }
                        className="hidden"
                        disabled={disabled}
                      />
                      <Upload className="h-4 w-4 text-ink-3" />
                      Pick image
                    </label>
                    {/* AI image generation — Gemini needs at least ONE of
                        brief / headline / description (backend validation).
                        We show the button as soon as any of those is set
                        so the user always has the option. */}
                    {(brief?.trim() ||
                      card.headline.trim() ||
                      card.description.trim()) && (
                      <button
                        type="button"
                        onClick={() => generateImage(card)}
                        disabled={disabled || !!generatingCardId}
                        title="Generate this card's image with AI (Gemini)"
                        className="inline-flex w-20 items-center justify-center gap-0.5 rounded-md border border-brand/30 bg-brand-soft px-1 py-0.5 text-[9px] font-semibold text-brand transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        AI image
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Copy fields */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  type="text"
                  value={card.headline}
                  onChange={(e) =>
                    patchCard(card.id, { headline: e.target.value })
                  }
                  maxLength={40}
                  placeholder="Headline (≤ 40 chars)"
                  disabled={disabled}
                  className="h-8 w-full rounded-md border border-line-2 bg-surface px-2 text-xs placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:opacity-60"
                />
                <input
                  type="text"
                  value={card.description}
                  onChange={(e) =>
                    patchCard(card.id, { description: e.target.value })
                  }
                  maxLength={125}
                  placeholder="Description (optional)"
                  disabled={disabled}
                  className="h-8 w-full rounded-md border border-line-2 bg-surface px-2 text-xs placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:opacity-60"
                />
                <input
                  type="url"
                  value={card.link}
                  onChange={(e) =>
                    patchCard(card.id, { link: e.target.value })
                  }
                  placeholder="Link URL (optional — falls back to ad link)"
                  disabled={disabled}
                  className="h-8 w-full rounded-md border border-line-2 bg-surface px-2 text-xs placeholder:text-ink-3 focus:border-brand focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Read-only carousel preview shown in the Detail Modal when NOT editing.
 * Mirrors the shape of the editor (image left, copy stacked right) but
 * with no inputs, no replace controls — just the saved data.
 */
export function CarouselDetailList({ cards }: { cards: CarouselCardDraft[] }) {
  if (cards.length === 0) {
    return (
      <div className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">
        This carousel has no cards saved yet.
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-2">
        Cards · {cards.length}
      </div>
      <ul className="space-y-2.5">
        {cards.map((card, idx) => (
          <li
            key={card.id}
            className="flex gap-3 rounded-xl border border-line-2 bg-surface p-2.5"
          >
            <div className="shrink-0">
              {card.savedImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={card.savedImageUrl}
                  alt={`Card ${idx + 1}`}
                  className="h-20 w-20 rounded-lg object-cover ring-1 ring-line-2"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-surface-2 text-[10px] text-ink-3">
                  No image
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">
                Card {idx + 1}
              </div>
              <div className="truncate text-sm font-semibold text-ink">
                {card.headline || (
                  <span className="font-normal italic text-ink-3">
                    No headline
                  </span>
                )}
              </div>
              {card.description && (
                <div className="line-clamp-2 text-xs text-ink-2">
                  {card.description}
                </div>
              )}
              {card.link && (
                <div className="truncate text-[11px] text-brand">
                  {card.link}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}