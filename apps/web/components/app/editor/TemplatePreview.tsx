"use client";

import type { CSSProperties } from "react";
import { ImageIcon } from "lucide-react";
import { shapePathD } from "./shapes";
import { nearestWeight } from "./fonts";
import { paint, type Palette, type TEl } from "./templates";
import type { Anim } from "./motion";

/** The entrance keyframes the previews play (rendered once by the gallery). Each animates from its start to the element as drawn. */
export const PREVIEW_KEYFRAMES = `
@keyframes tplm-fade { from { opacity: 0 } }
@keyframes tplm-slide-up { from { opacity: 0; transform: translateY(var(--tplm-d)) } }
@keyframes tplm-slide-down { from { opacity: 0; transform: translateY(calc(var(--tplm-d) * -1)) } }
@keyframes tplm-slide-left { from { opacity: 0; transform: translateX(var(--tplm-d)) } }
@keyframes tplm-slide-right { from { opacity: 0; transform: translateX(calc(var(--tplm-d) * -1)) } }
@keyframes tplm-pop { from { opacity: 0; transform: scale(.6) } 40% { opacity: 1 } }
@keyframes tplm-zoom-in { from { opacity: 0; transform: scale(1.18) } }
@keyframes tplm-typewriter { from { clip-path: inset(0 100% 0 0) } to { clip-path: inset(0 0 0 0) } }
`;

/**
 * A template drawn with HTML / SVG from the same description the canvas uses
 * (templates.ts), so the gallery shows what you get: brand colours, fonts and
 * logo included. Sizes use container units, so any card width works.
 */
export function TemplatePreview({ els, W, H, pal, fonts, logoUrl, motion, play }: { els: TEl[]; W: number; H: number; pal: Palette; fonts: { heading: string; body: string }; logoUrl: string | null; /** C20a: the template's animation (templateMotion), played while `play` is true. */ motion?: Map<string, Anim>; play?: boolean }) {
  const S = Math.min(W, H);
  /** A length in design pixels → container-width units. */
  const u = (px: number) => `${(px / W) * 100}cqw`;
  const pos = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({ position: "absolute", left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
  const bg = els.find((e) => e.t === "bg");
  /** The entrance of one part, as a CSS animation (an approximation of the real video: same kind, start and length). */
  const mo = (key: string): CSSProperties => {
    const a = play ? motion?.get(key) : undefined;
    if (!a || !a.in || a.in === "none") return {};
    return { animation: `tplm-${a.in} ${a.dur ?? 0.6}s ${a.in === "pop" ? "cubic-bezier(.34,1.56,.64,1)" : a.in === "typewriter" ? "linear" : "cubic-bezier(.22,1,.36,1)"} ${a.at ?? 0}s both` };
  };

  return (
    <div className="relative w-full overflow-hidden [container-type:inline-size]" style={{ aspectRatio: `${W} / ${H}`, background: bg && bg.t === "bg" ? paint(pal, bg.color) : "#fff", ["--tplm-d" as string]: u(S * 0.09) }} aria-hidden="true">
      {els.map((el, i) => {
        if (el.t === "bg") return null;
        if (el.t === "shape" || el.t === "frame") {
          const w = el.box.w * W;
          const h = el.box.h * H;
          return (
            <div key={i} style={{ ...pos(el.box), opacity: el.t === "shape" ? el.opacity ?? 1 : 1 }}>
              <div className="h-full w-full" style={mo(`${i}|0|${el.t}`)}>
              <svg viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} className="h-full w-full overflow-visible">
                <path d={shapePathD(el.shape, w, h)} fill={el.t === "frame" ? "#d9d6e3" : paint(pal, el.color)} />
              </svg>
              {el.t === "frame" && (
                <span className="absolute inset-0 flex items-center justify-center text-[#9a96ab]">
                  <ImageIcon style={{ width: u(S * 0.08), height: u(S * 0.08) }} strokeWidth={1.6} />
                </span>
              )}
              </div>
            </div>
          );
        }
        if (el.t === "logo") {
          if (!logoUrl) return null;
          return (
            <div key={i} style={{ ...pos(el.box), display: "flex", alignItems: "center", justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" style={mo(`${i}|0|logo`)} />
            </div>
          );
        }
        return (
          <div key={i} style={{ ...pos(el.box), display: "flex", flexDirection: "column", justifyContent: el.valign === "center" ? "safe center" : "flex-start", alignItems: el.align === "center" ? "center" : "flex-start", gap: u(el.gap * S), textAlign: el.align }}>
            {el.items.map((it, j) => {
              const family = it.t === "button" ? fonts.body : it.font === "heading" ? fonts.heading : fonts.body;
              const px = it.size * S;
              if (it.t === "button") {
                return (
                  <span key={j} style={{ fontFamily: `"${family}"`, fontWeight: nearestWeight(family, 700), fontSize: u(px), lineHeight: 1, padding: `${u(px * 0.62)} ${u(px * 1.35)}`, borderRadius: 9999, background: paint(pal, it.bg), color: paint(pal, it.fg), whiteSpace: "nowrap", ...mo(`${i}|${j}|button`) }}>
                    {it.text}
                  </span>
                );
              }
              return (
                <span key={j} style={{ display: "block", width: "100%", fontFamily: `"${family}"`, fontWeight: nearestWeight(family, it.weight), fontSize: u(px), lineHeight: it.lineHeight ?? 1.2, letterSpacing: it.spacing ? `${it.spacing / 1000}em` : undefined, color: paint(pal, it.color), whiteSpace: "pre-line", ...mo(`${i}|${j}|text`) }}>
                  {it.text}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
