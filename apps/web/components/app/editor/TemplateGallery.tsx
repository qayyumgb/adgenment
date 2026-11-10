"use client";

import { useMemo, useState } from "react";
import type { BrandKit } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Dialog, Segmented } from "@/components/app/ui";
import { CATEGORIES, TEMPLATES, aspectOf, fontsFor, paletteFor, type Category, type Template } from "./templates";
import { TemplatePreview } from "./TemplatePreview";

/**
 * Pick a template (plan C19b). Previews use the design's size and the
 * client's brand kit, so what you click is what lands on the canvas.
 */
export function TemplateGallery({ open, onClose, W, H, kit, owner, onPick }: { open: boolean; onClose: () => void; W: number; H: number; kit: BrandKit | null; owner: string; onPick: (t: Template) => void }) {
  const [cat, setCat] = useState<"All" | Category>("All");
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
      sub={branded ? `Shown with ${owner === "Shared" ? "your" : `${owner}'s`} brand colours, fonts and logo. Everything stays editable.` : "Add brand colours, fonts and a logo in the Brand section, and every template uses them. Everything stays editable."}
      width={1000}
    >
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <Segmented<"All" | Category> label="Category" value={cat} onChange={setCat} options={[{ value: "All", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />
        </div>
        <div className={cn("grid max-h-[62vh] gap-3 overflow-y-auto pr-1", cols)}>
          {list.map((t) => (
            <button key={t.id} type="button" onClick={() => onPick(t)} className="group flex flex-col gap-1.5 text-left" title={`Use “${t.name}”`}>
              <span className="block overflow-hidden rounded-xl border border-line shadow-sm transition group-hover:border-brand group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-brand">
                <TemplatePreview els={t.build(aspect)} W={W} H={H} pal={pal} fonts={fontsFor(t, kit)} logoUrl={logoUrl} />
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
