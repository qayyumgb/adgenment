"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import {
  Check,
  ChevronRight,
  Lock,
  Bot,
  BarChart3,
  Palette,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const STEP_LABELS = ["Welcome", "Your Business", "Connect Ads", "You're Ready!"];

const INDUSTRIES = [
  "E-commerce",
  "SaaS",
  "Marketing Agency",
  "Restaurant & Food",
  "Real Estate",
  "Healthcare",
  "Fashion & Beauty",
  "Education",
  "Other",
];

const BUDGETS = ["Under $1K", "$1K–$5K", "$5K–$20K", "$20K–$100K", "$100K+"];

const GOALS = [
  { id: "sales", emoji: "🎯", label: "More Sales" },
  { id: "awareness", emoji: "👥", label: "Brand Awareness" },
  { id: "retargeting", emoji: "🔄", label: "Retargeting" },
  { id: "leads", emoji: "📧", label: "Lead Generation" },
  { id: "ecom", emoji: "🛍", label: "E-commerce" },
  { id: "app", emoji: "📱", label: "App Installs" },
];

const PLATFORMS_MULTI = [
  "Meta",
  "Google",
  "TikTok",
  "LinkedIn",
  "YouTube",
  "Snapchat",
  "Pinterest",
];

const TEAM_SIZES = [
  "Just me",
  "2–5 people",
  "6–20 people",
  "20+ people",
];

const CONNECT_PLATFORMS = [
  {
    id: "meta",
    name: "Meta",
    color: "#1877F2",
    initial: "M",
    sub: "Facebook & Instagram",
  },
  {
    id: "google",
    name: "Google Ads",
    color: "#EA4335",
    initial: "G",
    sub: "Search · YouTube · Display",
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    color: "#0f172a",
    initial: "T",
    sub: "For You feed · Spark Ads",
  },
  {
    id: "linkedin",
    name: "LinkedIn Ads",
    color: "#0A66C2",
    initial: "in",
    sub: "Sponsored content",
  },
];

const FINAL_FEATURES: Array<{
  emoji: string;
  title: string;
  cta: string;
  href: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}> = [
  {
    emoji: "🤖",
    title: "Launch your first AI campaign",
    cta: "Open AI Planner",
    href: "/ai-planner",
    color: "#6366f1",
    bg: "from-indigo-500 to-purple-600",
    icon: Bot,
  },
  {
    emoji: "📊",
    title: "Explore your analytics dashboard",
    cta: "View Analytics",
    href: "/analytics",
    color: "#10b981",
    bg: "from-emerald-500 to-teal-600",
    icon: BarChart3,
  },
  {
    emoji: "🎨",
    title: "Generate ad creatives with AI",
    cta: "Create Creatives",
    href: "/creatives",
    color: "#ec4899",
    bg: "from-pink-500 to-rose-500",
    icon: Palette,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [workspaceName, setWorkspaceName] = useState("");
  const [industry, setIndustry] = useState("");

  // Step 2
  const [budget, setBudget] = useState("");
  const [goal, setGoal] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState("");

  // Step 3
  const [connected, setConnected] = useState<string[]>([]);

  const canAdvanceStep1 = workspaceName.trim() !== "" && industry !== "";
  const canAdvanceStep2 =
    budget !== "" && goal !== "" && platforms.length > 0 && teamSize !== "";
  const canAdvanceStep3 = true; // Skip is allowed

  function next() {
    if (step === 4) return;
    setStep((s) => (Math.min(4, s + 1) as Step));
  }

  function finishOnboarding() {
    // TODO: persist workspace settings + Clerk publicMetadata.onboardingComplete = true
    router.push("/dashboard");
  }

  return (
    <div className="space-y-8">
      <StepIndicator current={step} />

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card">
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          {step === 1 && (
            <StepWelcome
              workspaceName={workspaceName}
              setWorkspaceName={setWorkspaceName}
              industry={industry}
              setIndustry={setIndustry}
              onNext={next}
              canAdvance={canAdvanceStep1}
            />
          )}
          {step === 2 && (
            <StepBusiness
              budget={budget}
              setBudget={setBudget}
              goal={goal}
              setGoal={setGoal}
              platforms={platforms}
              setPlatforms={setPlatforms}
              teamSize={teamSize}
              setTeamSize={setTeamSize}
              onNext={next}
              onBack={() => setStep(1)}
              canAdvance={canAdvanceStep2}
            />
          )}
          {step === 3 && (
            <StepConnect
              connected={connected}
              setConnected={setConnected}
              onNext={next}
              onBack={() => setStep(2)}
              canAdvance={canAdvanceStep3}
            />
          )}
          {step === 4 && <StepReady onFinish={finishOnboarding} />}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = current > n;
        const active = current === n;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={clsx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                done
                  ? "bg-emerald-500 text-white shadow-sm"
                  : active
                    ? "bg-primary text-white shadow-glow"
                    : "bg-slate-200 text-slate-500"
              )}
            >
              {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
            </div>
            <span
              className={clsx(
                "hidden truncate text-xs font-semibold sm:block",
                active
                  ? "text-slate-900"
                  : done
                    ? "text-emerald-700"
                    : "text-slate-400"
              )}
            >
              {label}
            </span>
            {n < 4 && (
              <div
                className={clsx(
                  "h-px flex-1 transition",
                  done ? "bg-emerald-500" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────────────────── */
function StepWelcome({
  workspaceName,
  setWorkspaceName,
  industry,
  setIndustry,
  onNext,
  canAdvance,
}: {
  workspaceName: string;
  setWorkspaceName: (s: string) => void;
  industry: string;
  setIndustry: (s: string) => void;
  onNext: () => void;
  canAdvance: boolean;
}) {
  return (
    <div className="space-y-6 animate-in">
      <div className="text-center">
        <div className="text-5xl">🚀</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight gradient-text sm:text-4xl">
          Welcome to AdGenius AI
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Let&apos;s set up your workspace in 3 minutes.
        </p>
      </div>

      <div className="space-y-4">
        <Field label="What should we call your workspace?" required>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="e.g. Acme Marketing, My Agency…"
            className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </Field>

        <Field label="What industry are you in?" required>
          <div className="relative">
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm font-medium text-slate-900 transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            >
              <option value="">Select your industry…</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-slate-400" />
          </div>
        </Field>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canAdvance}
        className={clsx(
          "btn-brand w-full justify-center",
          !canAdvance && "pointer-events-none opacity-50"
        )}
      >
        Continue
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ───────────────────────────────────────── */
function StepBusiness({
  budget,
  setBudget,
  goal,
  setGoal,
  platforms,
  setPlatforms,
  teamSize,
  setTeamSize,
  onNext,
  onBack,
  canAdvance,
}: {
  budget: string;
  setBudget: (s: string) => void;
  goal: string;
  setGoal: (s: string) => void;
  platforms: string[];
  setPlatforms: (p: string[]) => void;
  teamSize: string;
  setTeamSize: (s: string) => void;
  onNext: () => void;
  onBack: () => void;
  canAdvance: boolean;
}) {
  function togglePlatform(p: string) {
    setPlatforms(
      platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p]
    );
  }
  return (
    <div className="space-y-6 animate-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Tell us about your goals
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          We&apos;ll personalize the dashboard and AI suggestions for you.
        </p>
      </div>

      <Field label="Monthly ad budget" required>
        <PillGrid
          options={BUDGETS.map((b) => ({ value: b, label: b }))}
          value={budget}
          onChange={setBudget}
        />
      </Field>

      <Field label="Primary goal" required>
        <PillGrid
          cols="three"
          options={GOALS.map((g) => ({
            value: g.id,
            label: `${g.emoji} ${g.label}`,
          }))}
          value={goal}
          onChange={setGoal}
        />
      </Field>

      <Field label="Platforms you use" required>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS_MULTI.map((p) => {
            const selected = platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={clsx(
                  "rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Team size" required>
        <PillGrid
          options={TEAM_SIZES.map((t) => ({ value: t, label: t }))}
          value={teamSize}
          onChange={setTeamSize}
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          className={clsx(
            "btn-brand flex-1 justify-center",
            !canAdvance && "pointer-events-none opacity-50"
          )}
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
function StepConnect({
  connected,
  setConnected,
  onNext,
  onBack,
}: {
  connected: string[];
  setConnected: (c: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  canAdvance: boolean;
}) {
  function toggleConnect(id: string) {
    setConnected(
      connected.includes(id) ? connected.filter((c) => c !== id) : [...connected, id]
    );
  }
  return (
    <div className="space-y-5 animate-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Connect your ad accounts
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Connect at least one platform to get started — you can add more later.
        </p>
      </div>

      <div className="space-y-3">
        {CONNECT_PLATFORMS.map((p) => {
          const isConnected = connected.includes(p.id);
          return (
            <div
              key={p.id}
              className={clsx(
                "flex items-center gap-3 rounded-xl border-2 p-4 transition",
                isConnected
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                style={{ backgroundColor: p.color }}
              >
                {p.initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{p.name}</p>
                <p className="truncate text-xs text-slate-500">{p.sub}</p>
              </div>
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-emerald-700">
                    workspace@{p.id}.com
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                    Connected
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleConnect(p.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/10"
                >
                  Connect {p.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
        <Lock className="h-3.5 w-3.5 text-slate-400" />
        Your credentials are encrypted and never stored in plain text.
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="text-sm font-semibold text-slate-500 transition hover:text-primary"
        >
          Skip for now →
        </button>
        <button
          type="button"
          onClick={onNext}
          className="btn-brand ml-auto"
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────── */
function StepReady({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="space-y-7 text-center animate-in">
      {/* Animated checkmark */}
      <div className="relative mx-auto h-20 w-20">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl">
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          You&apos;re all set! 🎉
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your workspace is ready. Here&apos;s what you can do:
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {FINAL_FEATURES.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover"
          >
            <div
              className={clsx(
                "mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                f.bg
              )}
            >
              <f.icon className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <p className="text-sm font-bold text-slate-900">{f.title}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary transition group-hover:translate-x-0.5">
              {f.cta}
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={onFinish}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-4 py-3.5 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:shadow-xl"
      >
        Go to Dashboard
        <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ───────────────────────────────────────── */
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function PillGrid({
  options,
  value,
  onChange,
  cols = "auto",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  cols?: "auto" | "three";
}) {
  return (
    <div
      className={clsx(
        "flex flex-wrap gap-2",
        cols === "three" && "grid grid-cols-2 sm:grid-cols-3"
      )}
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition",
              cols === "three" && "rounded-xl",
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
