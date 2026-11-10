/**
 * Ad templates for the creative editor (plan C19b). Each template is a plain
 * description (no Fabric objects), laid out for all three ad sizes, so the
 * same data draws the gallery preview (TemplatePreview) and the real, fully
 * editable canvas objects (applyTemplate). Colours are roles resolved from the
 * client's brand kit, fonts come from the kit when it has them, and the logo
 * slot takes the kit's first logo.
 *
 * Units: boxes are fractions of the ad's width / height (top-left corner);
 * text sizes and gaps are fractions of the ad's shorter side.
 */

import type { BrandKit } from "@/lib/api";
import type { ShapeKind } from "./shapes";

export type Aspect = "square" | "landscape" | "portrait";
export const aspectOf = (w: number, h: number): Aspect => (w === h ? "square" : w > h ? "landscape" : "portrait");

export type Role = "primary" | "secondary" | "accent" | "soft" | "light" | "dark" | "onPrimary" | "onSecondary" | "onAccent" | "onDark" | "onSoft" | "onLight";
export type Paint = Role | `#${string}`;
export type Palette = Record<Role, string>;

export type Box = { x: number; y: number; w: number; h: number };
export type StackItem =
  | { t: "text"; text: string; size: number; weight: number; font: "heading" | "body"; color: Paint; lineHeight?: number; spacing?: number; name?: string }
  | { t: "button"; text: string; size: number; bg: Paint; fg: Paint; name?: string };
export type TEl =
  | { t: "bg"; color: Paint }
  | { t: "shape"; shape: ShapeKind; box: Box; color: Paint; opacity?: number; pill?: boolean; name?: string }
  | { t: "frame"; shape: ShapeKind; box: Box }
  | { t: "logo"; box: Box; align?: "left" | "center" | "right" }
  | { t: "stack"; box: Box; align: "left" | "center"; valign: "top" | "center"; gap: number; items: StackItem[] };

export type Category = "Sale" | "Product" | "Event" | "Testimonial" | "Lead" | "Announcement";
export const CATEGORIES: Category[] = ["Sale", "Product", "Event", "Testimonial", "Lead", "Announcement"];
export type Template = { id: string; name: string; category: Category; fonts: { heading: string; body: string }; build: (a: Aspect) => TEl[] };

/* ── colours ───────────────────────────────────────────────────────────── */

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: string, b: string, t: number) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const DARK = "#16141f";
const LIGHT = "#ffffff";
/** Text colour that reads on `bg` (WCAG contrast against near-black vs white). */
export const readableOn = (bg: string) => ((luminance(bg) + 0.05) / (luminance(DARK) + 0.05) >= (1.05 / (luminance(bg) + 0.05)) ? DARK : LIGHT);

export function paletteFor(kit: BrandKit | null): Palette {
  const c = (kit?.colors ?? []).filter((x) => /^#[0-9a-f]{6}$/i.test(x));
  const primary = c[0] ?? "#6448f2";
  const secondary = c[1] ?? DARK;
  const accent = c[2] ?? (c.length ? mix(primary, "#ffb020", 0.75) : "#ffb020");
  const soft = mix(primary, LIGHT, 0.9);
  return {
    primary,
    secondary,
    accent,
    soft,
    light: LIGHT,
    dark: DARK,
    onPrimary: readableOn(primary),
    onSecondary: readableOn(secondary),
    onAccent: readableOn(accent),
    onDark: LIGHT,
    onSoft: DARK,
    onLight: DARK,
  };
}
export const paint = (p: Palette, v: Paint) => (v.startsWith("#") ? v : p[v as Role]);

/* ── layouts ───────────────────────────────────────────────────────────── */

const by = <T,>(a: Aspect, square: T, landscape: T, portrait: T) => (a === "square" ? square : a === "landscape" ? landscape : portrait);
type Content = StackItem[];
const LOGO_TOP: Record<Aspect, Box> = { square: { x: 0.36, y: 0.045, w: 0.28, h: 0.08 }, landscape: { x: 0.04, y: 0.07, w: 0.17, h: 0.12 }, portrait: { x: 0.33, y: 0.04, w: 0.34, h: 0.06 } };

/** Text centred on a colour (or soft) background; optional decoration shapes behind. */
function centered(a: Aspect, bg: Paint, items: Content, opts: { align?: "left" | "center"; deco?: TEl[] } = {}): TEl[] {
  const align = opts.align ?? "center";
  const left = align === "left";
  return [
    { t: "bg", color: bg },
    ...(opts.deco ?? []),
    { t: "logo", box: left ? by(a, { x: 0.08, y: 0.07, w: 0.24, h: 0.08 }, { x: 0.06, y: 0.08, w: 0.16, h: 0.12 }, { x: 0.08, y: 0.05, w: 0.3, h: 0.055 }) : LOGO_TOP[a], align: left ? "left" : "center" },
    { t: "stack", box: by(a, { x: 0.08, y: 0.17, w: 0.84, h: 0.76 }, left ? { x: 0.06, y: 0.24, w: 0.62, h: 0.68 } : { x: 0.08, y: 0.2, w: 0.84, h: 0.72 }, { x: 0.08, y: 0.14, w: 0.84, h: 0.78 }), align, valign: "center", gap: 0.035, items },
  ];
}

/** A photo on one half, text on a colour panel on the other. */
function photoSplit(a: Aspect, panel: Paint, items: Content, photo = by(a, 0.55, 0.5, 0.56)): TEl[] {
  return [
    { t: "bg", color: panel },
    { t: "frame", shape: "rect", box: a === "landscape" ? { x: 0, y: 0, w: photo, h: 1 } : { x: 0, y: 0, w: 1, h: photo } },
    { t: "logo", box: by(a, { x: 0.04, y: 0.035, w: 0.2, h: 0.07 }, { x: 0.55, y: 0.07, w: 0.16, h: 0.12 }, { x: 0.05, y: 0.025, w: 0.26, h: 0.05 }), align: "left" },
    { t: "stack", box: a === "landscape" ? { x: photo + 0.05, y: 0.22, w: 0.95 - photo - 0.05, h: 0.7 } : { x: 0.07, y: photo + 0.035, w: 0.86, h: 1 - photo - 0.065 }, align: a === "landscape" ? "left" : "center", valign: "center", gap: 0.03, items },
  ];
}

/** A full-bleed photo with a colour band carrying the text. */
function photoBand(a: Aspect, band: Paint, items: Content): TEl[] {
  return [
    { t: "bg", color: band },
    { t: "frame", shape: "rect", box: { x: 0, y: 0, w: 1, h: 1 } },
    { t: "shape", shape: "rect", box: by(a, { x: 0, y: 0.58, w: 1, h: 0.42 }, { x: 0, y: 0, w: 0.46, h: 1 }, { x: 0, y: 0.64, w: 1, h: 0.36 }), color: band, name: "Band" },
    { t: "logo", box: by(a, { x: 0.05, y: 0.045, w: 0.22, h: 0.08 }, { x: 0.04, y: 0.8, w: 0.15, h: 0.12 }, { x: 0.06, y: 0.035, w: 0.28, h: 0.055 }), align: "left" },
    { t: "stack", box: by(a, { x: 0.06, y: 0.6, w: 0.88, h: 0.38 }, { x: 0.05, y: 0.08, w: 0.37, h: 0.68 }, { x: 0.07, y: 0.66, w: 0.86, h: 0.32 }), align: a === "landscape" ? "left" : "center", valign: "center", gap: 0.028, items },
  ];
}

/** A photo in a shape (card) with text below / beside it; optional round badge on the photo. */
function photoCard(a: Aspect, bg: Paint, shape: ShapeKind, items: Content, badge?: { color: Paint; lines: StackItem[] }): TEl[] {
  const narrow = shape === "circle" || shape === "arch";
  const frame = by<Box>(a, narrow ? { x: 0.26, y: 0.12, w: 0.48, h: 0.48 } : { x: 0.1, y: 0.13, w: 0.8, h: 0.47 }, { x: 0.05, y: 0.1, w: 0.42, h: 0.8 }, narrow ? { x: 0.2, y: 0.1, w: 0.6, h: 0.48 } : { x: 0.08, y: 0.11, w: 0.84, h: 0.48 });
  const badgeBox = by<Box>(a, { x: 0.65, y: 0.33, w: 0.26, h: 0.26 }, { x: 0.36, y: 0.58, w: 0.2, h: 0.38 }, { x: 0.62, y: 0.4, w: 0.3, h: 0.17 });
  return [
    { t: "bg", color: bg },
    { t: "frame", shape, box: frame },
    ...(badge
      ? ([
          { t: "shape", shape: "circle", box: badgeBox, color: badge.color, name: "Badge" },
          { t: "stack", box: badgeBox, align: "center", valign: "center", gap: 0, items: badge.lines },
        ] as TEl[])
      : []),
    { t: "logo", box: by(a, { x: 0.36, y: 0.025, w: 0.28, h: 0.08 }, { x: 0.55, y: 0.08, w: 0.16, h: 0.12 }, { x: 0.33, y: 0.03, w: 0.34, h: 0.055 }), align: a === "landscape" ? "left" : "center" },
    { t: "stack", box: by(a, { x: 0.08, y: 0.63, w: 0.84, h: 0.34 }, { x: 0.55, y: 0.24, w: 0.4, h: 0.68 }, { x: 0.08, y: 0.63, w: 0.84, h: 0.33 }), align: a === "landscape" ? "left" : "center", valign: "center", gap: 0.03, items },
  ];
}

/** A customer quote with a round photo. */
function quote(a: Aspect, bg: Paint, items: Content): TEl[] {
  return [
    { t: "bg", color: bg },
    { t: "frame", shape: "circle", box: by(a, { x: 0.39, y: 0.08, w: 0.22, h: 0.22 }, { x: 0.06, y: 0.24, w: 0.27, h: 0.52 }, { x: 0.33, y: 0.15, w: 0.34, h: 0.19 }) },
    { t: "stack", box: by(a, { x: 0.09, y: 0.35, w: 0.82, h: 0.5 }, { x: 0.39, y: 0.1, w: 0.55, h: 0.72 }, { x: 0.09, y: 0.38, w: 0.82, h: 0.48 }), align: a === "landscape" ? "left" : "center", valign: a === "landscape" ? "center" : "top", gap: 0.03, items },
    { t: "logo", box: by(a, { x: 0.38, y: 0.89, w: 0.24, h: 0.07 }, { x: 0.39, y: 0.82, w: 0.15, h: 0.11 }, { x: 0.35, y: 0.91, w: 0.3, h: 0.05 }), align: a === "landscape" ? "left" : "center" },
  ];
}

/* ── content helpers ───────────────────────────────────────────────────── */

const H = (text: string, size: number, color: Paint, weight = 800, lineHeight = 1.05): StackItem => ({ t: "text", text, size, weight, font: "heading", color, lineHeight, name: "Heading" });
const T = (text: string, size: number, color: Paint, weight = 400, lineHeight = 1.3): StackItem => ({ t: "text", text, size, weight, font: "body", color, lineHeight, name: "Text" });
const EYEBROW = (text: string, color: Paint): StackItem => ({ t: "text", text, size: 0.036, weight: 700, font: "body", color, lineHeight: 1.2, spacing: 180, name: "Eyebrow" });
const BTN = (text: string, bg: Paint, fg: Paint, size = 0.042): StackItem => ({ t: "button", text, size, bg, fg, name: "Button" });
const glow = (a: Aspect, color: Paint): TEl[] => [
  { t: "shape", shape: "circle", box: by(a, { x: -0.2, y: -0.2, w: 0.6, h: 0.6 }, { x: -0.1, y: -0.35, w: 0.35, h: 0.7 }, { x: -0.25, y: -0.1, w: 0.7, h: 0.4 }), color, opacity: 0.1, name: "Decoration" },
  { t: "shape", shape: "circle", box: by(a, { x: 0.65, y: 0.68, w: 0.55, h: 0.55 }, { x: 0.78, y: 0.55, w: 0.32, h: 0.62 }, { x: 0.6, y: 0.78, w: 0.65, h: 0.37 }), color, opacity: 0.1, name: "Decoration" },
];

/* ── the templates ─────────────────────────────────────────────────────── */

export const TEMPLATES: Template[] = [
  // Sale
  { id: "big-sale", name: "Big sale", category: "Sale", fonts: { heading: "Anton", body: "Inter" }, build: (a) => centered(a, "primary", [H(a === "landscape" ? "SUMMER SALE" : "SUMMER\nSALE", by(a, 0.2, 0.17, 0.22), "onPrimary", 800, 0.95), T("Up to 50% off everything", 0.055, "onPrimary", 600), BTN("Shop now", "light", "primary", 0.045)], { deco: glow(a, "#ffffff") }) },
  { id: "flash-sale", name: "Flash sale on photo", category: "Sale", fonts: { heading: "Bebas Neue", body: "Inter" }, build: (a) => photoBand(a, "primary", [EYEBROW("FLASH SALE", "onPrimary"), H("40% off today only", by(a, 0.1, 0.1, 0.11), "onPrimary", 800, 1), BTN("Shop the sale", "accent", "onAccent")]) },
  { id: "percent-off", name: "Discount badge", category: "Sale", fonts: { heading: "Montserrat", body: "Inter" }, build: (a) => photoCard(a, "soft", "rounded", [H("Our biggest discount yet", by(a, 0.075, 0.08, 0.08), "onSoft"), T("Use code SAVE30 at checkout", 0.042, "onSoft"), BTN("Shop now", "primary", "onPrimary")], { color: "accent", lines: [H("30%", by(a, 0.085, 0.08, 0.09), "onAccent", 800, 1), T("OFF", 0.04, "onAccent", 700, 1)] }) },
  { id: "last-chance", name: "Last chance", category: "Sale", fonts: { heading: "Archivo Black", body: "Inter" }, build: (a) => centered(a, "dark", [EYEBROW("LAST CHANCE", "accent"), H("Sale ends tonight", by(a, 0.13, 0.12, 0.14), "onDark", 800, 1), T("Prices go back up at midnight.", 0.048, "#c9c6d6"), BTN("Shop before it ends", "primary", "onPrimary")], { deco: glow(a, "primary") }) },
  { id: "free-delivery", name: "Free delivery", category: "Sale", fonts: { heading: "Poppins", body: "Inter" }, build: (a) => centered(a, "secondary", [EYEBROW("LIMITED TIME", "accent"), H("Free delivery", by(a, 0.13, 0.13, 0.14), "onSecondary"), T("On every order over $50", 0.05, "onSecondary"), BTN("Start shopping", "accent", "onAccent")], { deco: glow(a, "accent") }) },

  // Product
  { id: "product-spotlight", name: "Product spotlight", category: "Product", fonts: { heading: "Playfair Display", body: "Inter" }, build: (a) => photoCard(a, "soft", "rounded", [H("The Everyday Tote", by(a, 0.08, 0.085, 0.085), "onSoft", 700, 1.1), T("Handmade · 100% cotton", 0.04, "onSoft"), H("$49", 0.07, "primary", 700, 1), BTN("Buy now", "primary", "onPrimary")]) },
  { id: "new-arrival", name: "New arrival", category: "Product", fonts: { heading: "DM Serif Display", body: "DM Sans" }, build: (a) => photoCard(a, "dark", "arch", [EYEBROW("NEW ARRIVAL", "accent"), H("Meet the new collection", by(a, 0.08, 0.085, 0.09), "onDark", 700, 1.1), BTN("Explore now", "light", "dark")]) },
  { id: "split-classic", name: "Photo and colour", category: "Product", fonts: { heading: "Poppins", body: "Inter" }, build: (a) => photoSplit(a, "primary", [H("Fresh every morning", by(a, 0.08, 0.085, 0.09), "onPrimary"), T("Order ahead and skip the line.", 0.044, "onPrimary"), BTN("Order now", "light", "primary")]) },

  // Event
  { id: "grand-opening", name: "Grand opening", category: "Event", fonts: { heading: "Oswald", body: "Inter" }, build: (a) => photoSplit(a, "secondary", [EYEBROW("SAT 14 DEC · 7 PM", "accent"), H("Grand opening night", by(a, 0.085, 0.09, 0.095), "onSecondary", 700, 1.05), T("Live music, free tastings and giveaways.", 0.042, "onSecondary"), BTN("Save your spot", "primary", "onPrimary")]) },
  { id: "save-the-date", name: "Save the date", category: "Event", fonts: { heading: "Montserrat", body: "Inter" }, build: (a) => centered(a, "primary", [EYEBROW("SAVE THE DATE", "onPrimary"), H("Summer Street Market", by(a, 0.11, 0.11, 0.12), "onPrimary", 800, 1.05), T("12–14 July · Riverside Park", 0.05, "onPrimary", 600), BTN("Get free tickets", "accent", "onAccent")], { deco: glow(a, "#ffffff") }) },

  // Testimonial
  { id: "testimonial", name: "Customer quote", category: "Testimonial", fonts: { heading: "Playfair Display", body: "Inter" }, build: (a) => quote(a, "soft", [T("★★★★★", 0.05, "accent", 400, 1), H("“Best decision we made this year. Fast, friendly and the results speak for themselves.”", by(a, 0.058, 0.06, 0.062), "onSoft", 700, 1.25), T("Sarah K. · Verified customer", 0.038, "primary", 600)]) },
  { id: "testimonial-dark", name: "Quote on dark", category: "Testimonial", fonts: { heading: "DM Serif Display", body: "DM Sans" }, build: (a) => quote(a, "dark", [T("★★★★★", 0.05, "accent", 400, 1), H("“I recommend them to everyone I know.”", by(a, 0.075, 0.075, 0.08), "onDark", 700, 1.2), T("James R. · Customer since 2022", 0.038, "#c9c6d6", 600)]) },

  // Lead
  { id: "free-guide", name: "Free guide", category: "Lead", fonts: { heading: "Poppins", body: "Inter" }, build: (a) => photoCard(a, "primary", "circle", [EYEBROW("FREE GUIDE", "onPrimary"), H("7 ways to double your leads", by(a, 0.075, 0.08, 0.085), "onPrimary"), BTN("Download free", "light", "primary")]) },
  { id: "free-quote", name: "Free quote checklist", category: "Lead", fonts: { heading: "Montserrat", body: "Inter" }, build: (a) => photoSplit(a, "light", [H("Get a free quote today", by(a, 0.075, 0.08, 0.085), "onLight"), T("✓ Licensed & insured\n✓ Same-week service\n✓ 5-star rated", 0.042, "onLight", 500, 1.5), BTN("Book now", "primary", "onPrimary")], by(a, 0.42, 0.5, 0.46)) },

  // Announcement
  { id: "announcement", name: "Announcement", category: "Announcement", fonts: { heading: "Poppins", body: "Inter" }, build: (a) => centered(a, "accent", [EYEBROW("GOOD NEWS", "onAccent"), H("We're now open late", by(a, 0.12, 0.12, 0.13), "onAccent"), T("Monday to Saturday until 10 PM", 0.05, "onAccent", 600)]) },
  { id: "minimal", name: "Minimal headline", category: "Announcement", fonts: { heading: "DM Serif Display", body: "DM Sans" }, build: (a) => centered(a, "light", [H("Simple. Honest. Good.", by(a, 0.11, 0.11, 0.12), "onLight", 700, 1.1), T("Everything we make starts with real ingredients and real people.", 0.045, "#595669"), BTN("Learn more", "primary", "onPrimary")], { align: "left" }) },
  { id: "hiring", name: "We're hiring", category: "Announcement", fonts: { heading: "Archivo Black", body: "Inter" }, build: (a) => photoBand(a, "dark", [EYEBROW("WE'RE HIRING", "accent"), H("Join our team", by(a, 0.1, 0.1, 0.11), "onDark", 800, 1), T("Front of house · Barista · Kitchen", 0.042, "#c9c6d6"), BTN("Apply now", "primary", "onPrimary")]) },
];

/** Fonts a template needs (after the kit's fonts are applied). */
export function fontsFor(tpl: Template, kit: BrandKit | null) {
  return { heading: kit?.headingFont ?? tpl.fonts.heading, body: kit?.bodyFont ?? tpl.fonts.body };
}
