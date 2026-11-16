"use client";

import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import type { BrandKit } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Dialog, Segmented } from "@/components/app/ui";
import { CATEGORIES, TEMPLATES, aspectOf, fontsFor, paletteFor, type Category, type Template } from "./templates";
import { PREVIEW_KEYFRAMES, TemplatePreview } from "./TemplatePreview";
import { templateMotion } from "./templateMotion";

/**
 * Pick a template (plan C19b). Previews use the design's size and the
 * client's brand kit, so what you click is what lands on the canvas.
 *
 * For a video design (`video`, C20a) every template comes with its
 * animation: pointing at a card (or focusing it) plays it.
 */
export function TemplateGallery({ open, onClose, W, H, kit, owner, onPick, video = false }: { open: boolean; onClose: () => void; W: number; H: number; kit: BrandKit | null; owner: string; onPick: (t: Template) => void; video?: boolean }) {
  const [cat, setCat] = useState<"All" | Category>("All");
  const [playing, setPlaying] = useState<string | null>(null);
  const start = (id: string) => video && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && setPlaying(id);
  const aspect = aspectOf(W, H);
  const pal = useMemo(() => paletteFor(kit), [kit]);
  const list = TEMPLATES.filter((t) => cat === "All" || t.category === cat);
  const branded = Boolean(kit && (kit.colors.length || kit.logos.length || kit.headingFont || kit.bodyFont));
  const logoUrl = kit?.logos[0]?.url ?? null;
  const cols = aspect === "landscape" ? "grid-cols-2 sm:grid-cols-3" : aspect === "portrait" ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Start from a template"
      sub={video ? "Every template comes with its own animation: point at one to see it move. Everything stays editable." : branded ? `Shown with ${owner === "Shared" ? "your" : `${owner}'s`} brand colours, fonts and logo. Everything stays editable.` : "Add brand colours, fonts and a logo in the Brand section, and every template uses them. Everything stays editable."}
      width={1000}
    >
      <div className="flex flex-col gap-4">
        {video && <style>{PREVIEW_KEYFRAMES}</style>}
        <div className="overflow-x-auto">
          <Segmented<"All" | Category> label="Category" value={cat} onChange={setCat} options={[{ value: "All", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        </div>
        <div className={cn("grid max-h-[62vh] gap-3 overflow-y-auto pr-1", cols)}>
          {list.map((t) => (
            <button key={t.id} type="button" onClick={() => onPick(t)} onMouseEnter={() => start(t.id)} onMouseLeave={() => setPlaying((p) => (p === t.id ? null : p))} onFocus={() => start(t.id)} onBlur={() => setPlaying((p) => (p === t.id ? null : p))} className="group flex flex-col gap-1.5 text-left" title={`Use “${t.name}”`}>
              <span className="relative block overflow-hidden rounded-xl border border-line shadow-sm transition group-hover:border-brand group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-brand">
                <TemplatePreview els={t.build(aspect)} W={W} H={H} pal={pal} fonts={fontsFor(t, kit)} logoUrl={logoUrl} motion={video ? templateMotion(t, t.build(aspect)) : undefined} play={playing === t.id} />
                {video && (
                  <span className={cn("pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white transition-opacity", playing === t.id && "opacity-0")} aria-hidden="true">
                    <Play size={9} fill="currentColor" />
                    Animated
                  </span>
                )}
              </span>
              <span className="flex items-center justify-between gap-2 px-0.5">
                <span className="truncate text-[13px] font-medium text-ink group-hover:text-brand-ink">{t.name}</span>
                <span className="flex-none text-[11px] text-ink-3">{t.category}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
