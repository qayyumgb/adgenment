import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Target,
  Layers,
  Wand2,
  BarChart3,
  Rocket,
  Shield,
  Plug,
  Lightbulb,
  TrendingUp,
  Check,
  Bot,
  Zap,
  Globe,
  CircleDollarSign,
} from "lucide-react";
import { GradientMesh } from "@/components/marketing/GradientMesh";
import { DashboardMockup } from "@/components/marketing/DashboardMockup";

export const metadata = {
  title: "Advertix — AI-Powered Ads. Amplified.",
  description:
    "Manage every ad platform from one intelligent workspace. Plan, generate, launch and optimize campaigns across Meta, Google, TikTok and LinkedIn with AI as your strategist.",
};

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-white text-slate-900">
      <Hero />
      <PlatformRibbon />
      <EcosystemSection />
      <BentoFeatures />
      <HowItWorksSection />
      <MetricsBar />
      <FinalCTA />
    </main>
  );
}

/* ──────────────────────────────────────── HERO ──────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative isolate pt-28 sm:pt-32 lg:pt-36">
      <GradientMesh />

      <div className="relative mx-auto max-w-7xl px-6 pb-32 lg:px-8 lg:pb-44">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr,1fr] lg:gap-10">
          {/* Left: Copy */}
          <div className="relative z-10">
            {/* Pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <Sparkles className="h-3 w-3 text-indigo-300" strokeWidth={2.5} />
              Powered by Claude · Meta-approved
            </div>

            {/* Divider in Stellar style */}
            <div className="my-5 h-px max-w-md bg-gradient-to-r from-white/30 to-transparent" />

            {/* Headline */}
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[64px]">
              AI-Powered Ads.
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                  Amplified.
                </span>
                <svg
                  aria-hidden
                  className="absolute -bottom-2 left-0 right-0 z-0 h-3 w-full"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 6 Q 50 0 100 6 T 200 6"
                    stroke="url(#hl)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="hl" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#a5b4fc" />
                      <stop offset="100%" stopColor="#f0abfc" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Plan, generate, launch and optimize ad campaigns across{" "}
              <span className="font-semibold text-white">Meta</span>,{" "}
              <span className="font-semibold text-white">Google</span>,{" "}
              <span className="font-semibold text-white">TikTok</span> and{" "}
              <span className="font-semibold text-white">LinkedIn</span> — from
              one intelligent workspace where AI does the heavy lifting.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/sign-up"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-slate-900 shadow-2xl shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:bg-indigo-50"
              >
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                See how it works
              </Link>
            </div>

            {/* Trust strip */}
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400">
              <TrustItem label="No credit card" />
              <TrustItem label="Free during beta" />
              <TrustItem label="Cancel anytime" />
              <TrustItem label="SOC 2-grade auth" />
            </div>
          </div>

          {/* Right: Dashboard mockup */}
          <div className="relative z-10 lg:pl-4">
            <DashboardMockup />
          </div>
        </div>
      </div>

      {/* Bottom curve carrying into next section */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F6F6FD]" />
    </section>
  );
}

function TrustItem({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={3} />
      {label}
    </span>
  );
}

/* ────────────────────────────────── PLATFORM RIBBON ────────────────────────────────── */

const PLATFORMS = [
  { name: "Meta", letter: "M", color: "#1877F2", desc: "Facebook · Instagram" },
  { name: "Google", letter: "G", color: "#EA4335", desc: "Search · YouTube · Display" },
  { name: "TikTok", letter: "T", color: "#000000", desc: "Spark Ads · TopView" },
  { name: "LinkedIn", letter: "in", color: "#0A66C2", desc: "Sponsored · Lead Gen" },
];

function PlatformRibbon() {
  return (
    <section id="platforms" className="relative bg-[#F6F6FD] py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            One workspace · Every platform
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl">
            Manage every ad platform without context switching
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              className="group relative overflow-hidden rounded-3xl border border-white bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-200/30"
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
                  style={{ backgroundColor: p.color }}
                >
                  {p.letter}
                </div>
                <div>
                  <div className="text-base font-bold text-[#0B1319]">{p.name}</div>
                  <div className="text-[11px] font-medium text-slate-500">{p.desc}</div>
                </div>
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                <Check className="h-3 w-3" strokeWidth={3} />
                Native API
              </div>
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition group-hover:opacity-30" style={{ backgroundColor: p.color }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────── ECOSYSTEM SECTION ───────────────────────────────── */

function EcosystemSection() {
  return (
    <section className="bg-[#F6F6FD] pb-24 pt-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[44px] bg-white px-6 py-12 shadow-lg shadow-slate-900/5 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr,1fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                <Bot className="h-3 w-3" strokeWidth={2.5} />
                The Advertix Brain
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl lg:text-[44px] lg:leading-[1.15]">
                Describe your goal.
                <br />
                <span className="text-indigo-600">AI returns a complete strategy.</span>
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
                Tell Advertix what you're trying to achieve. Our Claude-powered
                planner returns a full campaign — budget allocation, audience
                targeting, creative direction, and projected ROAS — in seconds.
              </p>

              <ul className="mt-6 space-y-3">
                {[
                  "Multi-platform budget allocation tuned to your goal",
                  "Audience targeting suggestions from real platform data",
                  "Headlines, body copy, and creative direction on tap",
                  "Performance forecasts before you spend a dollar",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                      <Check className="h-3 w-3 text-indigo-600" strokeWidth={3} />
                    </div>
                    {line}
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up"
                className="group mt-8 inline-flex items-center gap-2 rounded-full bg-[#0B1319] px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Try the AI Planner
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
              </Link>
            </div>

            {/* Right: AI prompt + response visual */}
            <AIPromptVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function AIPromptVisual() {
  return (
    <div className="relative">
      {/* Decorative gradient frame */}
      <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-pink-500/20 blur-3xl" />

      <div className="relative space-y-3">
        {/* User prompt */}
        <div className="ml-12 rounded-2xl rounded-tr-md bg-indigo-600 px-4 py-3 text-sm text-white shadow-lg">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
            You
          </div>
          <div className="mt-0.5">
            Launch a campaign for our new running shoes. $5k budget. Target gym-goers
            25-40 in major US cities. ROAS target 3x.
          </div>
        </div>

        {/* AI response */}
        <div className="rounded-2xl rounded-tl-md bg-white px-4 py-4 shadow-xl ring-1 ring-slate-200/60">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow shadow-indigo-500/30">
              <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              Advertix AI · Strategy ready
            </span>
          </div>

          <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-slate-700">
            <p>
              Here's a multi-platform allocation projected at <strong>3.2× ROAS</strong>:
            </p>

            <div className="space-y-1.5 rounded-lg bg-slate-50 p-2.5">
              <AllocBar label="Meta (IG Reels + FB Feed)" pct={45} amount="$2,250" color="#1877F2" />
              <AllocBar label="TikTok Spark Ads" pct={30} amount="$1,500" color="#000000" />
              <AllocBar label="Google YouTube + Search" pct={25} amount="$1,250" color="#EA4335" />
            </div>

            <p>
              <strong>Audience:</strong> Look-alike of fitness app users · interests:
              CrossFit, marathon, Strava · age 25-40 · top 25 metros.
            </p>
            <p>
              <strong>Creative direction:</strong> 6-sec hook-focused video · UGC athlete
              testimonial · feature: lightweight + carbon plate.
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <div className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white">
              Build campaign
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600">
              Refine
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AllocBar({
  label,
  pct,
  amount,
  color,
}: {
  label: string;
  pct: number;
  amount: string;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
        <span>{label}</span>
        <span>{amount}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ───────────────────────────────── BENTO FEATURES ───────────────────────────────── */

function BentoFeatures() {
  return (
    <section id="features" className="bg-[#F6F6FD] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            Built for serious advertisers
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl lg:text-[44px]">
            Everything you need to ship smarter ads
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-600">
            One workspace for strategy, creative, publishing, and analytics —
            backed by AI that actually understands advertising.
          </p>
        </div>

        {/* Bento grid */}
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-[auto_auto_auto]">
          {/* Big card: AI Planner */}
          <BentoCard
            className="md:col-span-4 md:row-span-2"
            icon={Target}
            tag="AI Planner"
            title="From prompt to publishable strategy in seconds"
            description="Describe your objective, budget and constraints. Get a complete campaign plan — allocation, audience, creative direction, and ROAS forecast — ready to launch."
            visual={
              <div className="relative h-full min-h-[200px] overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 p-4">
                <div className="absolute inset-0 opacity-30" style={{
                  backgroundImage: "radial-gradient(circle at 30% 20%, white 0%, transparent 40%), radial-gradient(circle at 80% 70%, #f0abfc 0%, transparent 40%)"
                }} />
                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                    <Sparkles className="h-2.5 w-2.5" strokeWidth={3} />
                    AI Strategy
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-3/4 rounded-full bg-white/30" />
                    <div className="h-3 w-full rounded-full bg-white/25" />
                    <div className="h-3 w-5/6 rounded-full bg-white/20" />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <MiniMetric label="Budget" value="$5k" />
                    <MiniMetric label="ROAS" value="3.2×" />
                    <MiniMetric label="CPA" value="$24" />
                  </div>
                </div>
              </div>
            }
          />

          {/* Right column - 2 stacked */}
          <BentoCard
            className="md:col-span-2"
            icon={Wand2}
            tag="Creative AI"
            title="Generate copy that converts"
            description="Headlines, body, hooks, CTAs — tuned to your brand voice and objective."
            visual={<CreativeVisual />}
          />

          <BentoCard
            className="md:col-span-2"
            icon={Layers}
            tag="Multi-Platform"
            title="Unified across every channel"
            description="Connect Meta, Google, TikTok, LinkedIn. See it all in one dashboard."
            visual={<MultiPlatformVisual />}
          />

          {/* Bottom row */}
          <BentoCard
            className="md:col-span-2"
            icon={BarChart3}
            tag="Analytics"
            title="Cross-platform performance"
            description="ROAS, spend, conversions — every metric, native currency, every account."
            visual={<AnalyticsVisual />}
          />

          <BentoCard
            className="md:col-span-2"
            icon={Rocket}
            tag="Publishing"
            title="One-click multi-platform launch"
            description="Build once. Publish to FB, IG, and beyond. Status syncs both ways automatically."
            visual={<PublishVisual />}
          />

          <BentoCard
            className="md:col-span-2"
            icon={Shield}
            tag="Security"
            title="Secure by default"
            description="AES-256 token encryption. SOC 2-grade auth via Clerk. Zero data resale."
            visual={<SecurityVisual />}
          />
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  icon: Icon,
  tag,
  title,
  description,
  visual,
  className = "",
}: {
  icon: typeof Target;
  tag: string;
  title: string;
  description: string;
  visual?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200/30 ${className}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
          {tag}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-bold text-[#0B1319]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>
      {visual && <div className="mt-5 flex-1">{visual}</div>}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/15 p-2 backdrop-blur">
      <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function CreativeVisual() {
  return (
    <div className="space-y-1.5 rounded-xl bg-slate-50 p-3">
      <div className="rounded-lg bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm">
        🏃 &quot;Run faster. Recover smarter.&quot;
      </div>
      <div className="rounded-lg bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-sm">
        🔥 &quot;Built for athletes who refuse to slow down.&quot;
      </div>
      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-[11px] font-semibold text-indigo-700">
        ⚡ &quot;The shoe that thinks faster than you.&quot;
      </div>
    </div>
  );
}

function MultiPlatformVisual() {
  return (
    <div className="relative flex items-center justify-center py-2">
      <div className="absolute inset-0 m-auto h-24 w-24 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100" />
      <div className="relative grid grid-cols-2 gap-2">
        {[
          { letter: "M", color: "#1877F2" },
          { letter: "G", color: "#EA4335" },
          { letter: "T", color: "#000000" },
          { letter: "in", color: "#0A66C2" },
        ].map((p) => (
          <div
            key={p.letter}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white shadow-md"
            style={{ backgroundColor: p.color }}
          >
            {p.letter}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsVisual() {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <svg viewBox="0 0 120 50" className="h-14 w-full">
        <defs>
          <linearGradient id="bv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d="M0 40 L20 30 L40 35 L60 20 L80 22 L100 10 L120 14 L120 50 L0 50 Z"
          fill="url(#bv)"
        />
        <path
          d="M0 40 L20 30 L40 35 L60 20 L80 22 L100 10 L120 14"
          stroke="#6366f1"
          strokeWidth={1.5}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-500">
        <span>ROAS 2.94×</span>
        <span className="text-emerald-600">+18%</span>
      </div>
    </div>
  );
}

function PublishVisual() {
  return (
    <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-3">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
        <span>Step 6 of 6</span>
        <span className="text-indigo-600">Ready</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full w-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
      </div>
      <button
        type="button"
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow"
      >
        <Rocket className="h-3 w-3" strokeWidth={3} />
        Publish to Meta
      </button>
    </div>
  );
}

function SecurityVisual() {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <Shield className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-900">Tokens Encrypted</div>
          <div className="text-[10px] font-medium text-slate-500">AES-256-CBC at rest</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {["SOC 2", "OAuth", "TLS 1.2+"].map((s) => (
          <div key={s} className="rounded-md bg-white px-1.5 py-1 text-center text-[9px] font-bold text-slate-600 ring-1 ring-slate-200">
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────────────── HOW IT WORKS ───────────────────────────────── */

const STEPS = [
  {
    icon: Plug,
    title: "Connect",
    description:
      "Link your ad accounts via OAuth in 60 seconds. Meta, Google, TikTok, LinkedIn — no API keys to paste.",
    accent: "from-indigo-400 to-indigo-600",
  },
  {
    icon: Lightbulb,
    title: "Plan",
    description:
      "Describe your goal in plain English. AI returns a full strategy: budget split, audience, creative, forecast.",
    accent: "from-violet-400 to-violet-600",
  },
  {
    icon: TrendingUp,
    title: "Launch & optimize",
    description:
      "One click to publish across platforms. Watch performance live and let AI surface what to do next.",
    accent: "from-fuchsia-400 to-fuchsia-600",
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative overflow-hidden bg-[#0B1319] py-20 lg:py-28">
      {/* Decorative bg */}
      <div className="pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[44px]">
            From idea to live ad in minutes
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Three steps. No spreadsheets, no juggling platforms, no guessing.
          </p>
        </div>

        {/* Step rail */}
        <div className="relative mt-16">
          {/* Connector line */}
          <div className="absolute left-1/2 top-12 hidden h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent md:block" />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative">
                {/* Number ring */}
                <div className="mx-auto flex h-24 w-24 items-center justify-center">
                  <div className="absolute inset-0 m-auto h-24 w-24 rounded-full bg-gradient-to-br from-white/10 to-transparent backdrop-blur" />
                  <div className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${s.accent} shadow-2xl shadow-indigo-900/50 ring-4 ring-white/10`}>
                    <s.icon className="h-8 w-8 text-white" strokeWidth={2} />
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-300">
                    Step {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="mt-2 text-xl font-bold text-white">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────── METRICS BAR ───────────────────────────────── */

const STATS = [
  { value: "4", label: "Ad platforms supported", icon: Globe },
  { value: "AI", label: "Strategy in seconds", icon: Zap },
  { value: "256-bit", label: "Token encryption", icon: Shield },
  { value: "Native", label: "Multi-currency", icon: CircleDollarSign },
];

function MetricsBar() {
  return (
    <section className="bg-[#F6F6FD] py-16">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-4 rounded-3xl bg-white p-6 shadow-sm sm:p-10 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-200">
                <s.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <div>
                <div className="text-xl font-bold text-[#0B1319] sm:text-2xl">{s.value}</div>
                <div className="text-xs font-medium text-slate-600">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────────── FINAL CTA ───────────────────────────────── */

function FinalCTA() {
  return (
    <section className="bg-[#F6F6FD] pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[44px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-10 text-center shadow-2xl shadow-indigo-600/40 sm:p-16 lg:p-20">
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-60 w-60 rounded-full bg-fuchsia-300/30 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-20" style={{
            backgroundImage: "radial-gradient(circle at 30% 30%, white 0%, transparent 40%), radial-gradient(circle at 70% 80%, #f0abfc 0%, transparent 40%)"
          }} />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur ring-1 ring-inset ring-white/20">
              <Bot className="h-3 w-3" strokeWidth={2.5} />
              Powered by Advertix AI
            </div>
            <h2 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Stop juggling platforms.
              <br />
              <span className="text-white/90">Start amplifying ads.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
              Get started in 60 seconds. Free during beta. Connect one platform
              and let AI run your next campaign.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-indigo-700 shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-50 sm:w-auto"
              >
                <Rocket className="h-4 w-4" strokeWidth={2.5} />
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
              </Link>
              <Link
                href="/contact"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
              >
                Talk to us
              </Link>
            </div>

            <div className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-white/80">
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3" strokeWidth={3} /> No credit card
              </span>
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3" strokeWidth={3} /> Free during beta
              </span>
              <span className="inline-flex items-center gap-1">
                <Check className="h-3 w-3" strokeWidth={3} /> Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
