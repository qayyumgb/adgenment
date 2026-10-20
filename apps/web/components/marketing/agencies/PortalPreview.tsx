"use client";

import { useState } from "react";
import { AccentHeading, Eyebrow } from "@/components/marketing/ui/Heading";
import { SegmentedControl } from "@/components/marketing/ui/SegmentedControl";

type Show = { spend: boolean; names: boolean; notes: boolean; ai: boolean };
const CHIPS: { key: keyof Show; label: string }[] = [
  { key: "spend", label: "Show spend" },
  { key: "names", label: "Campaign names" },
  { key: "notes", label: "Internal notes" },
  { key: "ai", label: "AI summary" },
];

/** White-label client report preview with brand + visibility toggles. */
export function PortalPreview() {
  const [own, setOwn] = useState(true);
  const [show, setShow] = useState<Show>({ spend: true, names: true, notes: false, ai: true });

  const kpis = [
    { l: "Revenue", v: show.spend ? "$241,101" : "$241k", d: "↑ 14.6%" },
    { l: "ROAS", v: "4.60x", d: "↑ 0.31" },
    { l: "Purchases", v: "5,212", d: "↑ 11%" },
  ];

  return (
    <section className="px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-[clamp(32px,5vw,64px)]">
        <div className="order-1 min-w-0 flex-[1.1_1_460px] mk-lg:order-none">
          <div
            data-reveal="up"
            aria-live="polite"
            className="overflow-hidden rounded-[28px] border border-mk-hair bg-mk-paper2 shadow-[0_40px_80px_-40px_rgba(40,30,80,.35)]"
          >
            <div className="flex h-11 items-center gap-2 border-b border-mk-hair bg-mk-s2 px-4">
              <span className="h-[9px] w-[9px] rounded-full bg-mk-line2" />
              <span className="h-[9px] w-[9px] rounded-full bg-mk-line2" />
              <span className="flex-1" />
              <span className="rounded-lg bg-mk-paper2 px-2.5 py-[3px] font-mk-mono text-[11.5px] text-mk-ink3">
                {own ? "reports.haldenpike.com/lumen" : "app.advertix.io/r/lumen"}
              </span>
              <span className="flex-1" />
            </div>
            <div className="flex flex-col gap-4 p-[clamp(16px,3vw,26px)]">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white transition-colors duration-300 ${
                    own ? "bg-mk-ink" : "bg-mk-brand"
                  }`}
                >
                  {own ? "H&P" : "✦"}
                </span>
                <span className="flex flex-col leading-[1.25]">
                  <span className="font-semibold">{own ? "Halden & Pike" : "Advertix report"}</span>
                  <span className="text-[13px] text-mk-ink3">Lumen Skincare · week of 12 Oct</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {kpis.map((k) => (
                  <span key={k.l} className="flex flex-col rounded-[14px] bg-mk-s2 p-3">
                    <span className="text-xs text-mk-ink3">{k.l}</span>
                    <span className="text-[clamp(17px,2vw,22px)] font-medium tabular-nums tracking-[-0.02em]">{k.v}</span>
                    <span className="font-mk-mono text-[11.5px] text-mk-pos">{k.d}</span>
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-mk-hair px-3.5 py-2.5 text-sm">
                <span className="text-mk-ink3">Top campaign</span>
                <span className="font-semibold">{show.names ? "Founder story · TikTok Spark Ads" : "Campaign 1 · TikTok"}</span>
              </div>
              {show.ai && (
                <div className="rounded-[14px] border border-mk-hair p-3.5 text-[14.5px] leading-[1.55]">
                  <span className="font-mk-mono text-[11.5px] tracking-[.06em] text-mk-ink3">THIS WEEK, IN PLAIN ENGLISH</span>
                  <br />
                  Revenue rose 14.6% after budget moved toward TikTok creators. The morning-routine video was replaced before
                  it tired out; the new cut is your best performer.
                </div>
              )}
              {show.notes && (
                <div className="rounded-[14px] border border-dashed border-mk-line2 bg-[#fff7e8] p-3.5 text-sm">
                  <span className="font-mk-mono text-[11.5px] tracking-[.06em] text-mk-warn">INTERNAL NOTE · VISIBLE TO CLIENT</span>
                  <br />
                  Client asked to hold weekend budget changes until the holiday push starts.
                </div>
              )}
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="What the client sees">
                {CHIPS.map((c) => {
                  const on = show[c.key];
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setShow((s) => ({ ...s, [c.key]: !on }))}
                      className={`h-[30px] whitespace-nowrap rounded-full border px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-mk-brand ${
                        on ? "border-mk-brand bg-mk-soft text-mk-brand-ink" : "border-mk-line2 text-mk-ink2 hover:text-mk-ink"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-[1_1_360px] flex-col gap-3.5">
          <Eyebrow>WHITE-LABEL CLIENT PORTAL</Eyebrow>
          <AccentHeading lead="Your brand on the report." accent="Not ours." className="!text-[clamp(34px,5vw,64px)]" />
          <p data-reveal="up" className="m-0 max-w-[460px] text-mk-ink2">
            Each client gets a live link on your domain and a weekly summary your team can edit before it sends. You choose
            what they see.
          </p>
          <SegmentedControl
            label="Report branding"
            tone="paper"
            value={own ? "own" : "default"}
            onChange={(v) => setOwn(v === "own")}
            options={[
              { value: "own", label: "Your brand" },
              { value: "default", label: "Advertix default" },
            ]}
            className="self-start"
          />
        </div>
      </div>
    </section>
  );
}
