import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-dark-bg p-8 text-slate-100">
      <h1 className="text-5xl font-bold">
        AdGenius <span className="text-primary">AI</span>
      </h1>
      <p className="max-w-xl text-center text-slate-300">
        Multi-platform AI-powered ad management. Plan, generate, launch, and
        optimize campaigns across every major ad network.
      </p>
      <div className="flex gap-4">
        <Link
          href="/sign-in"
          className="rounded-md bg-primary px-6 py-2.5 font-medium text-white hover:bg-primary-600"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="rounded-md border border-dark-border px-6 py-2.5 font-medium text-slate-100 hover:bg-dark-surface"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
