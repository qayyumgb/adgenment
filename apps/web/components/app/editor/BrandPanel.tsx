"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus, X } from "lucide-react";
import { useApiClient, type BrandKit, type DesignImage } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useConfirm } from "@/components/app/ui";
import { ColorPicker, formatColor, parseColor } from "./ColorPicker";
import { FONTS } from "./fonts";

/**
 * The editor's Brand section (plan C19b): the design client's logos, colours
 * and fonts, saved once per client (or the workspace's shared kit) and used in
 * every design. Click a logo to place it; click a colour to apply it to the
 * selection (or the background when nothing is selected). Headings and text
 * added from the Text section use the brand fonts.
 */

const CHECKER = "conic-gradient(#e5e7eb 25%, #ffffff 0 50%, #e5e7eb 0 75%, #ffffff 0) 0 0 / 10px 10px";
const solidHex = (color: string) => formatColor({ ...parseColor(color), a: 1 });

export function BrandPanel({
  kit,
  owner,
  canEdit,
  onKit,
  onPlaceLogo,
  onApplyColor,
}: {
  kit: BrandKit | null;
  /** "Acme" or "Shared" — whose kit this is. */
  owner: string;
  canEdit: boolean;
  onKit: (k: BrandKit) => void;
  onPlaceLogo: (logo: DesignImage) => Promise<void>;
  onApplyColor: (color: string) => void;
}) {
  const api = useApiClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const clientId = kit?.clientId ?? null;

  if (!kit) return <div className="h-24 animate-pulse rounded-ctl bg-surface-2" aria-label="Loading the brand kit" />;

  const save = async (data: Parameters<typeof api.updateBrandKit>[1]) => {
    try {
      onKit(await api.updateBrandKit(clientId, data));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the brand kit.");
    }
  };

  const addColor = (color: string) => {
    const hex = solidHex(color);
    if (kit.colors.includes(hex)) return;
    if (kit.colors.length >= 12) return void toast.error("A brand kit holds up to 12 colours. Remove one first.");
    onKit({ ...kit, colors: [...kit.colors, hex] });
    void save({ colors: [...kit.colors, hex] });
  };
  const removeColor = (hex: string) => {
    const colors = kit.colors.filter((c) => c !== hex);
    onKit({ ...kit, colors });
    void save({ colors });
  };

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(0);
    try {
      onKit(await api.addBrandLogo(clientId, file, setUploading));
      toast.success("Logo added to the brand kit");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add the logo.");
    } finally {
      setUploading(null);
    }
  };
  const removeLogo = async (logo: DesignImage) => {
    if (!(await confirm({ title: "Remove this logo from the brand kit?", body: `It's removed for every ${owner === "Shared" ? "shared " : ""}design from now on. Designs that already use it keep it.`, confirmLabel: "Remove", danger: true }))) return;
    try {
      onKit(await api.removeBrandLogo(clientId, logo.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the logo.");
    }
  };
  const place = async (logo: DesignImage) => {
    setPlacing(logo.id);
    try {
      await onPlaceLogo(logo);
    } finally {
      setPlacing(null);
    }
  };

  const fontSelect = (key: "headingFont" | "bodyFont", label: string) => (
    <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-3">
      {label}
      <select
        value={kit[key] ?? ""}
        disabled={!canEdit}
        onChange={(e) => {
          const v = e.target.value || null;
          onKit({ ...kit, [key]: v });
          void save({ [key]: v });
        }}
        className="h-8 rounded-ctl border border-line-2 bg-surface px-2 text-[13px] font-normal text-ink outline-none focus:border-brand disabled:opacity-60"
        style={kit[key] ? { fontFamily: `"${kit[key]}"` } : undefined}
      >
        <option value="">Default</option>
        {(["Sans", "Display", "Serif", "Script"] as const).map((style) => (
          <optgroup key={style} label={style}>
            {FONTS.filter((f) => f.style === style).map((f) => (
              <option key={f.family} value={f.family}>
                {f.family}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );

  const empty = !kit.logos.length && !kit.colors.length && !kit.headingFont && !kit.bodyFont;

  return (
    <div className="flex flex-col gap-3">
      {empty && <p className="m-0 text-[11px] leading-relaxed text-ink-3">Save {owner === "Shared" ? "your" : `${owner}'s`} logo, colours and fonts once; they&apos;re here in every design.</p>}

      {/* Logos */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-ink-3">Logos · click to add</span>
        <div className="grid grid-cols-3 gap-1.5">
          {kit.logos.map((l) => (
            <div key={l.id} className="group relative">
              <button
                type="button"
                title="Add to the design"
                onClick={() => void place(l)}
                disabled={!canEdit || placing !== null}
                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border border-line p-1.5 hover:border-brand disabled:opacity-60"
                style={{ background: CHECKER }}
              >
                {placing === l.id ? (
                  <Loader2 size={16} className="animate-spin text-ink-2" aria-label="Adding" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.url} alt="Brand logo" loading="lazy" className="max-h-full max-w-full object-contain" />
                )}
              </button>
              {canEdit && (
                <button type="button" aria-label="Remove logo from the brand kit" title="Remove from the brand kit" onClick={() => void removeLogo(l)} className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-sm hover:text-neg group-hover:flex focus:flex">
                  <X size={11} />
                </button>
              )}
            </div>
          ))}
          {canEdit && kit.logos.length < 6 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading !== null}
              className="flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-md border border-dashed border-line-2 text-[11px] text-ink-2 hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {uploading !== null ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  {Math.round(uploading * 100)}%
                </>
              ) : (
                <>
                  <Plus size={15} aria-hidden="true" />
                  Logo
                </>
              )}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={(e) => { void uploadLogo(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      {/* Colours */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-ink-3">Colours · click to apply</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {kit.colors.map((hex) => (
            <span key={hex} className="group relative">
              <button type="button" title={`${hex} · apply to the selection (or the background)`} aria-label={`Apply ${hex}`} onClick={() => onApplyColor(hex)} disabled={!canEdit} className="h-7 w-7 rounded-full border border-line-2 hover:scale-110 disabled:opacity-60" style={{ background: hex }} />
              {canEdit && (
                <button type="button" aria-label={`Remove ${hex} from the brand kit`} onClick={() => removeColor(hex)} className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-sm hover:text-neg group-hover:flex focus:flex">
                  <X size={9} />
                </button>
              )}
            </span>
          ))}
          {canEdit && kit.colors.length < 12 && <ColorPicker kind="add" value="#6448f2" label="Add a brand colour" onChange={(col, final) => final && addColor(col)} />}
        </div>
      </div>

      {/* Fonts */}
      <div className={cn("grid grid-cols-2 gap-2")}>
        {fontSelect("headingFont", "Heading font")}
        {fontSelect("bodyFont", "Text font")}
      </div>
      {dialog}
    </div>
  );
}
