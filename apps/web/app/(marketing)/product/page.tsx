import type { Metadata } from "next";
import { Accent, Eyebrow, HeroTitle, SectionHead } from "@/components/marketing/ui/Heading";
import { CtaBand } from "@/components/marketing/ui/CtaBand";
import { PillButton } from "@/components/marketing/ui/PillButton";
import { PlatformMark, PLATFORMS, type PlatformKey } from "@/components/marketing/ui/PlatformMark";
import { ModuleNav } from "@/components/marketing/product/ModuleNav";
import { COVERAGE, MODULES, type MarkKey, type ProductModule, type Tone } from "@/components/marketing/product/modules";
import { SIGN_UP_HREF } from "@/lib/marketing/nav";

export const metadata: Metadata = {
  title: "Product",
  description:
    "Planning, decisions, budgets, creative, alerts and reporting on one data model. Six Advertix modules for running ads across Meta, Google, TikTok, Snapchat and LinkedIn.",
};

const TRUST = [
  { v: "AES-256", t: "Encrypted tokens", b: "Every OAuth token encrypted at rest; disconnect any platform instantly." },
  { v: "7 days", t: "Undo anything", b: "Every change by a person or the AI is logged and reversible." },
  { v: "15%", t: "Daily guardrail", b: "Automatic moves stay under your limit; bigger ones wait for approval." },
  { v: "0", t: "Models trained on you", b: "Your data runs your workspace and nothing else." },
];

// Tag colours per tone: [dark panel bg, dark fg, light bg, light fg].
const TONE: Record<Tone, [string, string, string, string]> = {
  pos: ["rgba(65,211,154,.16)", "#41d39a", "#e5f4ec", "#0b7d50"],
  brand: ["rgba(185,171,255,.18)", "#c7bcff", "#efeafd", "#4428d6"],
  neg: ["rgba(255,113,117,.16)", "#ff8a8e", "#fbe9e9", "#c23a3f"],
};

const STATUS_MARKS: Record<"A" | "N" | "W" | "K", { mark: string; bg: string; fg: string; label: string }> = {
  A: { mark: "✦", bg: "#6448f2", fg: "#fff", label: "Advertix" },
  N: { mark: "!", bg: "#c23a3f", fg: "#fff", label: "Critical" },
  W: { mark: "!", bg: "#f2b44e", fg: "#15131a", label: "Warning" },
  K: { mark: "✓", bg: "#0b7d50", fg: "#fff", label: "On track" },
};

function RowMark({ k, dark }: { k: MarkKey; dark: boolean }) {
  if (k in STATUS_MARKS) {
    const s = STATUS_MARKS[k as keyof typeof STATUS_MARKS];
    return (
      <span
        role="img"
        aria-label={s.label}
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] text-[11px] font-bold"
        style={{ background: s.bg, color: s.fg }}
      >
        {s.mark}
      </span>
    );
  }
  return <PlatformMark p={k as PlatformKey} size={34} onDark={dark} />;
}

function ModuleUi({ m }: { m: ProductModule }) {
  const d = m.dark;
  const tone = TONE[m.ui.tone];
  const valueColor = (t?: "pos" | "neg") =>
    t === "pos" ? (d ? "text-mk-pos-on-dark" : "text-mk-pos") : t === "neg" ? (d ? "text-[#ff8a8e]" : "text-mk-neg") : "";
  return (
    <div
      data-reveal="up"
      className={`relative flex flex-col gap-3 overflow-hidden rounded-[28px] border p-[clamp(16px,2.6vw,26px)] ${
        d
          ? "border-mk-ink bg-mk-ink text-mk-on-dark shadow-[0_50px_100px_-50px_rgba(40,24,120,.55)]"
          : "border-mk-hair bg-mk-paper2 text-mk-ink shadow-[0_30px_60px_-40px_rgba(40,30,80,.3)]"
      }`}
    >
      <div className="relative flex flex-wrap items-center gap-2.5">
        <span className="font-semibold">{m.ui.title}</span>
        <span className="flex-1" />
        <span
          className="whitespace-nowrap rounded-full px-2.5 py-[3px] font-mk-mono text-[11.5px] tracking-[.04em]"
          style={{ background: d ? tone[0] : tone[2], color: d ? tone[1] : tone[3] }}
        >
          {m.ui.tag}
        </span>
      </div>
      {m.ui.rows.map((r) => (
        <div
          key={r.label}
          className={`relative grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-3.5 py-3 ${
            d ? "border-white/[.09] bg-white/[.05]" : "border-mk-hair bg-white"
          }`}
        >
          <RowMark k={r.mark} dark={d} />
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[14.5px] font-semibold leading-[1.3]">{r.label}</span>
            {r.sub && <span className={`text-[13px] ${d ? "text-mk-on-dark2" : "text-mk-ink2"}`}>{r.sub}</span>}
            {r.bar != null && (
              <span className={`h-[5px] overflow-hidden rounded-full ${d ? "bg-white/[.08]" : "bg-mk-s3"}`}>
                <span
                  data-reveal="grow"
                  className="block h-full rounded-full"
                  style={{
                    width: `${r.bar}%`,
                    background: r.bar > 85 ? "#ff7175" : "linear-gradient(115deg,#8a3ffc,#5d5cff 50%,#2d8cff)",
                  }}
                />
              </span>
            )}
          </span>
          <span className={`whitespace-nowrap font-mk-mono text-[12.5px] font-medium ${valueColor(r.valueTone)}`}>{r.value}</span>
        </div>
      ))}
      <div
        className={`relative rounded-[14px] px-3.5 py-3 text-sm leading-normal ${
          d ? "bg-[linear-gradient(135deg,rgba(138,63,252,.3),rgba(45,140,255,.16))]" : "bg-mk-soft"
        }`}
      >
        <span className={`font-mk-mono text-[11.5px] tracking-[.06em] ${d ? "text-[#d9d2ff]" : "text-mk-brand-ink"}`}>
          ✦ ADVERTIX ·
        </span>{" "}
        {m.ui.note}
      </div>
    </div>
  );
}

const COVERAGE_LABEL = { F: "Full support", H: "Partial, platform limits apply", N: "Not offered by the platform" } as const;

function Dot({ v }: { v: "F" | "H" | "N" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-3 rounded-full border-2 ${
        v === "F" ? "border-mk-ink bg-mk-ink" : v === "H" ? "border-mk-ink bg-mk-paper2" : "border-mk-ink3"
      }`}
    />
  );
}

export default function ProductPage() {
  return (
    <>
      <section className="border-b-2 border-mk-rule px-[clamp(16px,4vw,32px)] pb-[clamp(36px,5vw,56px)] pt-[clamp(48px,8vw,104px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(28px,4vw,48px)]">
          <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-6">
            <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-[18px]">
              <Eyebrow>THE PRODUCT · SIX MODULES · ONE DATA MODEL</Eyebrow>
              <HeroTitle line1="Everything ads need." line2="One workspace." />
            </div>
            <p data-reveal="up" className="m-0 max-w-[420px] flex-[1_1_320px] text-[clamp(16px,1.6vw,18px)] text-mk-ink2">
              Planning, decisions, budgets, creative, alerts and reporting share one data model, so a suggestion at
              08:00, a slider in Budgets and a line in the client report always agree.
            </p>
          </div>
          <nav aria-label="Module index" className="grid grid-cols-2 border-t-2 border-mk-rule mk-sm:grid-cols-3 mk-xl:grid-cols-6">
            {MODULES.map((m, i) => (
              <a
                key={m.id}
                href={`#${m.id}`}
                data-reveal="rise"
                className="flex flex-col gap-1.5 border-b border-mk-hair py-[18px] pr-4 text-mk-ink transition-colors hover:text-mk-brand-ink"
              >
                <span className="font-mk-mono text-xs text-mk-ink3">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-lg font-medium tracking-[-0.02em]">{m.name}</span>
                <span className="text-[13.5px] text-mk-ink2">
                  {m.lead} {m.accent}
                </span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="px-[clamp(16px,4vw,32px)] py-[clamp(56px,8vw,104px)]">
        <div className="mx-auto flex max-w-[1280px] items-start gap-[clamp(28px,5vw,64px)]">
          <ModuleNav />
          <div className="flex min-w-0 flex-1 flex-col gap-[clamp(64px,9vw,128px)]">
            {MODULES.map((m, i) => (
              <article key={m.id} id={m.id} data-ch={i} className="flex scroll-mt-[90px] flex-col gap-[22px]">
                <div className="flex max-w-[720px] flex-col gap-3">
                  <Eyebrow>
                    {String(i + 1).padStart(2, "0")} · {m.kicker}
                  </Eyebrow>
                  <h2 data-reveal="up" className="m-0 text-[clamp(32px,4.6vw,58px)] font-medium leading-none tracking-[-0.05em]">
                    {m.lead} <Accent>{m.accent}</Accent>
                  </h2>
                  <p data-reveal="up" className="m-0 text-[17px] text-mk-ink2 [text-wrap:pretty]">
                    {m.body}
                  </p>
                </div>
                <ModuleUi m={m} />
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] border-t-2 border-mk-rule">
                  {m.points.map((p) => (
                    <div key={p.t} className="flex flex-col gap-1 border-b border-mk-hair py-3.5 pr-4">
                      <span className="text-[15px] font-semibold">{p.t}</span>
                      <span className="text-sm text-mk-ink2">{p.b}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y-2 border-mk-rule bg-mk-s2 px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-[clamp(24px,4vw,40px)]">
          <SectionHead
            eyebrow="PLATFORM COVERAGE"
            lead="What works where,"
            accent="today."
            lede="Built on each platform’s official API. Where a platform limits something, we say so instead of faking it."
          />
          {/* `relative` keeps the absolutely-positioned sr-only labels inside the scroller. */}
          <div className="relative overflow-x-auto border-t-2 border-mk-rule" tabIndex={0} aria-label="Platform coverage table">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-mk-hair text-[13px] font-semibold">
                  <th scope="col" className="w-[30%] py-3.5 font-mk-mono text-xs font-normal tracking-[.06em] text-mk-ink3">
                    CAPABILITY
                  </th>
                  {(["M", "G", "T", "S", "L"] as PlatformKey[]).map((p) => (
                    <th key={p} scope="col" className="py-3.5 font-semibold">
                      <span className="flex items-center gap-2">
                        <PlatformMark p={p} size={22} />
                        {PLATFORMS[p].name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COVERAGE.map((r) => (
                  <tr key={r.l} className="border-b border-mk-hair text-[15px]">
                    <th scope="row" className="py-3.5 font-medium">
                      {r.l}
                    </th>
                    {r.c.split("").map((v, j) => (
                      <td key={j} className="py-3.5">
                        <Dot v={v as "F" | "H" | "N"} />
                        <span className="sr-only">{COVERAGE_LABEL[v as "F" | "H" | "N"]}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-mk-ink2">
            {(["F", "H", "N"] as const).map((v) => (
              <span key={v} className="flex items-center gap-2">
                <Dot v={v} />
                {COVERAGE_LABEL[v]}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-[clamp(16px,4vw,32px)] py-[clamp(64px,9vw,120px)]">
        <div className="mx-auto grid max-w-[1280px] grid-cols-1 border-t-2 border-mk-rule mk-sm:grid-cols-2 mk-xl:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.v} data-reveal="rise" className="flex flex-col gap-2 border-b border-mk-hair py-6 pr-[22px]">
              <span className="text-[clamp(34px,4vw,48px)] font-medium leading-none tracking-[-0.045em]">{t.v}</span>
              <span className="font-semibold">{t.t}</span>
              <span className="text-[14.5px] text-mk-ink2">{t.b}</span>
            </div>
          ))}
        </div>
      </section>

      <CtaBand lead="See every module" accent="on your own accounts.">
        <PillButton href={SIGN_UP_HREF} variant="white" className="px-[26px]">
          Start free
        </PillButton>
        <PillButton href="/how-it-works" variant="ghost-dark">
          How it works
        </PillButton>
      </CtaBand>
    </>
  );
}
