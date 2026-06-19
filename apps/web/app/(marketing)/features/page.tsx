import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Target,
  Wand2,
  Layers,
  BarChart3,
  Rocket,
  Shield,
  Plug,
  Lightbulb,
  TrendingUp,
  Check,
  CircleDollarSign,
  Globe,
  Users,
  Brain,
  Zap,
} from "lucide-react";
import { GradientMesh } from "@/components/marketing/GradientMesh";

export const metadata = {
  title: "Features",
  description:
    "Everything Advertix does — AI campaign planning, creative generation, multi-platform sync, analytics, publishing, and enterprise-grade security.",
};

const PILLARS = [
  {
    id: "ai-planner",
    icon: Brain,
    eyebrow: "Strategy",
    title: "AI that thinks like a media buyer",
    description:
      "Describe what you're trying to achieve. Advertix returns a full strategy in seconds — budget allocation, audience targeting, creative direction, performance forecasts. Backed by Claude.",
    bullets: [
      "Multi-platform budget split tuned to your ROAS target",
      "Audience suggestions sourced from real platform inventory",
      "Headlines, body, hooks, and CTAs generated to brief",
      "ROAS, CPA, and conversion forecasts before you spend",
    ],
  },
  {
    id: "multi-platform",
    icon: Layers,
    eyebrow: "Connectivity",
    title: "Every ad platform, one workspace",
    description:
      "Connect Meta, Google, TikTok, and LinkedIn in under a minute via OAuth. Everything syncs both directions — pause in Advertix, it pauses on the platform. Edit in the platform, the change appears here.",
    bullets: [
      "Native API integration — no scraping, no broken pixels",
      "Both-direction sync for campaigns, ad sets, creatives",
      "Per-account native currency support (USD, PKR, INR, EUR…)",
      "Account-level metadata: timezones, budgets, structures",
    ],
  },
  {
    id: "creative-ai",
    icon: Wand2,
    eyebrow: "Creative",
    title: "Generate ads that match your voice",
    description:
      "Ad copy that doesn't sound generic. Give brand voice, audience, and offer. Get headlines, body, CTAs, and creative direction — variants by tone, length, and platform.",
    bullets: [
      "Per-platform variants (FB headline ≠ TikTok hook)",
      "Brand voice tuning — preserve tone across campaigns",
      "Compliance-aware copy (no banned words, no over-claims)",
      "A/B variant generation for split-testing",
    ],
  },
  {
    id: "publishing",
    icon: Rocket,
    eyebrow: "Publishing",
    title: "Build once. Launch everywhere.",
    description:
      "A unified campaign builder that maps to each platform's structure. Six-step wizard: page, objective, audience, schedule, creative, review. One click ships to Meta — and the same flow extends to Google, TikTok, and LinkedIn as those are rolled out.",
    bullets: [
      "Page picker, objective, audience, schedule, creative, review",
      "Image upload, library, or URL — Advertix uploads to platform",
      "Atomic publish: campaign + ad set + creative + ad in one call",
      "Auto-rollback if any step fails — no half-published mess",
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    eyebrow: "Analytics",
    title: "Cross-platform performance, native currency",
    description:
      "ROAS, spend, conversions, CTR — every metric across every connected account. Per-campaign currency. Lifetime totals on cards. AI-surfaced insights highlight what's working and what isn't.",
    bullets: [
      "Per-platform metrics + a single unified overview",
      "Native currency on every campaign (no forced USD)",
      "Lifetime aggregates + 7-day / 30-day / 90-day windows",
      "AI insights: 'Pause X, reallocate to Y for +$1.2k revenue'",
    ],
  },
  {
    id: "security",
    icon: Shield,
    eyebrow: "Security",
    title: "Tokens encrypted. Auth hardened. Zero data resale.",
    description:
      "Every OAuth token we hold is encrypted with AES-256-CBC before it touches the database. Authentication runs on Clerk (SOC 2 Type II). We never train models on your data. We never sell it.",
    bullets: [
      "AES-256-CBC token encryption at rest",
      "SOC 2-grade auth — MFA, session controls, device security",
      "TLS 1.2+ in transit, HSTS, secure cookies",
      "Revoke any integration at any time — instant disconnect",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main className="bg-white text-slate-900">
      <FeaturesHero />
      <PillarSections />
      <DifferentiatorBand />
      <CrossSell />
    </main>
  );
}

function FeaturesHero() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-28 sm:pt-32 lg:pb-40 lg:pt-36">
      <GradientMesh />
      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
          <Sparkles className="h-3 w-3 text-indigo-300" strokeWidth={2.5} />
          What Advertix does
        </div>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[64px]">
          A complete ad-ops platform.
          <br />
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            Six pillars. One workspace.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
          AI-driven strategy, creative generation, multi-platform publishing,
          unified analytics, and security that meets enterprise bars — without
          the enterprise price tag.
        </p>

        {/* Floating pillar chips */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {PILLARS.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition hover:border-indigo-300/40 hover:bg-indigo-500/15"
            >
              <p.icon className="h-3 w-3 text-indigo-300" strokeWidth={2.5} />
              {p.eyebrow}
            </a>
          ))}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F6F6FD]" />
    </section>
  );
}

function PillarSections() {
  return (
    <section className="bg-[#F6F6FD] pb-20">
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        {PILLARS.map((p, i) => (
          <PillarCard key={p.id} pillar={p} reverse={i % 2 === 1} />
        ))}
      </div>
    </section>
  );
}

function PillarCard({
  pillar,
  reverse,
}: {
  pillar: (typeof PILLARS)[number];
  reverse: boolean;
}) {
  return (
    <article
      id={pillar.id}
      className="overflow-hidden rounded-[44px] bg-white px-6 py-12 shadow-sm sm:px-10 sm:py-16 lg:px-16 lg:py-20"
    >
      <div
        className={`grid gap-10 lg:grid-cols-[1.1fr,1fr] lg:items-center ${
          reverse ? "lg:[grid-template-columns:1fr_1.1fr]" : ""
        }`}
      >
        <div className={reverse ? "lg:order-2" : ""}>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
            <pillar.icon className="h-3 w-3" strokeWidth={2.5} />
            {pillar.eyebrow}
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl">
            {pillar.title}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-600">
            {pillar.description}
          </p>
          <ul className="mt-6 space-y-3">
            {pillar.bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2.5 text-sm text-slate-700"
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                  <Check className="h-3 w-3 text-indigo-600" strokeWidth={3} />
                </div>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className={reverse ? "lg:order-1" : ""}>
          <PillarVisual id={pillar.id} />
        </div>
      </div>
    </article>
  );
}

/* Pillar-specific visuals */
function PillarVisual({ id }: { id: string }) {
  switch (id) {
    case "ai-planner":
      return <AIPlannerVisual />;
    case "multi-platform":
      return <PlatformsVisual />;
    case "creative-ai":
      return <CreativeAIVisual />;
    case "publishing":
      return <PublishingVisual />;
    case "analytics":
      return <AnalyticsVisual />;
    case "security":
      return <SecurityVisual />;
    default:
      return null;
  }
}

function AIPlannerVisual() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 p-6 shadow-xl shadow-indigo-600/30">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, white 0%, transparent 40%), radial-gradient(circle at 80% 80%, #f0abfc 0%, transparent 40%)",
        }}
      />
      <div className="relative">
        <div className="rounded-2xl bg-white/95 p-4 text-slate-800 shadow-lg">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
            Your brief
          </div>
          <p className="mt-1 text-sm">
            Launch holiday campaign for premium sneakers. $8k budget. ROAS 3.5x.
          </p>
        </div>
        <div className="mt-3 rounded-2xl bg-slate-900/90 p-4 text-white backdrop-blur">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
            <Sparkles className="h-3 w-3" strokeWidth={2.5} />
            Advertix AI · forecast
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ForecastTile label="Forecast ROAS" value="3.8×" />
            <ForecastTile label="Best Channel" value="TikTok" />
            <ForecastTile label="Projected CPA" value="$19" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ForecastTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 p-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function PlatformsVisual() {
  const cards = [
    { name: "Meta", letter: "M", color: "#1877F2", status: "Connected" },
    { name: "Google", letter: "G", color: "#EA4335", status: "Connected" },
    { name: "TikTok", letter: "T", color: "#000000", status: "Connected" },
    { name: "LinkedIn", letter: "in", color: "#0A66C2", status: "Connect" },
  ];
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="space-y-2">
        {cards.map((c) => (
          <div
            key={c.name}
            className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white shadow"
                style={{ backgroundColor: c.color }}
              >
                {c.letter}
              </div>
              <div>
                <div className="text-sm font-bold text-[#0B1319]">{c.name}</div>
                <div className="text-[10px] font-medium text-slate-500">
                  Native API
                </div>
              </div>
            </div>
            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                c.status === "Connected"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-indigo-600 text-white"
              }`}
            >
              {c.status === "Connected" ? (
                <>
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  Connected
                </>
              ) : (
                "Connect"
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreativeAIVisual() {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <div className="space-y-2">
        <CreativeCard tone="Bold" text="🔥 Built for athletes who refuse to slow down." />
        <CreativeCard tone="Premium" text="🏃 Engineered in Tokyo. Tested at 40 km/h." />
        <CreativeCard tone="Quirky" text="⚡ Your old shoes called. They want a rematch." selected />
        <CreativeCard tone="Direct" text="Run faster. Recover smarter. Period." />
      </div>
    </div>
  );
}

function CreativeCard({
  tone,
  text,
  selected,
}: {
  tone: string;
  text: string;
  selected?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
        selected
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
          : "bg-white text-slate-700"
      }`}
    >
      <div
        className={`shrink-0 rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
          selected ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
        }`}
      >
        {tone}
      </div>
      <div className="text-xs font-semibold">{text}</div>
    </div>
  );
}

function PublishingVisual() {
  const steps = ["Page", "Objective", "Audience", "Schedule", "Creative", "Review"];
  const current = 5; // index of "Review"
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Publish to Meta
        </div>
        <div className="mt-1 text-sm font-bold text-[#0B1319]">
          Step {current + 1} of {steps.length} — Review & Publish
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-bold ${
                i <= current
                  ? "bg-indigo-50 text-indigo-700"
                  : "bg-slate-50 text-slate-400"
              }`}
            >
              {i <= current ? (
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              )}
              {s}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0B1319] px-3 py-2.5 text-xs font-bold text-white"
        >
          <Rocket className="h-3 w-3" strokeWidth={3} />
          Publish to Meta
        </button>
      </div>
    </div>
  );
}

function AnalyticsVisual() {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <div className="grid grid-cols-2 gap-2">
        <AnalyticsTile label="Spend" value="$24,180" currency="USD" />
        <AnalyticsTile label="ROAS" value="2.94×" currency="" highlight />
        <AnalyticsTile label="Revenue" value="₨2.4M" currency="PKR" />
        <AnalyticsTile label="Conversions" value="1,284" currency="" />
      </div>
      <div className="mt-3 rounded-2xl bg-white p-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
          <span>Last 30 days</span>
          <span className="text-emerald-600">+18.2%</span>
        </div>
        <svg viewBox="0 0 200 50" className="mt-1 h-14 w-full">
          <defs>
            <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d="M0 40 L20 32 L40 36 L60 25 L80 28 L100 18 L120 22 L140 14 L160 18 L180 8 L200 12 L200 50 L0 50 Z"
            fill="url(#ag)"
          />
          <path
            d="M0 40 L20 32 L40 36 L60 25 L80 28 L100 18 L120 22 L140 14 L160 18 L180 8 L200 12"
            stroke="#6366f1"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function AnalyticsTile({
  label,
  value,
  currency,
  highlight,
}: {
  label: string;
  value: string;
  currency: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 ${
        highlight
          ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-600/20"
          : "bg-white text-[#0B1319]"
      }`}
    >
      <div
        className={`text-[10px] font-bold uppercase tracking-wider ${
          highlight ? "text-white/70" : "text-slate-500"
        }`}
      >
        {label}
        {currency && <span className="ml-1 opacity-60">· {currency}</span>}
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}

function SecurityVisual() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1319] via-slate-900 to-indigo-950 p-6 shadow-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl"
      />
      <div className="relative">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/30">
          <Shield className="h-6 w-6 text-white" strokeWidth={2} />
        </div>
        <div className="mt-4 text-lg font-bold text-white">
          Tokens encrypted at rest
        </div>
        <div className="mt-1 text-sm text-slate-400">
          Every OAuth token wrapped in AES-256-CBC before it touches the
          database.
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {[
            "AES-256-CBC at rest",
            "TLS 1.2+ in transit",
            "SOC 2-grade auth",
            "Zero data resale",
          ].map((t) => (
            <div
              key={t}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-bold text-slate-200"
            >
              <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────── DIFFERENTIATOR BAND ────────────────────────────── */

const DIFFS = [
  {
    icon: Zap,
    title: "Built for speed",
    desc: "Server-rendered. Edge-cached. Zero waterfall API calls. The whole app loads in <1.5s.",
  },
  {
    icon: Globe,
    title: "Native currency",
    desc: "Your PKR / INR / EUR campaigns stay in their native currency. No forced USD conversion lies.",
  },
  {
    icon: Users,
    title: "Real audiences",
    desc: "Audience suggestions sourced from each platform's live inventory, not cached lists.",
  },
  {
    icon: CircleDollarSign,
    title: "Free during beta",
    desc: "No card required. No usage caps. Everything unlocked until we leave beta.",
  },
];

function DifferentiatorBand() {
  return (
    <section className="bg-[#F6F6FD] py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            Why Advertix
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl">
            Built different on purpose
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFS.map((d) => (
            <div
              key={d.title}
              className="group rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200/30"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                <d.icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div className="mt-4 text-base font-bold text-[#0B1319]">
                {d.title}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {d.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── CROSS-SELL ────────────────────────────── */

function CrossSell() {
  return (
    <section className="bg-[#F6F6FD] pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[44px] bg-[#0B1319] p-10 sm:p-14 lg:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-indigo-600/30 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-violet-600/30 blur-3xl"
          />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr,1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
                <Sparkles className="h-3 w-3 text-indigo-300" strokeWidth={2.5} />
                Ready to amplify?
              </div>
              <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
                Six features. One workspace. Zero credit card.
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-300">
                Try Advertix free during beta. Connect one platform and let AI
                do the rest.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Link
                href="/sign-up"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-900 shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-50"
              >
                <Rocket className="h-4 w-4" strokeWidth={2.5} />
                Get started free
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.5}
                />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
