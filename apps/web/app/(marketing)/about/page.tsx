import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Target,
  Eye,
  Heart,
  Shield,
  Globe,
  Rocket,
  MapPin,
  Calendar,
  Code2,
  Brain,
  Users,
} from "lucide-react";
import { GradientMesh } from "@/components/marketing/GradientMesh";

export const metadata = {
  title: "About",
  description:
    "Why Advertix exists, who built it, and what we believe about AI-powered advertising.",
};

export default function AboutPage() {
  return (
    <main className="bg-white text-slate-900">
      <AboutHero />
      <MissionVision />
      <FounderCard />
      <PrinciplesGrid />
      <TimelineBand />
      <AboutCTA />
    </main>
  );
}

function AboutHero() {
  return (
    <section className="relative isolate overflow-hidden pb-32 pt-28 sm:pt-32 lg:pb-40 lg:pt-36">
      <GradientMesh />
      <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm">
          <Sparkles className="h-3 w-3 text-indigo-300" strokeWidth={2.5} />
          About Advertix
        </div>
        <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[64px]">
          Built so AI does the boring parts of
          <br />
          <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            running ads.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Advertix is a one-person product (so far) built by a working
          developer in Karachi. Sane defaults, real APIs, honest pricing — no
          venture theatre.
        </p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F6F6FD]" />
    </section>
  );
}

function MissionVision() {
  return (
    <section className="bg-[#F6F6FD] pb-20 pt-4">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[36px] bg-white p-10 shadow-sm sm:p-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-600/30">
              <Target className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-700">
              Our mission
            </div>
            <h2 className="mt-2 text-2xl font-bold text-[#0B1319] sm:text-3xl">
              Give every advertiser a senior media buyer in their pocket.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              The best media buyers don&apos;t guess — they pattern-match against
              thousands of campaigns. AI can do that too. Advertix bottles that
              intuition into a workspace anyone can use.
            </p>
          </div>

          <div className="overflow-hidden rounded-[36px] bg-[#0B1319] p-10 text-white shadow-sm sm:p-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-lg shadow-fuchsia-600/30">
              <Eye className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-fuchsia-300">
              Our vision
            </div>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              A world where great campaigns aren&apos;t gated by team size.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              You shouldn&apos;t need a 12-person growth team to spend $50k a month
              well. Advertix exists so a one-person founder can compete with
              the people who do.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FounderCard() {
  return (
    <section className="bg-[#F6F6FD] pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[44px] bg-white p-8 shadow-sm sm:p-12 lg:p-16">
          <div className="grid gap-10 lg:grid-cols-[1fr,1.4fr] lg:items-center">
            {/* Avatar / illustration */}
            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute -inset-4 rounded-[40px] bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-pink-500/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 p-8 shadow-xl shadow-indigo-600/30">
                <div className="aspect-square w-full rounded-3xl bg-white/10 p-6 backdrop-blur">
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur">
                        <Code2 className="h-5 w-5 text-white" strokeWidth={2} />
                      </div>
                      <div className="text-right text-[10px] font-bold uppercase tracking-wider text-white/80">
                        Founder
                      </div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-white">AQ</div>
                      <div className="text-sm font-medium text-white/80">
                        AB Qayyum
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-white/80">
                        <MapPin className="h-3 w-3" strokeWidth={2.5} />
                        Karachi, Pakistan
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                <Heart className="h-3 w-3" strokeWidth={2.5} />
                Founder
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl">
                Hi, I&apos;m AB Qayyum.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                I&apos;ve spent years building B2B SaaS and watching teams burn
                hours on the same ad-ops chores: switching between platforms,
                copy-pasting audiences, trying to remember which campaign was
                supposed to do what.
              </p>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Advertix is my answer. It&apos;s the tool I wanted: real APIs, real
                AI, no marketing fluff. I&apos;m building it in public, shipping
                weekly, and answering every support email myself.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Badge label="10+ yrs building SaaS" />
                <Badge label="Karachi, PK" />
                <Badge label="Bootstrapped" />
                <Badge label="Anthropic API" />
              </div>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0B1319] px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  Email me
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </Link>
                <a
                  href="https://twitter.com/advertix"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Follow on Twitter
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
      {label}
    </span>
  );
}

const PRINCIPLES = [
  {
    icon: Brain,
    title: "AI is the assistant, not the boss",
    desc: "Every AI recommendation is editable, dismissable, and explainable. You're always one click from full control.",
  },
  {
    icon: Shield,
    title: "Your data stays yours",
    desc: "We never train models on your campaigns. We never sell to third parties. Tokens encrypted, period.",
  },
  {
    icon: Globe,
    title: "Native, not translated",
    desc: "PKR campaigns stay PKR. Indian timezones stay IST. We don't pretend the world is US-only.",
  },
  {
    icon: Rocket,
    title: "Ship weekly",
    desc: "New integration or feature every week. Public changelog. No quarterly mystery rollouts.",
  },
  {
    icon: Users,
    title: "Founder support",
    desc: "Every support email currently lands in my personal inbox. That's a feature, not a bug.",
  },
  {
    icon: Heart,
    title: "Honest pricing",
    desc: "Free during beta. When we charge, we'll tell you why and what changed. No usage gotchas.",
  },
];

function PrinciplesGrid() {
  return (
    <section className="bg-[#F6F6FD] pb-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            What we believe
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl">
            Six principles, signed in code
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div
              key={p.title}
              className="group rounded-3xl bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200/30"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-600 ring-1 ring-inset ring-indigo-100">
                <p.icon className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <h3 className="mt-4 text-base font-bold text-[#0B1319]">
                {p.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TIMELINE = [
  {
    date: "May 2026",
    title: "Project kickoff",
    description:
      "First commit of what would become Advertix. Built the campaign + workspace data model in Prisma.",
  },
  {
    date: "May 2026",
    title: "Meta Marketing API integration",
    description:
      "Live OAuth + token encryption + campaign sync from Meta. Foundation for every platform that followed.",
  },
  {
    date: "May 2026",
    title: "Google + TikTok + LinkedIn",
    description:
      "Four platforms supported within weeks. AES-256-CBC token storage. Refresh-token rotation for Google.",
  },
  {
    date: "Jun 2026",
    title: "Phase 1A: Publish to Meta",
    description:
      "Full 6-step wizard. Audience picker. Creative upload. Atomic publish with rollback. Live in production.",
  },
  {
    date: "Jun 2026",
    title: "Rebrand to Advertix",
    description:
      "AdGenius AI → Advertix. New brand, new domain, new direction. Meta App Review submitted.",
  },
  {
    date: "Next",
    title: "Marketing API approval",
    description:
      "Meta App Review approval unlocks higher-volume ad publishing for everyone.",
  },
];

function TimelineBand() {
  return (
    <section className="bg-[#F6F6FD] pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[44px] bg-white px-6 py-12 shadow-sm sm:px-12 sm:py-16 lg:px-20">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
              <Calendar className="h-3 w-3" strokeWidth={2.5} />
              Where we came from
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-[#0B1319] sm:text-4xl">
              A short, honest timeline
            </h2>
          </div>

          <div className="relative mt-12">
            <div className="absolute left-4 top-2 hidden h-[calc(100%-1rem)] w-px bg-gradient-to-b from-indigo-200 via-indigo-100 to-transparent sm:block sm:left-1/2" />
            <ol className="space-y-8 sm:space-y-12">
              {TIMELINE.map((t, i) => (
                <li
                  key={t.title}
                  className={`relative grid gap-3 sm:grid-cols-2 sm:gap-8 ${
                    i % 2 === 1 ? "sm:[direction:rtl]" : ""
                  }`}
                >
                  <div className={`sm:[direction:ltr] ${i % 2 === 1 ? "sm:text-right" : ""}`}>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      {t.date}
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-[#0B1319]">
                      {t.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {t.description}
                    </p>
                  </div>

                  {/* Dot */}
                  <div className="absolute left-4 top-1.5 hidden h-3 w-3 -translate-x-1/2 rounded-full bg-indigo-600 ring-4 ring-indigo-100 sm:left-1/2 sm:block" />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function AboutCTA() {
  return (
    <section className="bg-[#F6F6FD] pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[44px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-10 text-center shadow-2xl shadow-indigo-600/30 sm:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 left-1/3 h-60 w-60 rounded-full bg-fuchsia-300/30 blur-3xl"
          />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Be among the first to try it
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/85">
              Free during beta. No card. No catch. Just the tool.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-indigo-700 shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-50"
              >
                Get started
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.5}
                />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
              >
                Email the founder
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
