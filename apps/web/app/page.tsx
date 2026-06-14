import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-dark-bg p-8 text-slate-100">
      <h1 className="text-5xl font-bold">Advertix</h1>
      <p className="max-w-xl text-center text-slate-300">
        AI-Powered Ads. Amplified. Manage every ad platform from one
        intelligent workspace.
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
      <footer className="mt-12 flex flex-col items-center gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-slate-100">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-slate-100">
            Terms
          </Link>
        </div>
        <p>© 2026 Advertix. All rights reserved.</p>
      </footer>
    </main>
  );
}
