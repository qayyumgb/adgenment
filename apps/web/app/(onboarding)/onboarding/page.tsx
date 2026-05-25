"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import toast from "react-hot-toast";
import clsx from "clsx";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Building2,
  Briefcase,
  Users,
  Rocket,
} from "lucide-react";
import { useApiClient } from "@/lib/api";

const INDUSTRIES = [
  "E-commerce",
  "SaaS / Software",
  "Marketing Agency",
  "Education",
  "Healthcare",
  "Finance",
  "Real Estate",
  "Travel & Hospitality",
  "Media & Entertainment",
  "Non-profit",
  "Other",
];

const COMPANY_SIZES = [
  { id: "1", label: "Just me", sub: "Solo founder / freelancer" },
  { id: "2-10", label: "2–10 people", sub: "Small team" },
  { id: "11-50", label: "11–50 people", sub: "Growing startup" },
  { id: "51-200", label: "51–200 people", sub: "Mid-market" },
  { id: "201+", label: "201+ people", sub: "Enterprise" },
];

const STEP_LABELS = ["Workspace", "Industry", "Team size", "Finish"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const api = useApiClient();

  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [industry, setIndustry] = useState<string>("");
  const [companySize, setCompanySize] = useState<string>("");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // If the user already has a workspace, skip the wizard entirely.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isLoaded) return;
      try {
        const me = await api.getMe();
        if (cancelled) return;
        if (me.workspace) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Not authenticated or API down — just let the wizard render and
        // surface the error on submit. Clerk middleware handles unauth above.
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, isLoaded, router]);

  // Seed a default workspace name from Clerk profile
  useEffect(() => {
    if (!workspaceName && user?.firstName) {
      setWorkspaceName(`${user.firstName}'s Workspace`);
    }
  }, [user, workspaceName]);

  const canAdvance =
    (step === 1 && workspaceName.trim().length >= 2) ||
    (step === 2 && industry !== "") ||
    (step === 3 && companySize !== "") ||
    step === 4;

  async function finishOnboarding() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.completeOnboarding({
        workspaceName: workspaceName.trim(),
        industry: industry || undefined,
        companySize: companySize || undefined,
      });
      toast.success("Workspace created!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't create your workspace. Please try again."
      );
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
          <Sparkles className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <span className="text-base font-bold tracking-tight text-slate-900">
          AdGenius AI
        </span>
      </div>

      {/* Step indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const current = step === n;
            return (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={clsx(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition",
                    done
                      ? "bg-primary text-white"
                      : current
                        ? "bg-primary/15 text-primary ring-2 ring-primary"
                        : "bg-slate-100 text-slate-400"
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                <div
                  className={clsx(
                    "hidden truncate text-xs font-semibold sm:block",
                    current
                      ? "text-slate-900"
                      : done
                        ? "text-slate-600"
                        : "text-slate-400"
                  )}
                >
                  {label}
                </div>
                {n < STEP_LABELS.length && (
                  <div
                    className={clsx(
                      "h-px flex-1 transition",
                      done ? "bg-primary" : "bg-slate-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white p-8 shadow-card">
        {step === 1 && (
          <StepCard
            icon={Building2}
            title="What should we call your workspace?"
            sub="This is where all of your campaigns, creatives and team will live. You can change it later in Settings."
          >
            <input
              type="text"
              autoFocus
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Acme Inc."
              maxLength={64}
              className="h-12 w-full rounded-xl border-2 border-slate-200 px-4 text-base font-medium text-slate-900 transition focus:border-primary focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAdvance) setStep(2);
              }}
            />
          </StepCard>
        )}

        {step === 2 && (
          <StepCard
            icon={Briefcase}
            title="What industry are you in?"
            sub="We'll tailor recommendations and example campaigns to your space."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {INDUSTRIES.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIndustry(opt)}
                  className={clsx(
                    "rounded-xl border-2 px-3 py-3 text-left text-sm font-semibold transition",
                    industry === opt
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </StepCard>
        )}

        {step === 3 && (
          <StepCard
            icon={Users}
            title="How big is your team?"
            sub="Helps us suggest the right plan and collaboration features."
          >
            <div className="space-y-2">
              {COMPANY_SIZES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCompanySize(opt.id)}
                  className={clsx(
                    "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition",
                    companySize === opt.id
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-slate-500">{opt.sub}</div>
                  </div>
                  {companySize === opt.id && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </StepCard>
        )}

        {step === 4 && (
          <StepCard
            icon={Rocket}
            title="You're all set!"
            sub="Review your details — you can change any of this later in Settings."
          >
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <ReviewRow label="Workspace" value={workspaceName} />
              <ReviewRow label="Industry" value={industry || "—"} />
              <ReviewRow
                label="Team size"
                value={
                  COMPANY_SIZES.find((s) => s.id === companySize)?.label ?? "—"
                }
              />
            </div>
            <p className="mt-4 text-xs text-slate-500">
              After this, we&apos;ll drop you in your dashboard. Connect an ad
              account from Settings to start syncing campaigns.
            </p>
          </StepCard>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          disabled={step === 1 || submitting}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        {step < 4 ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
            className={clsx(
              "btn-brand",
              !canAdvance && "pointer-events-none opacity-50"
            )}
          >
            Continue
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={finishOnboarding}
            className="btn-brand disabled:pointer-events-none disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting up…
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4" strokeWidth={2.5} />
                Go to Dashboard
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function StepCard({
  icon: Icon,
  title,
  sub,
  children,
}: {
  icon: typeof Building2;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md">
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">{sub}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}
