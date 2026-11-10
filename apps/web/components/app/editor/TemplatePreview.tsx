"use client";

import type { CSSProperties } from "react";
import { ImageIcon } from "lucide-react";
import { shapePathD } from "./shapes";
import { nearestWeight } from "./fonts";
import { paint, type Palette, type TEl } from "./templates";

/**
 * A template drawn with HTML / SVG from the same description the canvas uses
 * (templates.ts), so the gallery shows what you get: brand colours, fonts and
 * logo included. Sizes use container units, so any card width works.
 */
export function TemplatePreview({ els, W, H, pal, fonts, logoUrl }: { els: TEl[]; W: number; H: number; pal: Palette; fonts: { heading: string; body: string }; logoUrl: string | null }) {
  const S = Math.min(W, H);
  /** A length in design pixels → container-width units. */
  const u = (px: number) => `${(px / W) * 100}cqw`;
  const pos = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({ position: "absolute", left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
  const bg = els.find((e) => e.t === "bg");

  return (
    <div className="relative w-full overflow-hidden [container-type:inline-size]" style={{ aspectRatio: `${W} / ${H}`, background: bg && bg.t === "bg" ? paint(pal, bg.color) : "#fff" }} aria-hidden="true">
      {els.map((el, i) => {
        if (el.t === "bg") return null;
        if (el.t === "shape" || el.t === "frame") {
          const w = el.box.w * W;
          const h = el.box.h * H;
          return (
            <div key={i} style={{ ...pos(el.box), opacity: el.t === "shape" ? el.opacity ?? 1 : 1 }}>
              <svg viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} className="h-full w-full overflow-visible">
                <path d={shapePathD(el.shape, w, h)} fill={el.t === "frame" ? "#d9d6e3" : paint(pal, el.color)} />
              </svg>
              {el.t === "frame" && (
                <span className="absolute inset-0 flex items-center justify-center text-[#9a96ab]">
                  <ImageIcon style={{ width: u(S * 0.08), height: u(S * 0.08) }} strokeWidth={1.6} />
                </span>
              )}
            </div>
          );
        }
        if (el.t === "logo") {
          if (!logoUrl) return null;
          return (
            <div key={i} style={{ ...pos(el.box), display: "flex", alignItems: "center", justifyContent: el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
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
                  <span key={j} style={{ fontFamily: `"${family}"`, fontWeight: nearestWeight(family, 700), fontSize: u(px), lineHeight: 1, padding: `${u(px * 0.62)} ${u(px * 1.35)}`, borderRadius: 9999, background: paint(pal, it.bg), color: paint(pal, it.fg), whiteSpace: "nowrap" }}>
                    {it.text}
                  </span>
                );
              }
              return (
                <span key={j} style={{ display: "block", width: "100%", fontFamily: `"${family}"`, fontWeight: nearestWeight(family, it.weight), fontSize: u(px), lineHeight: it.lineHeight ?? 1.2, letterSpacing: it.spacing ? `${it.spacing / 1000}em` : undefined, color: paint(pal, it.color), whiteSpace: "pre-line" }}>
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
