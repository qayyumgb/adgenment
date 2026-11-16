"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import toast from "react-hot-toast";
import { Download, Pause, Play, Sparkles, Trash2, X } from "lucide-react";
import type { VideoRender } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Button, Dialog, IconButton } from "@/components/app/ui";
import { layerName } from "./canvas";
import { DEFAULT_IN_DUR, DEFAULT_OUT_DUR, HOLD_LABELS, IN_LABELS, MAX_DURATION, MIN_DURATION, OUT_LABELS, cleanAnim, type Anim, type MotionHold, type MotionIn, type MotionOut } from "./motion";
import type { AnimObj, MotionPreview } from "./motionPreview";

/**
 * Video ads in the editor (plan C20a): the timeline under the canvas (play,
 * scrub, video length, when each layer comes and goes, Make video), the
 * Animation section for the selected layer, and the finished video's dialog.
 *
 * Everything here is marked `data-video-ui`: the editor leaves a running
 * preview alone while the pointer is in these parts, and ends it (putting
 * the design back as it was) as soon as anything else is touched.
 */

const field = "h-8 rounded-ctl border border-line-2 bg-surface px-2 text-[13px] text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-soft disabled:opacity-60";
const LENGTHS = [5, 6, 8, 10, 12, 15, 20, 30];
const LABEL_W = 136;

const clock = (t: number) => `0:${String(Math.floor(t)).padStart(2, "0")}.${Math.floor((t % 1) * 10)}`;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export type TimelineHandle = {
  /** Play from `from` to `to` seconds (default: the whole video), then put the design back. */
  play: (from?: number, to?: number) => void;
  toggle: () => void;
};

type TimelineProps = {
  getPreview: () => MotionPreview | null;
  W: number;
  H: number;
  duration: number;
  /** Top layer first. */
  layers: AnimObj[];
  selected: AnimObj | null;
  canEdit: boolean;
  onDuration: (seconds: number) => void;
  onSelect: (o: AnimObj) => void;
  /** `final` false while dragging: one undo step when it's let go. */
  onAnim: (o: AnimObj, patch: Partial<Anim>, final: boolean) => void;
  onAuto: () => void;
  onClear: () => void;
  onClose: () => void;
  video: VideoRender | null;
  stale: boolean;
  making: boolean;
  onMake: () => void;
  onWatch: () => void;
};

export const Timeline = forwardRef<TimelineHandle, TimelineProps>(function Timeline({ getPreview, W, H, duration, layers, selected, canEdit, onDuration, onSelect, onAnim, onAuto, onClear, onClose, video, stale, making, onMake, onWatch }, ref) {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [on, setOn] = useState(false);
  const raf = useRef(0);
  const live = useRef({ W, H, duration });
  live.current = { W, H, duration };

  const stopLoop = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
  };
  /** The preview, following it: when the editor ends it (a click on the canvas, a save, undo) the playhead goes home. */
  const attach = () => {
    const p = getPreview();
    if (!p) return null;
    p.onChange = (active) => {
      setOn(active);
      if (!active) {
        stopLoop();
        setPlaying(false);
        setT(0);
      }
    };
    if (!p.active) p.enter(live.current.W, live.current.H, live.current.duration);
    return p;
  };

  const play = (from = 0, to = live.current.duration) => {
    const p = attach();
    if (!p) return;
    stopLoop();
    const start = performance.now() - from * 1000;
    setPlaying(true);
    const tick = (now: number) => {
      const at = (now - start) / 1000;
      if (at >= to) return p.exit();
      p.draw(at);
      setT(at);
      raf.current = requestAnimationFrame(tick);
    };
    p.draw(from);
    setT(from);
    raf.current = requestAnimationFrame(tick);
  };
  const pause = () => {
    stopLoop();
    setPlaying(false);
  };
  const seek = (at: number) => {
    const p = attach();
    if (!p) return;
    pause();
    p.draw(at);
    setT(at);
  };
  const toggle = () => (playing ? pause() : play(on && t < duration - 0.05 ? t : 0));
  useImperativeHandle(ref, () => ({ play, toggle }));

  useEffect(
    () => () => {
      stopLoop();
      const p = getPreview();
      if (p) {
        p.exit();
        p.onChange = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on unmount only
    []
  );

  /** Drag along a track: the time under the pointer, to a tenth of a second. */
  const dragTime = (e: ReactPointerEvent<HTMLElement>, track: HTMLElement, fn: (at: number, final: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const rect = track.getBoundingClientRect();
    const at = (x: number) => Math.round(clamp01((x - rect.left) / rect.width) * duration * 10) / 10;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => fn(at(ev.clientX), false);
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      fn(at(ev.clientX), true);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    fn(at(e.clientX), false);
  };

  const shown = layers.filter((o) => o.visible !== false);
  const tickEvery = duration <= 10 ? 1 : duration <= 20 ? 2 : 5;
  const ticks = Array.from({ length: Math.floor(duration / tickEvery) + 1 }, (_, i) => i * tickEvery);
  const rendering = making || video?.status === "queued" || video?.status === "rendering";
  const pct = video && (video.status === "queued" || video.status === "rendering") ? video.progress : 0;
  const ready = video?.status === "done" && Boolean(video.videoUrl);
  const animated = shown.some((o) => cleanAnim(o.anim, duration));

  return (
    <div data-video-ui className="flex-none border-t border-line bg-surface" aria-label="Video timeline">
      <div className="flex h-11 items-center gap-2 border-b border-line px-3">
        <IconButton label={playing ? "Pause (Space)" : "Play the video (Space)"} size={32} onClick={toggle} disabled={!shown.length} className="bg-brand-soft text-brand-ink hover:bg-brand-soft-2">
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </IconButton>
        <span className="w-[86px] text-xs tabular-nums text-ink-2" aria-live="off">
          {clock(t)} / {clock(duration)}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-ink-3">
          Length
          <select value={duration} onChange={(e) => onDuration(Number(e.target.value))} disabled={!canEdit} aria-label="Video length" className={cn(field, "h-7 text-xs")}>
            {[...new Set([...LENGTHS, duration])].filter((s) => s >= MIN_DURATION && s <= MAX_DURATION).sort((a, b) => a - b).map((s) => (
              <option key={s} value={s}>
                {s} seconds
              </option>
            ))}
          </select>
        </label>
        {canEdit && (
          <>
            <Button variant="ghost" size="sm" icon={<Sparkles size={14} />} onClick={onAuto} disabled={!shown.length} title="Give every layer a fitting animation, one after another">
              Animate for me
            </Button>
            {animated && (
              <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={onClear} title="Take the animation off every layer">
                Remove all
              </Button>
            )}
          </>
        )}
        <span className="min-w-0 flex-1" />
        {rendering ? (
          <span role="status" className="flex items-center gap-2 text-xs font-medium text-ink-2">
            <span className="h-1.5 w-[110px] overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
              <span className={cn("block h-full rounded-full bg-brand transition-[width] duration-500", pct < 3 && "animate-pulse")} style={{ width: `${Math.max(6, pct)}%` }} />
            </span>
            {video?.status === "rendering" ? `Making your video… ${pct}%` : "Starting…"}
          </span>
        ) : (
          <>
            {video?.status === "failed" && <span className="text-xs text-neg">The last video didn&apos;t finish</span>}
            {ready && (
              <Button variant="ghost" size="sm" onClick={onWatch} title={stale ? "Made before your latest changes" : undefined}>
                Watch video{stale ? " (older)" : ""}
              </Button>
            )}
            {canEdit && (
              <Button variant="primary" size="sm" onClick={onMake} disabled={!shown.length}>
                {ready && stale ? "Update video" : ready ? "Make again" : "Make video"}
              </Button>
            )}
          </>
        )}
        <IconButton label="Close the timeline" size={32} onClick={onClose}>
          <X size={15} />
        </IconButton>
      </div>

      <div className="max-h-[156px] overflow-y-auto px-3 pb-2 [scrollbar-width:thin]">
        {shown.length === 0 ? (
          <p className="m-0 py-3 text-xs text-ink-3">Add text, an image or a shape, then choose how each one comes in.</p>
        ) : (
          <div className="relative">
            {/* Ruler: click or drag to look at any moment */}
            <div className="sticky top-0 z-10 flex h-6 items-end bg-surface">
              <span className="flex-none text-[11px] text-ink-3" style={{ width: LABEL_W }}>
                {on && !playing ? "Click the design to edit" : ""}
              </span>
              <div
                className="relative h-full flex-1 cursor-pointer touch-none border-b border-line"
                onPointerDown={(e) => dragTime(e, e.currentTarget, (at) => seek(Math.min(at, duration - 1 / 30)))}
                role="slider"
                aria-label="Moment in the video"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={Math.round(t * 10) / 10}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  e.stopPropagation();
                  seek(Math.min(duration - 1 / 30, Math.max(0, t + (e.key === "ArrowLeft" ? -0.1 : 0.1))));
                }}
              >
                {ticks.map((s) => (
                  <span key={s} className="pointer-events-none absolute bottom-0 flex h-full flex-col justify-end border-l border-line-2 pl-1 text-[10px] leading-[14px] tabular-nums text-ink-3" style={{ left: `${(s / duration) * 100}%` }}>
                    {s < duration ? `${s}s` : ""}
                  </span>
                ))}
              </div>
            </div>

            {shown.map((o, i) => {
              const a = cleanAnim(o.anim, duration);
              const hasIn = Boolean(a && a.in !== "none");
              const hasOut = Boolean(a && a.out !== "none" && a.outAt != null);
              const start = hasIn ? a!.at ?? 0 : 0;
              const end = hasOut ? (a!.outAt as number) : duration;
              const span = Math.max(0.1, end - start);
              const label = a ? [hasIn ? IN_LABELS[a.in as MotionIn] : null, a.hold && a.hold !== "none" ? HOLD_LABELS[a.hold] : null, hasOut ? OUT_LABELS[a.out as MotionOut] : null].filter(Boolean).join(" · ") : "";
              return (
                <div key={i} className={cn("flex h-7 items-center rounded-md", selected === o && "bg-brand-soft")}>
                  <button type="button" onClick={() => onSelect(o)} className="flex-none truncate pr-2 text-left text-xs text-ink hover:text-brand-ink" style={{ width: LABEL_W }} title="Select this layer">
                    {layerName(o)}
                  </button>
                  <div data-track className="relative h-[18px] flex-1 rounded bg-surface-2" onClick={() => onSelect(o)}>
                    {a ? (
                      <div className="absolute inset-y-0 overflow-hidden rounded border border-brand/40 bg-brand-soft-2" style={{ left: `${(start / duration) * 100}%`, width: `${(span / duration) * 100}%` }}>
                        {hasIn && <span className="absolute inset-y-0 left-0 bg-brand/55" style={{ width: `${Math.min(100, ((a!.dur ?? DEFAULT_IN_DUR) / span) * 100)}%` }} aria-hidden="true" />}
                        {hasOut && <span className="absolute inset-y-0 right-0 bg-brand/55" style={{ width: `${Math.min(100, ((a!.outDur ?? DEFAULT_OUT_DUR) / span) * 100)}%` }} aria-hidden="true" />}
                        <span className="pointer-events-none relative block truncate px-1.5 text-[10px] font-medium leading-[16px] text-brand-ink">{label}</span>
                      </div>
                    ) : (
                      <span className="pointer-events-none absolute inset-0 truncate px-1.5 text-[10px] leading-[18px] text-ink-3">On screen the whole time</span>
                    )}
                    {canEdit && hasIn && (
                      <span
                        role="slider"
                        aria-label={`When ${layerName(o)} comes in`}
                        aria-valuemin={0}
                        aria-valuemax={duration}
                        aria-valuenow={start}
                        title="Drag: when it comes in"
                        className="absolute inset-y-[-3px] w-[9px] -translate-x-1/2 cursor-ew-resize touch-none rounded-sm border border-brand bg-surface shadow-sm"
                        style={{ left: `${(start / duration) * 100}%` }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => dragTime(e, e.currentTarget.parentElement as HTMLElement, (at, final) => onAnim(o, { at: Math.min(at, end - 0.2) }, final))}
                      />
                    )}
                    {canEdit && hasOut && (
                      <span
                        role="slider"
                        aria-label={`When ${layerName(o)} is gone`}
                        aria-valuemin={0}
                        aria-valuemax={duration}
                        aria-valuenow={end}
                        title="Drag: when it's gone"
                        className="absolute inset-y-[-3px] w-[9px] -translate-x-1/2 cursor-ew-resize touch-none rounded-sm border border-brand bg-surface shadow-sm"
                        style={{ left: `${(end / duration) * 100}%` }}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => dragTime(e, e.currentTarget.parentElement as HTMLElement, (at, final) => onAnim(o, { outAt: Math.max(at, start + 0.2) }, final))}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {on && (
              <span className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-[#ec4899]" style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${clamp01(t / duration)})` }} aria-hidden="true">
                <span className="absolute -left-[4px] top-0 h-[9px] w-[9px] rounded-full bg-[#ec4899]" />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

/* ───────────────────────── Animation of the selected layer ───────────────────────── */

function Secs({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-ink-2">
      {label}
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          step={0.1}
          value={Math.round(value * 10) / 10}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className={cn(field, "h-7 w-[62px] text-xs tabular-nums")}
        />
        <span className="text-ink-3">s</span>
      </span>
    </label>
  );
}

function Pick<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
      {label}
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)} className={cn(field, "w-full")}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** How the selected layer comes in, behaves and leaves. `show` asks for a short preview of the part just changed. */
export function AnimationFields({ o, duration, canEdit, onChange, onRemove }: { o: AnimObj; duration: number; canEdit: boolean; onChange: (patch: Partial<Anim>, show?: "in" | "hold" | "out") => void; onRemove: () => void }) {
  const a = cleanAnim(o.anim, duration);
  const isText = typeof o.text === "string";
  const inn = (a?.in ?? "none") as MotionIn;
  const hold = (a?.hold ?? "none") as MotionHold;
  const out = (a?.out ?? "none") as MotionOut;
  const at = a?.at ?? 0;
  const outAt = a?.outAt ?? duration;
  return (
    <div data-video-ui className="flex flex-col gap-2.5">
      <Pick label="Comes in" value={inn} disabled={!canEdit} options={(Object.entries(IN_LABELS) as [MotionIn, string][]).filter(([k]) => k !== "typewriter" || isText)} onChange={(v) => onChange({ in: v }, "in")} />
      {inn !== "none" && (
        <>
          <Secs label="Starts at" value={at} min={0} max={Math.max(0, (out !== "none" ? outAt : duration) - 0.2)} disabled={!canEdit} onChange={(v) => onChange({ at: v })} />
          <Secs label="Takes" value={a?.dur ?? DEFAULT_IN_DUR} min={0.1} max={5} disabled={!canEdit} onChange={(v) => onChange({ dur: v }, "in")} />
        </>
      )}
      <Pick label="While on screen" value={hold} disabled={!canEdit} options={Object.entries(HOLD_LABELS) as [MotionHold, string][]} onChange={(v) => onChange({ hold: v }, "hold")} />
      <Pick label="Leaves" value={out} disabled={!canEdit} options={Object.entries(OUT_LABELS) as [MotionOut, string][]} onChange={(v) => onChange({ out: v, ...(out === "none" ? { outAt: duration } : {}) }, "out")} />
      {out !== "none" && (
        <>
          <Secs label="Gone by" value={outAt} min={Math.min(duration, at + 0.2)} max={duration} disabled={!canEdit} onChange={(v) => onChange({ outAt: v })} />
          <Secs label="Takes" value={a?.outDur ?? DEFAULT_OUT_DUR} min={0.1} max={5} disabled={!canEdit} onChange={(v) => onChange({ outDur: v }, "out")} />
        </>
      )}
      {a && canEdit && (
        <button type="button" onClick={onRemove} className="self-start text-xs font-medium text-ink-3 underline-offset-2 hover:text-ink hover:underline">
          Remove animation
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── The finished video ───────────────────────── */

export function VideoDialog({ open, onClose, video, stale, name, onSave, saving: savingToCreatives }: { open: boolean; onClose: () => void; video: VideoRender | null; stale: boolean; name: string; /** Save to Creatives as a video ad. */ onSave?: () => void; saving?: boolean }) {
  const [saving, setSaving] = useState(false);
  const url = video?.status === "done" ? video.videoUrl : null;
  const download = async () => {
    if (!url || !video) return;
    setSaving(true);
    try {
      // Fetched first: a link to another domain can't be told to download.
      const blob = await (await fetch(url)).blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${(name.trim() || "video").replace(/[^\w-]+/g, "-")}-${video.width}x${video.height}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    } catch {
      toast.error("Couldn't download the video. Try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open && Boolean(url)}
      onClose={onClose}
      title="Your video"
      sub={video ? `${video.width}×${video.height} · ${((video.durationMs ?? 0) / 1000).toFixed(0)} seconds · MP4` : undefined}
      width={video && video.height > video.width ? 440 : 640}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant={onSave ? "secondary" : "primary"} icon={<Download size={15} />} onClick={() => void download()} loading={saving}>
            Download MP4
          </Button>
          {onSave && (
            <Button variant="primary" onClick={onSave} loading={savingToCreatives}>
              Save to Creatives
            </Button>
          )}
        </>
      }
    >
      {url && (
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a silent ad: there is no speech to caption */}
          <video key={url} src={url} poster={video?.posterUrl ?? undefined} controls autoPlay loop muted playsInline className="mx-auto max-h-[58vh] max-w-full rounded-ctl bg-black" />
          {stale && <p className="m-0 text-xs text-ink-2">This video was made before your latest changes. Choose Update video on the timeline to include them.</p>}
        </div>
      )}
    </Dialog>
  );
}
