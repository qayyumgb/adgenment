"use client";

import { useEffect, useState } from "react";
import { Circle, FabricImage, StaticCanvas, Textbox, util } from "fabric";
import { EXTRA_PROPS } from "@/components/app/editor/canvas";
import { addFontStylesheet, loadFont } from "@/components/app/editor/fonts";
import { makeFrame } from "@/components/app/editor/frames";
import { makeShape } from "@/components/app/editor/shapes";
import { TEMPLATES, fontsFor, paletteFor } from "@/components/app/editor/templates";
import { renderTemplate } from "@/components/app/editor/templateRender";
import { resizeDesign } from "@/components/app/editor/resize";

/** Dev-only: real canvas output of templates and one-click resize (square → landscape, Story). */

type Row = { title: string; images: { label: string; url: string }[] };
const SQ = { W: 1080, H: 1080 };
const TARGETS = [
  { label: "Landscape", W: 1200, H: 628 },
  { label: "Story", W: 1080, H: 1920 },
];

async function photo(): Promise<string> {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1000;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 1600, 1000);
  gr.addColorStop(0, "#f97316");
  gr.addColorStop(1, "#0f766e");
  g.fillStyle = gr;
  g.fillRect(0, 0, 1600, 1000);
  g.fillStyle = "rgba(255,255,255,.85)";
  g.beginPath();
  g.arc(800, 500, 220, 0, Math.PI * 2);
  g.fill();
  return c.toDataURL("image/png");
}

async function square(build: (c: StaticCanvas) => Promise<void>) {
  const c = new StaticCanvas(undefined, { width: SQ.W, height: SQ.H, enableRetinaScaling: false, renderOnAddRemove: false });
  await build(c);
  c.renderAll();
  const json = c.toObject(EXTRA_PROPS) as Record<string, unknown>;
  const url = c.toDataURL({ format: "png", multiplier: 0.3, enableRetinaScaling: false });
  void c.dispose();
  return { json, url };
}

export default function DevResize() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    addFontStylesheet();
    void (async () => {
      try {
        const kit = { clientId: null, colors: ["#0f766e", "#1f2937", "#f97316"], headingFont: null, bodyFont: null, logos: [], updatedAt: null };
        const out: Row[] = [];
        for (const id of ["big-sale", "flash-sale", "testimonial", "free-quote"]) {
          const tpl = TEMPLATES.find((t) => t.id === id)!;
          const sq = await square(async (c) => {
            await renderTemplate(c, tpl.build("square"), { W: SQ.W, H: SQ.H, pal: paletteFor(kit), fonts: fontsFor(tpl, kit), logo: null, tplId: tpl.id });
            // An edit the resize must carry over: the first heading's wording.
            const h = c.getObjects().find((o) => (o as unknown as { name?: string }).name === "Heading") as Textbox | undefined;
            if (h) h.set({ text: id === "big-sale" ? "WINTER SALE" : h.text });
          });
          const images = [{ label: "Square (original)", url: sq.url }];
          for (const t of TARGETS) {
            const r = await resizeDesign(sq.json, SQ, { W: t.W, H: t.H }, kit);
            images.push({ label: t.label, url: URL.createObjectURL(r.preview) });
          }
          out.push({ title: `${tpl.name} (template)`, images });
        }
        // A hand-made design: background photo, heading top-left, full-width band, button, a circle near the right edge, a frame.
        const src = await photo();
        await loadFont("Poppins", 800);
        const free = await square(async (c) => {
          const bg = await FabricImage.fromURL(src);
          bg.set({ left: 540, top: 540, scaleX: 1080 / 1000, scaleY: 1080 / 1000, name: "Background" } as never);
          c.add(bg);
          c.add(new Textbox("Hand-made headline", { left: 60 + 350, top: 120, width: 700, fontSize: 80, fontWeight: 800, fontFamily: "Poppins", fill: "#ffffff", textAlign: "left" }));
          const band = makeShape("rect", 1080, 260, { fill: "#111827" });
          band.set({ left: 540, top: 950 });
          c.add(band);
          c.add(new Textbox("Bottom band text", { left: 540, top: 950, width: 900, fontSize: 56, fontFamily: "Poppins", fontWeight: 800, fill: "#ffffff", textAlign: "center" }));
          c.add(new Circle({ radius: 70, fill: "#facc15", left: 960, top: 140 }));
          const fr = makeFrame("rounded", 360, 300);
          fr.set({ left: 760, top: 560 });
          c.add(fr);
        });
        const images = [{ label: "Square (original)", url: free.url }];
        for (const t of TARGETS) {
          const r = await resizeDesign(free.json, SQ, { W: t.W, H: t.H }, null);
          images.push({ label: t.label, url: URL.createObjectURL(r.preview) });
        }
        out.push({ title: "Hand-made design (repositioned)", images });
        setRows(out);
      } catch (e) {
        setErr(e instanceof Error ? `${e.message}\n${e.stack}` : String(e));
      }
    })();
    void util;
  }, []);
  if (err) return <pre className="whitespace-pre-wrap p-6 text-xs text-neg">{err}</pre>;
  if (!rows.length) return <p className="p-6 text-sm text-ink-2">Rendering…</p>;
  return (
    <div className="flex flex-col gap-6 p-6">
      {rows.map((r) => (
        <section key={r.title} className="flex flex-col gap-2">
          <h2 className="m-0 text-sm font-semibold">{r.title}</h2>
          <div className="flex items-start gap-4">
            {r.images.map((im) => (
              <figure key={im.label} className="m-0 flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.url} alt={im.label} className="rounded-lg border border-line" style={{ height: 220 }} />
                <figcaption className="text-xs text-ink-2">{im.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
