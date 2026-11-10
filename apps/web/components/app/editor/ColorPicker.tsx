"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Pipette, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Colour picker for the creative editor (plan C19a): a colour area, hue and
 * a separate **opacity** slider (the browser's own picker has no alpha), hex
 * and opacity inputs, the eyedropper where the browser has one, and quick
 * swatches. Dragging previews live (`final` false); letting go commits
 * (`final` true), so undo gets one step per change.
 */

type Hsva = { h: number; s: number; v: number; a: number };
const CHECKER = "conic-gradient(#e5e7eb 25%, #ffffff 0 50%, #e5e7eb 0 75%, #ffffff 0) 0 0 / 8px 8px";
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

function hsvToRgb({ h, s, v }: Hsva) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return { r: f(5), g: f(3), b: f(1) };
}
function rgbToHsv(r: number, g: number, b: number) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  const h = d === 0 ? 0 : max === R ? 60 * (((G - B) / d) % 6) : max === G ? 60 * ((B - R) / d + 2) : 60 * ((R - G) / d + 4);
  return { h: (h + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}
const hex2 = (n: number) => n.toString(16).padStart(2, "0");

/** Any CSS colour Fabric stores (hex 3/6/8, rgb(), rgba(), "transparent") → HSVA. */
export function parseColor(value: string | null | undefined): Hsva {
  const v = (value ?? "").trim().toLowerCase();
  if (!v || v === "transparent") return { h: 0, s: 0, v: 1, a: 0 };
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let x = m[1];
    if (x.length === 3 || x.length === 4) x = x.split("").map((c) => c + c).join("");
    const r = parseInt(x.slice(0, 2), 16);
    const g = parseInt(x.slice(2, 4), 16);
    const b = parseInt(x.slice(4, 6), 16);
    const a = x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1;
    return { ...rgbToHsv(r, g, b), a };
  }
  m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [r, g, b, a] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { ...rgbToHsv(r || 0, g || 0, b || 0), a: Number.isFinite(a) ? clamp(a) : 1 };
  }
  return { h: 0, s: 0, v: 0, a: 1 };
}

/** HSVA → what Fabric stores: hex when solid, rgba() when see-through. */
export function formatColor(c: Hsva) {
  const { r, g, b } = hsvToRgb(c);
  return c.a >= 0.995 ? `#${hex2(r)}${hex2(g)}${hex2(b)}` : `rgba(${r}, ${g}, ${b}, ${Math.round(c.a * 100) / 100})`;
}

const SWATCHES = ["#ffffff", "#111827", "#6448f2", "#0ea5e9", "#16a34a", "#f59e0b", "#ef4444", "#ec4899", "#1e3a8a", "#fde68a", "#f3f4f6", "transparent"];

/** Drag handler for the colour area and sliders (pointer capture, live + final). */
function useDrag(onMove: (x: number, y: number, final: boolean) => void) {
  return (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const at = (ev: { clientX: number; clientY: number }, final: boolean) => {
      const r = el.getBoundingClientRect();
      onMove(clamp((ev.clientX - r.left) / r.width), clamp((ev.clientY - r.top) / r.height), final);
    };
    at(e, false);
    const move = (ev: PointerEvent) => at(ev, false);
    const up = (ev: PointerEvent) => {
      at(ev, true);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
}

/** C19b: the design's brand colours, shown first in every colour picker (provided by the editor). */
export const BrandColors = createContext<string[]>([]);

/** `kind` "add": the button is a "+" (adding a brand colour) instead of a swatch of the current colour. */
export function ColorPicker({ value, onChange, label, kind = "fill", disabled }: { value: string | null | undefined; onChange: (color: string, final: boolean) => void; label: string; kind?: "fill" | "outline" | "add"; disabled?: boolean }) {
  const brand = useContext(BrandColors);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [c, setC] = useState<Hsva>(() => parseColor(value));
  const [hexText, setHexText] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Follow the layer's colour while closed (selection changes, undo).
  useEffect(() => {
    if (!open) setC(parseColor(value));
  }, [value, open]);
  useEffect(() => {
    const { r, g, b } = hsvToRgb(c);
    setHexText(`${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase());
  }, [c]);

  const emit = useCallback(
    (next: Hsva, final: boolean) => {
      setC(next);
      onChange(formatColor(next), final);
    },
    [onChange]
  );

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const W = 248;
    const H = 330;
    setPos({ left: Math.max(8, Math.min(window.innerWidth - W - 8, r.left)), top: r.bottom + H + 8 > window.innerHeight ? Math.max(8, r.top - H - 6) : r.bottom + 6 });
    setC(parseColor(value));
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (panel.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away);
      window.removeEventListener("keydown", esc, true);
    };
  }, [open]);

  const area = useDrag((x, y, final) => emit({ ...c, s: x, v: 1 - y, a: c.a || 1 }, final));
  const hue = useDrag((x, _y, final) => emit({ ...c, h: x * 360, a: c.a || 1 }, final));
  const alpha = useDrag((x, _y, final) => emit({ ...c, a: Math.round(x * 100) / 100 }, final));
  const solid = hsvToRgb({ ...c, a: 1 });
  const solidCss = `rgb(${solid.r}, ${solid.g}, ${solid.b})`;
  const current = formatColor(c);

  const pick = async () => {
    const Dropper = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!Dropper) return;
    try {
      const r = await new Dropper().open();
      emit({ ...parseColor(r.sRGBHex), a: c.a || 1 }, true);
    } catch {
      /* cancelled */
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        className={cn(
          kind === "add"
            ? "inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-line-2 text-ink-2 hover:border-brand hover:text-brand disabled:opacity-40"
            : "relative inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-2 disabled:opacity-40",
          open && kind !== "add" && "bg-surface-2",
          open && kind === "add" && "border-brand text-brand"
        )}
      >
        {kind === "add" ? (
          <Plus size={14} aria-hidden="true" />
        ) : (
          <span className="relative h-4 w-4 overflow-hidden rounded border border-line-2" style={{ background: CHECKER }}>
            {kind === "outline" ? (
              <span className="absolute inset-0 rounded-[3px] border-[3px]" style={{ borderColor: value || "transparent" }} />
            ) : (
              <span className="absolute inset-0" style={{ background: value || "transparent" }} />
            )}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <div ref={panel} role="dialog" aria-label={label} className="fixed z-[80] flex w-[248px] flex-col gap-3 rounded-menu border border-line bg-surface p-3 shadow-pop" style={{ top: pos.top, left: pos.left }}>
            {/* Saturation × brightness */}
            <div onPointerDown={area} className="relative h-[150px] cursor-crosshair touch-none rounded-lg" style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${c.h}, 100%, 50%))` }}>
              <span className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${c.s * 100}%`, top: `${(1 - c.v) * 100}%`, background: solidCss }} />
            </div>
            <div className="flex items-center gap-2.5">
              {"EyeDropper" in (typeof window !== "undefined" ? window : {}) && (
                <button type="button" onClick={() => void pick()} aria-label="Pick a colour from the screen" title="Pick from the screen" className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <Pipette size={16} />
                </button>
              )}
              <span className="h-8 w-8 flex-none overflow-hidden rounded-full border border-line-2" style={{ background: CHECKER }} aria-hidden="true">
                <span className="block h-full w-full" style={{ background: current }} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                {/* Hue */}
                <div onPointerDown={hue} className="relative h-3 cursor-pointer touch-none rounded-full" style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }} aria-label="Hue">
                  <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${(c.h / 360) * 100}%`, background: `hsl(${c.h}, 100%, 50%)` }} />
                </div>
                {/* Opacity */}
                <div onPointerDown={alpha} className="relative h-3 cursor-pointer touch-none rounded-full" style={{ background: CHECKER }} aria-label="Opacity">
                  <span className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, rgba(${solid.r}, ${solid.g}, ${solid.b}, 0), ${solidCss})` }} />
                  <span className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" style={{ left: `${c.a * 100}%`, background: current }} />
                </div>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-ink-3">
                Hex
                <span className="flex h-8 items-center rounded-ctl border border-line-2 bg-surface px-2 focus-within:border-brand">
                  <span className="text-[13px] text-ink-3">#</span>
                  <input
                    value={hexText}
                    maxLength={6}
                    onChange={(e) => {
                      const t = e.target.value.replace(/[^0-9a-f]/gi, "");
                      setHexText(t.toUpperCase());
                      if (t.length === 6) emit({ ...parseColor(`#${t}`), a: c.a || 1 }, true);
                    }}
                    className="w-full min-w-0 bg-transparent px-1 text-[13px] uppercase tabular-nums text-ink outline-none"
                    aria-label="Hex colour"
                  />
                </span>
              </label>
              <label className="flex w-[74px] flex-col gap-1 text-[11px] text-ink-3">
                Opacity
                <span className="flex h-8 items-center rounded-ctl border border-line-2 bg-surface px-2 focus-within:border-brand">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(c.a * 100)}
                    onChange={(e) => emit({ ...c, a: clamp((Number(e.target.value) || 0) / 100) }, true)}
                    className="w-full min-w-0 bg-transparent text-[13px] tabular-nums text-ink outline-none"
                    aria-label="Opacity percent"
                  />
                  <span className="text-[13px] text-ink-3">%</span>
                </span>
              </label>
            </div>
            {brand.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-ink-3">Brand</span>
                <div className="flex flex-wrap gap-1.5">
                  {brand.map((s) => (
                    <button key={s} type="button" title={s} aria-label={`Brand colour ${s}`} onClick={() => emit(parseColor(s), true)} className="h-6 w-6 rounded-full border border-line-2" style={{ background: s }} />
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {SWATCHES.map((s) => (
                <button key={s} type="button" title={s === "transparent" ? "None (transparent)" : s} aria-label={s === "transparent" ? "No colour" : `Colour ${s}`} onClick={() => emit(parseColor(s), true)} className="relative h-6 w-6 overflow-hidden rounded-full border border-line-2" style={{ background: CHECKER }}>
                  <span className="absolute inset-0" style={{ background: s }} />
                  {s === "transparent" && <span className="absolute left-1/2 top-[-2px] h-[28px] w-px origin-center -translate-x-1/2 rotate-45 bg-neg" aria-hidden="true" />}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
