"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import toast from "react-hot-toast";
import { Upload, Image as ImageIcon, Film, Layers, Copy, X, Loader2, Check } from "lucide-react";
import { useApiClient } from "@/lib/api";
import { Button, Dialog } from "@/components/app/ui";
import { CarouselCardsEditor } from "./CarouselCardsEditor";
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, cardId, classifyOrientation, emptyCard, readVideoMetadata, type CarouselCardDraft, type UploadTab, type VideoOrientation } from "./media";


export function UploadDialog({
  open,
  onClose,
  onSaved,
  clientId = null,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Client in scope; new creatives belong to it (null = shared). */
  clientId?: string | null;
}) {
  const api = useApiClient();
  const [tab, setTab] = useState<UploadTab>("device");
  const [name, setName] = useState("");
  const [type, setType] = useState<"IMAGE" | "VIDEO" | "CAROUSEL">("IMAGE");
  // Carousel state — 2-10 cards, each with one image + optional headline/
  // description/link. Cards start with a single placeholder so the user
  // sees the shape; "Add card" pushes more until 10.
  const [cards, setCards] = useState<CarouselCardDraft[]>(() => [
    emptyCard(),
    emptyCard(),
  ]);
  // URL-paste mode
  const [url, setUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);
  // File-pick mode
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // Shared
  const [submitting, setSubmitting] = useState(false);
  // Video upload progress / Meta transcode polling state — only set during
  // a video submit. `phase` drives the spinner copy so users understand
  // *why* we're still spinning ("Uploading…" vs "Meta is processing…").
  const [uploadPct, setUploadPct] = useState(0);
  const [phase, setPhase] = useState<"upload" | "processing" | null>(null);
  // Probed dimensions of the picked video — used for the orientation badge
  // (so the user sees "Vertical · 9:16" vs "Horizontal · 16:9" before they
  // commit). Re-probed every time `file` changes.
  const [videoMeta, setVideoMeta] = useState<{
    width: number;
    height: number;
    duration: number;
    orientation: VideoOrientation;
  } | null>(null);

  // Reset state every time the modal opens so a previous in-flight submit
  // doesn't leak through.
  useEffect(() => {
    if (open) {
      setTab("device");
      setName("");
      setType("IMAGE");
      setUrl("");
      setFile(null);
      setFilePreviewUrl(null);
      setSubmitting(false);
      setPreviewError(false);
      setIsDragging(false);
      setUploadPct(0);
      setPhase(null);
      setVideoMeta(null);
      setCards([emptyCard(), emptyCard()]);
    }
  }, [open]);

  // Object-URL lifecycle for carousel card previews. When a card's File
  // changes (picked, replaced, removed), we revoke the old object URL and
  // create a fresh one. Cleanup runs on modal close via the cards reset.
  useEffect(() => {
    return () => {
      cards.forEach((c) => {
        if (c.filePreviewUrl) URL.revokeObjectURL(c.filePreviewUrl);
      });
    };
    // We only want cleanup-on-unmount semantics — the per-card preview URL
    // is created at pick time and revoked at remove time, not in this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Revoke the object URL when the picked file changes or the modal closes —
  // otherwise we leak browser memory on each pick.
  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(file);
    setFilePreviewUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [file]);

  // Probe video metadata as soon as a file is picked (only for VIDEO type).
  // The result hydrates the orientation badge in the upload card so users
  // can sanity-check aspect ratio *before* a 30-second Meta upload.
  useEffect(() => {
    if (!file || type !== "VIDEO") {
      setVideoMeta(null);
      return;
    }
    let cancelled = false;
    void readVideoMetadata(file).then((m) => {
      if (cancelled || !m) return;
      setVideoMeta({
        ...m,
        orientation: classifyOrientation(m.width, m.height),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [file, type]);

  // Clear the picked file when the user flips IMAGE ↔ VIDEO so we never end
  // up with a JPEG selected while the type says VIDEO (and vice-versa).
  useEffect(() => {
    setFile(null);
  }, [type]);

  // Lightweight client-side URL validity check. We only care that the string
  // looks like an HTTPS URL — actual reachability is the user's problem (and
  // the platform's, when this creative gets attached to an ad).
  const looksLikeUrl =
    url.startsWith("https://") &&
    url.length > "https://".length &&
    !url.includes(" ");

  // Detect video-hosting page URLs (YouTube, Vimeo, TikTok, etc.) so we can
  // refuse them up-front with a clear message. None of these expose a
  // direct media file at the page URL — they serve an HTML player — so
  // both <video src> and Meta's /advideos endpoint will fail. The user
  // either uploads from device or pastes a direct .mp4/.mov/.webm URL.
  const hostedVideoPagePattern =
    /(?:youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|dailymotion\.com|twitch\.tv|facebook\.com\/watch|instagram\.com\/reel)/i;
  const isHostedVideoPage =
    type === "VIDEO" && tab === "url" && hostedVideoPagePattern.test(url);

  // Live validation of the pasted URL — kicks off a probe whenever the URL
  // changes (debounced). For video we mount a hidden <video preload=metadata>
  // and wait for `loadedmetadata` (ok) or `error` (broken). For image we
  // do the same with an Image() object. Drives the inline status pill and
  // gates the submit button — a probed-broken URL can't be saved.
  type UrlStatus = "idle" | "validating" | "ok" | "error";
  const [urlStatus, setUrlStatus] = useState<UrlStatus>("idle");
  useEffect(() => {
    if (tab !== "url" || !looksLikeUrl || isHostedVideoPage) {
      setUrlStatus("idle");
      return;
    }
    setUrlStatus("validating");
    let cancelled = false;
    const debounce = setTimeout(() => {
      if (type === "VIDEO") {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.muted = true;
        probe.crossOrigin = "anonymous";
        probe.onloadedmetadata = () => {
          if (cancelled) return;
          // Sanity check: a real video has non-zero dimensions. Some HTML
          // pages served as application/octet-stream load enough bytes
          // for `loadedmetadata` to fire on a malformed stream.
          if (probe.videoWidth > 0 && probe.videoHeight > 0) {
            setUrlStatus("ok");
          } else {
            setUrlStatus("error");
          }
        };
        probe.onerror = () => {
          if (!cancelled) setUrlStatus("error");
        };
        probe.src = url;
      } else {
        const probe = new Image();
        probe.onload = () => {
          if (cancelled) return;
          if (probe.naturalWidth > 0 && probe.naturalHeight > 0) {
            setUrlStatus("ok");
          } else {
            setUrlStatus("error");
          }
        };
        probe.onerror = () => {
          if (!cancelled) setUrlStatus("error");
        };
        probe.src = url;
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [url, type, tab, looksLikeUrl, isHostedVideoPage]);

  function handlePickFile(picked: File | null) {
    if (!picked) {
      setFile(null);
      return;
    }
    if (type === "IMAGE") {
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
    } else {
      if (!picked.type.startsWith("video/")) {
        toast.error("Pick a video file (MP4, MOV, or WebM)");
        return;
      }
      if (picked.size > MAX_VIDEO_BYTES) {
        toast.error(
          `Video is ${(picked.size / 1024 / 1024).toFixed(0)} MB — we cap device uploads at 200 MB. Host it yourself and use Paste URL instead.`
        );
        return;
      }
    }
    setFile(picked);
    // Auto-name from filename if the user hasn't typed one yet.
    if (!name.trim()) {
      const stem = picked.name.replace(/\.[^.]+$/, "");
      setName(stem.slice(0, 120));
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    handlePickFile(dropped);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      toast.error("Give your creative a name");
      return;
    }

    setSubmitting(true);
    try {
      // The shape we persist on the Creative row varies by asset type:
      //   - IMAGE: { url } — a hosted URL the publish wizard re-uploads to
      //     Meta on publish (image_hash is account-scoped so we don't cache).
      //   - VIDEO: { url, videoId, thumbnailUrl } — videoId is Meta's
      //     handle (account-scoped); the publish wizard uses it directly
      //     and skips re-upload. `url` is kept for the in-app preview.
      let content: Record<string, unknown>;

      if (type === "IMAGE") {
        if (tab === "device") {
          if (!file) {
            toast.error("Pick a file to upload");
            setSubmitting(false);
            return;
          }
          setPhase("upload");
          const result = await api.uploadMetaImage(file);
          // The hash lets publishing reuse the upload instead of re-sending it.
          content = { url: result.url, imageUrl: result.url, imageHash: result.hash };
        } else {
          if (!looksLikeUrl) {
            toast.error("Paste a public HTTPS URL to the asset");
            setSubmitting(false);
            return;
          }
          content = { url: url.trim() };
        }
      } else if (type === "CAROUSEL") {
        // CAROUSEL — for each card, upload its image to Meta's /adimages
        // and stash the hosted URL. We require a file per card (paste-URL
        // per card is deferred polish). Sequential uploads to stay on the
        // safe side of Meta's per-account rate limits.
        if (cards.length < 2) {
          toast.error("A carousel needs at least 2 cards");
          setSubmitting(false);
          return;
        }
        const missing = cards.findIndex(
          (c) => !c.file && !c.savedImageUrl
        );
        if (missing !== -1) {
          toast.error(`Pick an image for card ${missing + 1}`);
          setSubmitting(false);
          return;
        }
        setPhase("upload");
        const uploadedCards: Array<Record<string, unknown>> = [];
        for (const c of cards) {
          // Either a fresh file (upload it) or a saved card (preserve the
          // existing url + hash so we don't re-upload unchanged images).
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
          uploadedCards.push({
            url,
            imageUrl: url,
            ...(hash ? { imageHash: hash } : {}),
            headline: c.headline.trim() || undefined,
            description: c.description.trim() || undefined,
            link: c.link.trim() || undefined,
          });
        }
        // Persist the cards array. `url` on the top-level content is the
        // first card's image — used as the library card preview thumbnail.
        content = {
          url: (uploadedCards[0]?.url as string) ?? undefined,
          cards: uploadedCards,
        };
      } else {
        // VIDEO path — two flavors: device upload (file → /upload-video,
        // then poll transcode) and URL paste (defer upload to publish time
        // since we don't have Meta context at this point in the URL flow
        // we could trigger it server-side, but keeping it simple: pasted
        // URLs get re-uploaded when the user hits Publish).
        if (tab === "device") {
          if (!file) {
            toast.error("Pick a video to upload");
            setSubmitting(false);
            return;
          }
          // Probe the video locally for width/height before we ship the
          // bytes. Cheap (~1ms after the metadata atom arrives), and lets
          // us save the orientation server-side so the publish wizard can
          // later warn if placements + aspect ratio mismatch.
          const meta = await readVideoMetadata(file);
          setPhase("upload");
          setUploadPct(0);
          const uploaded = await api.uploadMetaVideo(file, {
            onProgress: (pct) => setUploadPct(pct),
          });
          // Poll for Meta's transcode to finish. Short videos take ~10-30s,
          // longer/4K can take a few minutes — we cap waiting at ~3 min.
          setPhase("processing");
          let thumbnailUrl: string | null = null;
          const startedAt = Date.now();
          const maxMs = 3 * 60 * 1000;
          while (true) {
            const probe = await api.getMetaVideoStatus(uploaded.id);
            if (probe.status === "ready") {
              thumbnailUrl = probe.thumbnailUrl;
              break;
            }
            if (probe.status === "error") {
              throw new Error("Meta failed to transcode this video");
            }
            if (Date.now() - startedAt > maxMs) {
              throw new Error(
                "Video is still processing on Meta — try again in a minute or use a smaller file"
              );
            }
            await new Promise((r) => setTimeout(r, 3000));
          }
          // Persistence note: we cannot store `filePreviewUrl` (blob: URL)
          // — those die when the page reloads. Meta's /advideos upload
          // doesn't give us a public streaming URL either, only the
          // `video_id` (used at publish time) and a thumbnail. So the
          // in-app preview becomes the thumbnail. The actual video is only
          // streamed when Meta serves the ad.
          content = {
            url: thumbnailUrl ?? undefined,
            videoId: uploaded.id,
            thumbnailUrl: thumbnailUrl ?? undefined,
            ...(meta
              ? {
                  videoWidth: meta.width,
                  videoHeight: meta.height,
                  videoDurationSec: Math.round(meta.duration),
                  videoOrientation: classifyOrientation(
                    meta.width,
                    meta.height
                  ),
                }
              : {}),
          };
        } else {
          if (!looksLikeUrl) {
            toast.error("Paste a public HTTPS URL to the video");
            setSubmitting(false);
            return;
          }
          // For URL paste we just save the URL — the publish wizard will
          // upload it to Meta + poll status at publish time.
          content = { url: url.trim() };
        }
      }

      await api.createCreative({
        name: name.trim(),
        type,
        content,
        aiGenerated: false,
        clientId,
      });
      toast.success("Creative added to your library");
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      // Most common upload failure path: no Meta ad account connected. Give
      // a useful nudge instead of the raw API error.
      if (msg.toLowerCase().includes("no meta") || msg.toLowerCase().includes("ad account")) {
        toast.error(
          "Connect a Meta ad account first (Settings → Integrations), then try again — or use Paste URL instead"
        );
      } else {
        toast.error(msg);
      }
      setSubmitting(false);
      setPhase(null);
    }
  }

  return (
    <Dialog
      open={open}
      // Locked while uploading / transcoding: closing would orphan the upload.
      onClose={submitting ? () => {} : onClose}
      title="Upload creative"
      sub="An image, video or carousel, from your device or a public link"
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="creative-upload-form"
            loading={submitting}
            icon={submitting ? undefined : <Upload size={16} strokeWidth={2.5} />}
            disabled={
              submitting ||
              !name.trim() ||
              (type === "CAROUSEL"
                ? cards.length < 2 ||
                  cards.some((c) => !c.file && !c.savedImageUrl)
                : tab === "url"
                  ? !looksLikeUrl ||
                    isHostedVideoPage ||
                    urlStatus === "validating" ||
                    urlStatus === "error"
                  : !file)
            }
          >
            {submitting ? (tab === "device" ? "Uploading…" : "Saving…") : "Add to library"}
          </Button>
        </>
      }
    >
      <form id="creative-upload-form" onSubmit={handleSubmit} className="space-y-5">
          {/* Type */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-2">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setType("IMAGE")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                  type === "IMAGE"
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line-2 bg-surface text-ink hover:border-line-2"
                )}
              >
                <ImageIcon className="h-4 w-4" />
                Image
              </button>
              <button
                type="button"
                onClick={() => setType("VIDEO")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                  type === "VIDEO"
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line-2 bg-surface text-ink hover:border-line-2"
                )}
              >
                <Film className="h-4 w-4" />
                Video
              </button>
              <button
                type="button"
                onClick={() => setType("CAROUSEL")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                  type === "CAROUSEL"
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line-2 bg-surface text-ink hover:border-line-2"
                )}
              >
                <Layers className="h-4 w-4" />
                Carousel
              </button>
            </div>
          </div>

          {/* Source tabs — hidden for CAROUSEL (device upload only at MVP) */}
          {type !== "CAROUSEL" && <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-2">
                Source
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTab("device")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  tab === "device"
                    ? "border-ink-3 bg-ink text-white"
                    : "border-line-2 bg-surface text-ink hover:border-line-2"
                )}
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={2.5} />
                Upload from device
              </button>
              <button
                type="button"
                onClick={() => setTab("url")}
                className={clsx(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                  tab === "url"
                    ? "border-ink-3 bg-ink text-white"
                    : "border-line-2 bg-surface text-ink hover:border-line-2"
                )}
              >
                <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />
                Paste URL
              </button>
            </div>
          </div>}

          {/* Name */}
          <div>
            <label
              htmlFor="creative-name"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-2"
            >
              Name
            </label>
            <input
              id="creative-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer sale hero — 1200x628"
              maxLength={120}
              className="h-10 w-full rounded-xl border border-line-2 bg-surface px-3 text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none"
            />
          </div>

          {/* Source body — device picker OR URL input — hidden for CAROUSEL */}
          {type !== "CAROUSEL" && (tab === "device" ? (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-2">
                {type === "VIDEO" ? "Video file" : "Image file"}
              </label>
              {file && filePreviewUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-line-2 bg-surface p-2">
                  {type === "VIDEO" ? (
                    <video
                      src={filePreviewUrl}
                      className="h-16 w-16 shrink-0 rounded-lg bg-ink object-cover"
                      preload="metadata"
                      muted
                    />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={filePreviewUrl}
                      alt={file.name}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover bg-ink"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-semibold text-ink">
                      {file.name}
                    </div>
                    <div className="text-[10px] text-ink-2">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                    </div>
                    {type === "VIDEO" && videoMeta && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <span
                          className={clsx(
                            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                            videoMeta.orientation === "vertical"
                              ? "bg-purple-100 text-purple-800"
                              : videoMeta.orientation === "square"
                                ? "bg-warn-soft text-warn"
                                : "bg-sky-100 text-sky-800"
                          )}
                        >
                          {videoMeta.orientation === "vertical"
                            ? "Vertical · 9:16"
                            : videoMeta.orientation === "square"
                              ? "Square · 1:1"
                              : "Horizontal · 16:9"}
                        </span>
                        <span className="text-[10px] text-ink-3">
                          {videoMeta.width}×{videoMeta.height} ·{" "}
                          {Math.round(videoMeta.duration)}s
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    disabled={submitting}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="creative-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={clsx(
                    "flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-surface transition",
                    isDragging
                      ? "border-brand bg-brand-soft"
                      : "border-line-2 hover:border-ink-3 hover:bg-surface-2"
                  )}
                >
                  <Upload className="h-5 w-5 text-ink-3" strokeWidth={1.75} />
                  <div className="text-sm font-semibold text-ink">
                    Drag &amp; drop or click to pick
                  </div>
                  <div className="text-[11px] text-ink-2">
                    {type === "VIDEO"
                      ? "MP4 / MOV / WebM · max 200 MB"
                      : "JPEG / PNG / WebP / GIF · max 8 MB"}
                  </div>
                  <input
                    id="creative-file"
                    type="file"
                    accept={
                      type === "VIDEO"
                        ? ACCEPTED_VIDEO_TYPES
                        : ACCEPTED_IMAGE_TYPES
                    }
                    onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
              )}

              {/* Submit-time status — only meaningful for video (image upload
                  is fast enough to skip the meter). */}
              {submitting && type === "VIDEO" && phase && (
                <div className="mt-3 rounded-xl border border-line-2 bg-surface-2 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                    {phase === "upload"
                      ? `Uploading to Meta… ${uploadPct}%`
                      : "Meta is processing the video (transcoding)…"}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={clsx(
                        "h-full rounded-full bg-brand transition-all",
                        phase === "processing" && "animate-pulse"
                      )}
                      style={{
                        width:
                          phase === "upload"
                            ? `${uploadPct}%`
                            : "100%",
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[10px] text-ink-2">
                    Short clips usually take 10–30s. Don&apos;t close this dialog.
                  </p>
                </div>
              )}
              <p className="mt-1.5 text-[11px] text-ink-2">
                Uploaded to Meta&apos;s CDN and stored against your connected ad
                account. Meta hosts the file — we just keep the reference.
              </p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="creative-url"
                className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-2"
              >
                {type === "VIDEO" ? "Video URL" : "Image URL"}
              </label>
              <input
                id="creative-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setPreviewError(false);
                }}
                placeholder={
                  type === "VIDEO"
                    ? "https://your-cdn.com/clip.mp4"
                    : "https://example.com/asset.jpg"
                }
                className="h-10 w-full rounded-xl border border-line-2 bg-surface px-3 text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-ink-2">
                {type === "VIDEO" ? (
                  <>
                    Must be a <strong>direct video file URL</strong> ending
                    in .mp4, .mov, or .webm — hosted on your CDN, S3,
                    Cloudflare R2, etc. YouTube / Vimeo / TikTok page links
                    won&apos;t work (they serve a web player, not a
                    downloadable video).
                  </>
                ) : (
                  <>
                    Must be publicly reachable over HTTPS. Imgur, Cloudinary,
                    your CDN, or a Meta-hosted image URL all work.
                  </>
                )}
              </p>

              {/* Live URL status pill — visible whenever a syntactically
                  valid URL is being probed or has been classified. */}
              {looksLikeUrl && !isHostedVideoPage && urlStatus !== "idle" && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold">
                  {urlStatus === "validating" && (
                    <span className="inline-flex items-center gap-1.5 text-ink-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking URL…
                    </span>
                  )}
                  {urlStatus === "ok" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-pos-soft px-2 py-0.5 text-pos ring-1 ring-pos/30">
                      <Check className="h-3 w-3" strokeWidth={3} />
                      URL looks good — {type === "VIDEO" ? "video" : "image"}
                      {" loaded"}
                    </span>
                  )}
                  {urlStatus === "error" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-neg-soft px-2 py-0.5 text-neg ring-1 ring-neg/30">
                      <X className="h-3 w-3" strokeWidth={3} />
                      Can&apos;t load — not a public {type === "VIDEO" ? "video" : "image"} file
                    </span>
                  )}
                </div>
              )}

              {/* YouTube / Vimeo / TikTok detection — fail fast with a
                  clear message instead of letting <video src> silently
                  flop into the generic "Could not load preview". */}
              {isHostedVideoPage && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn-soft p-3 text-[12px] leading-relaxed text-warn">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden
                  >
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  <div>
                    <strong>That&apos;s a page URL, not a video file.</strong>{" "}
                    YouTube / Vimeo / TikTok don&apos;t expose direct downloads
                    — Meta can&apos;t fetch the video from a page link.
                    <br />
                    Use <strong>Upload from device</strong> instead, or paste a
                    direct <code>.mp4</code> URL from your own CDN.
                  </div>
                </div>
              )}

              {/* Preview — skipped for known page URLs above. */}
              {looksLikeUrl && !isHostedVideoPage && (
                <div className="mt-4">
                  <div className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-2">
                    Preview
                  </div>
                  <div className="overflow-hidden rounded-xl border border-line-2 bg-ink">
                    {previewError ? (
                      <div className="flex aspect-video items-center justify-center text-xs text-ink-3">
                        Could not load preview — check the URL is public and
                        points to a direct file
                      </div>
                    ) : type === "VIDEO" ? (
                      <video
                        src={url}
                        controls
                        playsInline
                        preload="metadata"
                        onError={() => setPreviewError(true)}
                        className="aspect-video w-full bg-ink"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt="preview"
                        onError={() => setPreviewError(true)}
                        className="aspect-video w-full object-cover"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Carousel cards editor — only when type=CAROUSEL. Brief is
              piped through as the creative name so the AI image-generation
              button has some campaign context to work with. */}
          {type === "CAROUSEL" && (
            <CarouselCardsEditor
              cards={cards}
              setCards={setCards}
              disabled={submitting}
              brief={name}
            />
          )}
      </form>
    </Dialog>
  );
}