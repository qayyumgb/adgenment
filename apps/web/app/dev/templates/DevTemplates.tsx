"use client";

import { useEffect, useState } from "react";
import { addFontStylesheet } from "@/components/app/editor/fonts";
import { TemplatePreview } from "@/components/app/editor/TemplatePreview";
import { TEMPLATES, fontsFor, paletteFor } from "@/components/app/editor/templates";
import type { BrandKit } from "@/lib/api";

const SIZES = [
  { W: 1080, H: 1080, a: "square" as const },
  { W: 1200, H: 628, a: "landscape" as const },
  { W: 1080, H: 1920, a: "portrait" as const },
];
const KITS: Record<string, BrandKit | null> = {
  none: null,
  teal: { clientId: null, colors: ["#0f766e", "#1f2937", "#f97316"], headingFont: "Montserrat", bodyFont: "Inter", logos: [], updatedAt: null },
  yellow: { clientId: null, colors: ["#facc15", "#111827"], headingFont: null, bodyFont: null, logos: [], updatedAt: null },
};

export function DevTemplates() {
  const [kit, setKit] = useState("none");
  useEffect(() => {
    void addFontStylesheet();
  }, []);
  const k = KITS[kit];
  const pal = paletteFor(k);
  return (
    <div className="flex flex-col gap-6 bg-bg p-6">
      <div className="flex items-center gap-2 text-sm">
        Kit:
        {Object.keys(KITS).map((n) => (
          <button key={n} type="button" onClick={() => setKit(n)} className={`rounded border px-2 py-1 ${n === kit ? "border-brand bg-brand-soft" : "border-line"}`}>
            {n}
          </button>
        ))}
      </div>
      {TEMPLATES.map((t) => (
        <section key={t.id} className="flex flex-col gap-2">
          <h2 className="m-0 text-sm font-semibold">
            {t.name} <span className="text-ink-3">· {t.category}</span>
          </h2>
          <div className="flex items-start gap-4">
            {SIZES.map((s) => (
              <div key={s.a} style={{ width: s.a === "portrait" ? 150 : s.a === "landscape" ? 330 : 240 }} className="overflow-hidden rounded-lg border border-line">
                <TemplatePreview els={t.build(s.a)} W={s.W} H={s.H} pal={pal} fonts={fontsFor(t, k)} logoUrl={null} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
