"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { Upload, Copy, X, Loader2, Check, Pencil, Save } from "lucide-react";
import { useApiClient } from "@/lib/api";
import { Button, Dialog } from "@/components/app/ui";
import { VideoThumbnailPlayer } from "@/components/ui/VideoThumbnailPlayer";
import { CarouselCardsEditor, CarouselDetailList } from "./CarouselCardsEditor";
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, cardId, readVideoMetadata, type CarouselCardDraft, type CreativeView as Creative, headlineToName, pickFirst } from "./media";


/* ───────────────────────────────────────── */
/* Creative Detail Modal                      */
/* ───────────────────────────────────────── */

export function EditCreativeDialog({
  open,
  onClose,
  creative,
  rawContent,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  creative: Creative;
  rawContent: unknown;
  /** Called after a successful save so the parent can refetch the list. */
  onSaved?: () => void;
}) {
  const api = useApiClient();
  // Always editing: the Creatives drawer is the read-only view (A8).
  const editing = true;
  const [name, setName] = useState(creative.name);
  // For attaching an image to a copy-only creative. Mirrors the small subset
  // of state UploadCreativeModal manages — we don't need URL paste here;
  // device upload is enough.
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Video replacement flow for VIDEO creatives. When the user picks a new
  // file, we upload + poll on Save (same path as UploadCreativeModal); the
  // result swaps out videoId / thumbnailUrl on the creative content.
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPct, setVideoPct] = useState(0);
  const [videoPhase, setVideoPhase] = useState<"upload" | "processing" | null>(null);
  // Carousel editing state — only used when creative.type === "CAROUSEL".
  // Initialized from rawContent.cards on open; each saved card becomes a
  // `CarouselCardDraft` with savedImageUrl/Hash so the editor can render
  // the existing image without re-uploading.
  const [carouselCards, setCarouselCards] = useState<CarouselCardDraft[]>([]);

  // Edit-mode copy state. We keep a local mutable copy of each variant array
  // so the user can tweak text inline without clobbering the original until
  // they hit Save. `picked` tracks which variant in each array the user wants
  // as the default — at save time we reorder so picked lands at index [0].
  const [edited, setEdited] = useState({
    headlines: [] as string[],
    primary_texts: [] as string[],
    descriptions: [] as string[],
    ctas: [] as string[],
  });
  const [picked, setPicked] = useState({
    headline: 0,
    primaryText: 0,
    description: 0,
    cta: 0,
  });

  // Reset local state every time the modal opens. Otherwise a previous
  // edit/attach can leak across creatives.
  useEffect(() => {
    if (open) {
      setName(creative.name);
      setFile(null);
      setVideoFile(null);
      setVideoPct(0);
      setVideoPhase(null);
      setSaving(false);
      // Snapshot the copy arrays from rawContent. If a field is missing or
      // malformed we fall back to [] so the section just renders empty.
      const c =
        rawContent && typeof rawContent === "object"
          ? (rawContent as Record<string, unknown>)
          : {};
      const asStringArr = (v: unknown): string[] =>
        Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
      setEdited({
        headlines: asStringArr(c.headlines),
        primary_texts: asStringArr(c.primary_texts),
        descriptions: asStringArr(c.descriptions),
        ctas: asStringArr(c.ctas),
      });
      setPicked({ headline: 0, primaryText: 0, description: 0, cta: 0 });
      // Carousel: hydrate the editor draft list from saved card data.
      const savedCards = Array.isArray(c.cards) ? c.cards : [];
      setCarouselCards(
        savedCards.map((raw) => {
          const card = (raw ?? {}) as Record<string, unknown>;
          return {
            id: cardId(),
            file: null,
            filePreviewUrl: null,
            savedImageUrl:
              typeof card.imageUrl === "string"
                ? card.imageUrl
                : typeof card.url === "string"
                  ? card.url
                  : null,
            savedImageHash:
              typeof card.imageHash === "string" ? card.imageHash : null,
            headline:
              typeof card.headline === "string"
                ? card.headline
                : typeof card.name === "string"
                  ? card.name
                  : "",
            description:
              typeof card.description === "string" ? card.description : "",
            link: typeof card.link === "string" ? card.link : "",
          };
        })
      );
    }
  }, [open, creative.name, rawContent]);

  // Object-URL lifecycle for the replacement video preview.
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!videoFile) {
      setVideoPreviewUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(videoFile);
    setVideoPreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [videoFile]);

  // Object-URL lifecycle for the local file preview.
  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

  function handlePickFile(picked: File | null) {
    if (!picked) {
      setFile(null);
      return;
    }
    if (!picked.type.startsWith("image/")) {
      toast.error("Pick an image file (JPEG, PNG, WebP, GIF)");
      return;
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      toast.error(
        `Image is ${(picked.size / 1024 / 1024).toFixed(1)} MB — Meta caps uploads at 8 MB`
      );
      return;
    }
    setFile(picked);
  }

  async function handleSave() {
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name can't be empty");
      return;
    }
    // Strip empty lines after edit (a user can blank a chip to delete it).
    const cleaned = {
      headlines: edited.headlines.map((s) => s.trim()).filter(Boolean),
      primary_texts: edited.primary_texts.map((s) => s.trim()).filter(Boolean),
      descriptions: edited.descriptions.map((s) => s.trim()).filter(Boolean),
      ctas: edited.ctas.map((s) => s.trim()).filter(Boolean),
    };
    setSaving(true);
    try {
      // Build the new content payload. If the user attached an image,
      // upload it via Meta first and merge the resulting URL into whatever
      // copy fields the creative already has (so AI variants survive).
      const baseContent =
        rawContent && typeof rawContent === "object"
          ? (rawContent as Record<string, unknown>)
          : {};
      let nextContent: Record<string, unknown> = { ...baseContent };
      if (file) {
        const result = await api.uploadMetaImage(file);
        // Keep the Meta hash too, so publishing doesn't upload it again.
        nextContent = { ...nextContent, url: result.url, imageUrl: result.url, imageHash: result.hash };
      }
      // Carousel — for each card, either upload its new file or preserve
      // the existing saved url + hash. Final shape mirrors what
      // UploadCreativeModal saves so the publish wizard reads them the
      // same way.
      if (creative.type === "CAROUSEL") {
        if (carouselCards.length < 2) {
          throw new Error("A carousel needs at least 2 cards");
        }
        const missing = carouselCards.findIndex(
          (c) => !c.file && !c.savedImageUrl
        );
        if (missing !== -1) {
          throw new Error(`Pick an image for card ${missing + 1}`);
        }
        const out: Array<Record<string, unknown>> = [];
        for (const c of carouselCards) {
          let url: string;
          let hash: string | undefined;
          if (c.file) {
            const result = await api.uploadMetaImage(c.file);
            url = result.url;
            hash = result.hash;
          } else {
            url = c.savedImageUrl!;
            hash = c.savedImageHash ?? undefined;
          }
          out.push({
            url,
            imageUrl: url,
            ...(hash ? { imageHash: hash } : {}),
            headline: c.headline.trim() || undefined,
            description: c.description.trim() || undefined,
            link: c.link.trim() || undefined,
          });
        }
        nextContent.cards = out;
        nextContent.url = (out[0]?.url as string) ?? nextContent.url;
      }

      // Video replacement — upload to /advideos, then poll transcode.
      // Same shape as UploadCreativeModal: persist videoId + thumbnailUrl,
      // with `url` pointing at the thumbnail for the in-app preview.
      if (videoFile) {
        setVideoPhase("upload");
        setVideoPct(0);
        const uploaded = await api.uploadMetaVideo(videoFile, {
          onProgress: (pct) => setVideoPct(pct),
        });
        setVideoPhase("processing");
        let newThumb: string | null = null;
        const startedAt = Date.now();
        const maxMs = 3 * 60 * 1000;
        while (true) {
          const probe = await api.getMetaVideoStatus(uploaded.id);
          if (probe.status === "ready") {
            newThumb = probe.thumbnailUrl;
            break;
          }
          if (probe.status === "error") {
            throw new Error("Meta failed to transcode the new video");
          }
          if (Date.now() - startedAt > maxMs) {
            throw new Error(
              "Video still processing — try again in a minute or use a smaller file"
            );
          }
          await new Promise((r) => setTimeout(r, 3000));
        }
        nextContent.videoId = uploaded.id;
        nextContent.thumbnailUrl = newThumb ?? undefined;
        nextContent.url = newThumb ?? nextContent.url;
        setVideoPhase(null);
      }
      // Reorder each array so the picked variant lands at index [0] —
      // this is what makes "picking a default" actually take effect when
      // the creative is used in the publish wizard later.
      if (cleaned.headlines.length)
        nextContent.headlines = pickFirst(cleaned.headlines, picked.headline);
      if (cleaned.primary_texts.length)
        nextContent.primary_texts = pickFirst(
          cleaned.primary_texts,
          picked.primaryText
        );
      if (cleaned.descriptions.length)
        nextContent.descriptions = pickFirst(
          cleaned.descriptions,
          picked.description
        );
      if (cleaned.ctas.length)
        nextContent.ctas = pickFirst(cleaned.ctas, picked.cta);

      await api.updateCreative(creative.id, {
        name: trimmed,
        content: nextContent,
      });
      toast.success("Creative updated");
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      if (
        msg.toLowerCase().includes("no meta") ||
        msg.toLowerCase().includes("ad account")
      ) {
        toast.error(
          "Connect a Meta ad account first (Connections) to attach an image"
        );
      } else {
        toast.error(msg);
      }
      setSaving(false);
      setVideoPhase(null);
    }
  }

  // Pluck the AI-generated copy arrays. If this isn't an AI creative, these
  // will all be undefined and the modal falls back to whatever it has.
  const copy =
    rawContent && typeof rawContent === "object"
      ? (rawContent as {
          headlines?: unknown;
          primary_texts?: unknown;
          descriptions?: unknown;
          ctas?: unknown;
        })
      : null;
  const headlines = Array.isArray(copy?.headlines)
    ? (copy!.headlines as string[]).filter((s) => typeof s === "string")
    : [];
  const primaryTexts = Array.isArray(copy?.primary_texts)
    ? (copy!.primary_texts as string[]).filter((s) => typeof s === "string")
    : [];
  const descriptions = Array.isArray(copy?.descriptions)
    ? (copy!.descriptions as string[]).filter((s) => typeof s === "string")
    : [];
  const ctas = Array.isArray(copy?.ctas)
    ? (copy!.ctas as string[]).filter((s) => typeof s === "string")
    : [];

  const hasCopy = Boolean(
    headlines.length || primaryTexts.length || descriptions.length || ctas.length
  );

  function copyToClipboard(text: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Clipboard not available");
      return;
    }
    void navigator.clipboard.writeText(text).then(() => {
      toast.success("Copied");
    });
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? () => {} : onClose}
      title="Edit creative"
      sub={`${creative.type.charAt(0) + creative.type.slice(1).toLowerCase()} · added ${creative.createdAt}${creative.aiGenerated ? " · AI-generated" : ""}`}
      width={720}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} icon={saving ? undefined : <Save size={16} strokeWidth={2.5} />}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Creative name"
              maxLength={120}
              disabled={saving}
              className="h-10 w-full rounded-ctl border border-line-2 bg-surface px-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60"
            />
          </label>
          {/* Media preview. Render priority by type:
              - CAROUSEL + editing → CarouselCardsEditor (replace, add, remove, reorder copy)
              - CAROUSEL + read mode → CarouselDetailList (horizontal cards)
              - VIDEO → interactive player (click to play)
              - IMAGE → static <img> */}
          {creative.type === "CAROUSEL" ? (
            editing ? (
              <CarouselCardsEditor
                cards={carouselCards}
                setCards={setCarouselCards}
                disabled={saving}
                brief={creative.name}
              />
            ) : (
              <CarouselDetailList cards={carouselCards} />
            )
          ) : creative.type === "VIDEO" && (creative.url || creative.videoId) ? (
            <div className="overflow-hidden rounded-xl border border-line-2 bg-ink">
              <VideoThumbnailPlayer
                thumbnailUrl={creative.url ?? null}
                videoId={creative.videoId ?? null}
                alt={creative.name}
                className="aspect-video w-full"
                buttonSize="lg"
                showBadge={false}
              />
            </div>
          ) : creative.url ? (
            <div className="overflow-hidden rounded-xl border border-line-2 bg-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={creative.url}
                alt={creative.name}
                className="aspect-video w-full object-contain"
              />
            </div>
          ) : null}

          {/* Replace-video picker — only in edit mode for VIDEO creatives.
              Mirrors the upload + transcode flow from UploadCreativeModal
              but staged: nothing actually goes to Meta until the user clicks
              Save changes. */}
          {editing && creative.type === "VIDEO" && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-2">
                Replace video
              </label>
              {videoFile ? (
                <div className="flex items-center gap-3 rounded-xl border border-line-2 bg-surface p-2">
                  <video
                    src={videoPreviewUrl ?? undefined}
                    className="h-16 w-16 shrink-0 rounded-lg bg-ink object-cover"
                    preload="metadata"
                    muted
                  />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-semibold text-ink">
                      {videoFile.name}
                    </div>
                    <div className="text-[10px] text-ink-2">
                      {(videoFile.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                      {videoFile.type}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVideoFile(null)}
                    disabled={saving}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label
                  className={clsx(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-2 bg-surface-2 px-4 py-6 text-center transition hover:border-brand/40 hover:bg-surface-2",
                    saving && "pointer-events-none opacity-60"
                  )}
                >
                  <input
                    type="file"
                    accept={ACCEPTED_VIDEO_TYPES}
                    onChange={(e) => {
                      const picked = e.target.files?.[0];
                      if (!picked) return;
                      if (!picked.type.startsWith("video/")) {
                        toast.error("Pick a video file (MP4, MOV, WebM)");
                        return;
                      }
                      if (picked.size > MAX_VIDEO_BYTES) {
                        toast.error(
                          `Video is ${(picked.size / 1024 / 1024).toFixed(
                            0
                          )} MB — we cap at 200 MB`
                        );
                        return;
                      }
                      setVideoFile(picked);
                    }}
                    className="hidden"
                    disabled={saving}
                  />
                  <Upload className="h-5 w-5 text-ink-2" />
                  <p className="text-xs font-semibold text-ink">
                    Click to pick a new video
                  </p>
                  <p className="text-[11px] text-ink-2">
                    MP4 / MOV / WebM · up to 200 MB
                  </p>
                </label>
              )}

              {/* Live status row while saving. Same UI as UploadCreativeModal
                  so users see the same progress treatment whether they
                  upload a fresh video or replace an existing one. */}
              {saving && videoPhase && (
                <div className="mt-3 rounded-xl border border-line-2 bg-surface-2 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                    {videoPhase === "upload"
                      ? `Uploading replacement… ${videoPct}%`
                      : "Meta is processing the new video…"}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={clsx(
                        "h-full rounded-full bg-brand transition-all",
                        videoPhase === "processing" && "animate-pulse"
                      )}
                      style={{
                        width:
                          videoPhase === "upload" ? `${videoPct}%` : "100%",
                      }}
                    />
                  </div>
                </div>
              )}

              <p className="mt-2 text-[11px] text-ink-2">
                The old Meta video stays on Meta — replacing here points the
                creative at the new one for future campaigns.
              </p>
            </div>
          )}

          {/* Attach or replace the image (image and copy-only creatives). */}
          {editing && (creative.type === "IMAGE" || creative.type === "TEXT") && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-2">
                {creative.url ? "Replace image" : "Attach image"}
              </label>
              {filePreviewUrl ? (
                <div className="relative overflow-hidden rounded-xl border border-line-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filePreviewUrl}
                    alt="New image preview"
                    className="aspect-video w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={saving}
                    aria-label="Remove image"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-neg shadow-sm ring-1 ring-neg/30 backdrop-blur transition hover:bg-neg-soft disabled:opacity-60"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className={clsx(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line-2 bg-surface-2 px-4 py-6 text-center transition hover:border-brand/40 hover:bg-surface-2",
                    saving && "pointer-events-none opacity-60"
                  )}
                >
                  <input
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    disabled={saving}
                  />
                  <Upload className="h-5 w-5 text-ink-2" />
                  <p className="text-xs font-semibold text-ink">
                    Click to pick an image
                  </p>
                  <p className="text-[11px] text-ink-2">
                    JPEG / PNG / WebP / GIF · up to 8 MB
                  </p>
                </label>
              )}
              <p className="mt-2 text-[11px] text-ink-2">
                The image is uploaded to your Meta ad account and attached to
                this creative so it can be used in a campaign.
              </p>
            </div>
          )}

          {/* Needs-an-image hint when AI copy creative has no upload yet
              and the user isn't already in edit mode. */}
          {!editing && !creative.url && creative.aiGenerated && hasCopy && (
            <div className="rounded-xl border border-warn/30 bg-warn-soft p-3 text-[12px] text-warn">
              <strong>Next step:</strong> click <strong>Edit</strong> above
              and attach an image. The copy below is ready to use when you
              launch the campaign.
            </div>
          )}

          {/* Helper banner when editing copy variants — keep users oriented. */}
          {editing && hasCopy && (
            <div className="rounded-xl border border-brand/30 bg-brand-soft p-3">
              <div className="flex items-start gap-2 text-[11px] leading-relaxed text-brand-ink">
                <Check
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand"
                  strokeWidth={3}
                />
                <p>
                  <strong>Tap a row to pick it as the default.</strong> Tap
                  the pencil to edit the text. The picked variant becomes
                  the default that pre-fills your next campaign — the rest
                  stay as swap options.
                </p>
              </div>
            </div>
          )}

          {/* AI-generated copy sections — flip to editable arrays in edit mode. */}
          {(editing ? edited.headlines : headlines).length > 0 && (
            <CopySection
              title="Headlines"
              hint="≤ 40 chars · pick the strongest"
              items={editing ? edited.headlines : headlines}
              onCopy={copyToClipboard}
              selectedIndex={editing ? picked.headline : undefined}
              onSelect={
                editing
                  ? (i) => {
                      // Selecting a headline makes it the creative's name —
                      // the title in the library follows the chosen headline.
                      setPicked((p) => ({ ...p, headline: i }));
                      const h = headlineToName(edited.headlines[i] ?? "");
                      if (h) setName(h);
                    }
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) => {
                      setEdited((e) => {
                        const arr = [...e.headlines];
                        arr[i] = next;
                        return { ...e, headlines: arr };
                      });
                      // Editing the currently-selected headline keeps the
                      // name in sync as the user types.
                      if (i === picked.headline) {
                        const h = headlineToName(next);
                        if (h) setName(h);
                      }
                    }
                  : undefined
              }
            />
          )}
          {(editing ? edited.primary_texts : primaryTexts).length > 0 && (
            <CopySection
              title="Primary text"
              hint="≤ 125 chars · the body of the ad"
              items={editing ? edited.primary_texts : primaryTexts}
              onCopy={copyToClipboard}
              selectedIndex={editing ? picked.primaryText : undefined}
              onSelect={
                editing
                  ? (i) => setPicked((p) => ({ ...p, primaryText: i }))
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) =>
                      setEdited((e) => {
                        const arr = [...e.primary_texts];
                        arr[i] = next;
                        return { ...e, primary_texts: arr };
                      })
                  : undefined
              }
            />
          )}
          {(editing ? edited.descriptions : descriptions).length > 0 && (
            <CopySection
              title="Descriptions"
              hint="Sub-headline shown under the headline"
              items={editing ? edited.descriptions : descriptions}
              onCopy={copyToClipboard}
              selectedIndex={editing ? picked.description : undefined}
              onSelect={
                editing
                  ? (i) => setPicked((p) => ({ ...p, description: i }))
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) =>
                      setEdited((e) => {
                        const arr = [...e.descriptions];
                        arr[i] = next;
                        return { ...e, descriptions: arr };
                      })
                  : undefined
              }
            />
          )}
          {(editing ? edited.ctas : ctas).length > 0 && (
            <CopySection
              title="Call-to-action"
              hint="Button label shown on the ad"
              items={editing ? edited.ctas : ctas}
              onCopy={copyToClipboard}
              selectedIndex={editing ? picked.cta : undefined}
              onSelect={
                editing
                  ? (i) => setPicked((p) => ({ ...p, cta: i }))
                  : undefined
              }
              onEdit={
                editing
                  ? (i, next) =>
                      setEdited((e) => {
                        const arr = [...e.ctas];
                        arr[i] = next;
                        return { ...e, ctas: arr };
                      })
                  : undefined
              }
            />
          )}

          {/* Fallback when there's nothing structured to show */}
          {!creative.url && !hasCopy && (
            <div className="rounded-xl bg-surface-2 p-4 text-sm text-ink-2">
              <p>
                This creative has no media uploaded and no generated copy
                attached. You can delete it and start over, or upload an image
                via <strong>Upload Creative</strong>.
              </p>
            </div>
          )}
      </div>
    </Dialog>
  );
}

function CopySection({
  title,
  hint,
  items,
  onCopy,
  selectedIndex,
  onSelect,
  onEdit,
}: {
  title: string;
  hint: string;
  items: string[];
  onCopy: (text: string) => void;
  /** When provided, the section renders in "edit / pick" mode: rows are
   *  clickable to set the default, and a pencil reveals an inline editor. */
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  onEdit?: (index: number, next: string) => void;
}) {
  const isEditMode = onSelect !== undefined && onEdit !== undefined;
  // Only one row at a time can be open for inline editing. Tracked locally
  // so the parent doesn't have to know about transient draft state.
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  function commitEdit(i: number) {
    if (!onEdit) return;
    onEdit(i, draft);
    setEditingIdx(null);
  }
  function cancelEdit() {
    setEditingIdx(null);
    setDraft("");
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
          {title}
          {isEditMode && items.length > 0 && (
            <span className="ml-1.5 text-[10px] font-medium text-ink-3">
              · {items.length} options
            </span>
          )}
        </h3>
        <span className="text-[10px] font-medium text-ink-3">{hint}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((line, i) => {
          const isSelected = isEditMode && selectedIndex === i;
          const isInlineEditing = editingIdx === i;
          return (
            <li
              key={i}
              onClick={
                isEditMode && !isInlineEditing
                  ? () => onSelect?.(i)
                  : undefined
              }
              className={clsx(
                "group flex items-start justify-between gap-3 rounded-xl border px-3 py-2 transition",
                isEditMode && !isInlineEditing && "cursor-pointer",
                isSelected
                  ? "border-brand bg-brand-soft ring-1 ring-brand/20"
                  : "border-line-2 bg-surface hover:border-line-2 hover:bg-surface-2"
              )}
            >
              {isInlineEditing ? (
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEdit(i);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="flex-1 rounded-md border border-brand/40 bg-surface px-2 py-1 text-sm leading-snug text-ink outline-none ring-2 ring-brand/15"
                />
              ) : (
                <div className="flex flex-1 items-start gap-2">
                  {isEditMode && (
                    <span
                      className={clsx(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
                        isSelected
                          ? "border-brand bg-brand text-white"
                          : "border-line-2 bg-surface"
                      )}
                      aria-hidden
                    >
                      {isSelected && (
                        <Check className="h-2.5 w-2.5" strokeWidth={4} />
                      )}
                    </span>
                  )}
                  <p className="flex-1 text-sm leading-snug text-ink">
                    {line}
                  </p>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-1">
                {isInlineEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        commitEdit(i);
                      }}
                      title="Save"
                      aria-label="Save edit"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-pos hover:bg-pos-soft"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        cancelEdit();
                      }}
                      title="Cancel"
                      aria-label="Cancel edit"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingIdx(i);
                          setDraft(line);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 opacity-0 transition group-hover:opacity-100 hover:bg-surface hover:text-brand"
                        aria-label={`Edit "${line}"`}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopy(line);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-3 opacity-0 transition group-hover:opacity-100 hover:bg-surface hover:text-ink"
                      aria-label={`Copy "${line}"`}
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
