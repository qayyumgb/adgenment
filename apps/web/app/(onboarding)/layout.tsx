import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50/40">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-purple-200/30 blur-3xl" />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center pt-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 shadow-glow">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold tracking-tight text-slate-900">
              AdGenius AI
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-primary">
              AI Platform
            </div>
          </div>
        </Link>
      </div>

      {/* Centered card */}
      <main className="relative z-10 mx-auto flex max-w-2xl flex-col px-4 py-8 sm:py-12">
        {children}
      </main>
    </div>
  );
}
